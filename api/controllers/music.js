/**
 * POST /api/music/generate
 * 
 * Generate classical music from intermediate representation
 * Returns a job ID immediately, actual generation happens async
 */

import { createMusicJob, updateMusicJob, getMusicJob } from '../musicJobStore.js';
import { checkRateLimit, checkConcurrency, releaseJob } from '../lib/rate-limit.js';
import { getClientIdentifier } from '../lib/client-id.js';
import { generateMusicStructureWithFallback } from '../musicLLMService.js';
import { musicStructureToMIDI } from '../midiConverter.js';
import MidiWriter from 'midi-writer-js';
import { getUserBySessionToken, getUserRecordById } from '../authStore.js';
import { makeGenerationEmail, sendEmail } from '../lib/notifications.js';

// Error codes
const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  EMERGENCY_FALLBACK: 'EMERGENCY_FALLBACK',
};

const MUSIC_STRUCTURE_TIMEOUT_MS = Number(process.env.MUSIC_STRUCTURE_TIMEOUT_MS) || 60 * 1000;

async function runWithTimeout(promise, timeoutMs) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Music generation timeout after ${timeoutMs / 1000}s`)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    throw error;
  }
}

function clampNumber(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeMotifTags(raw) {
  let tags = [];
  if (Array.isArray(raw)) tags = raw;
  else if (typeof raw === 'string') tags = raw.split(',');
  return tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, 24);
}

function toTimeSignature(value) {
  const v = String(value ?? '').trim();
  if (!v) return '4/4';
  const m = v.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (!m) return '4/4';
  const num = Math.max(1, Math.min(12, Number(m[1])));
  const den = Math.max(1, Math.min(16, Number(m[2])));
  return `${num}/${den}`;
}

function normalizeStringArray(v, maxLen = 12) {
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, maxLen);
  }
  if (typeof v === 'string') {
    return v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, maxLen);
  }
  return [];
}

function normalizeNumberArray(v, { min, max, maxLen }) {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.max(min, Math.min(max, n)))
    .slice(0, maxLen);
}

function makeEmergencyStructure(input, reason) {
  const valence = clampNumber(input?.valence, { min: -1, max: 1, fallback: 0 });
  const arousal = clampNumber(input?.arousal, { min: 0, max: 1, fallback: 0.5 });
  const focus = clampNumber(input?.focus, { min: 0, max: 1, fallback: 0.5 });
  const key = valence < 0 ? 'd minor' : 'C major';
  const tempo = Math.round(60 + arousal * 80);
  const timeSignature = focus > 0.6 ? '4/4' : '3/4';
  const form = focus > 0.5 ? 'ABA' : 'theme-variation';
  const dynamics = arousal < 0.3 ? 'p' : arousal > 0.7 ? 'f' : 'mf';

  const sections = [
    {
      name: 'A',
      measures: 8,
      chordProgression: valence < 0 ? ['i', 'iv', 'V', 'i'] : ['I', 'IV', 'V', 'I'],
      melody: {
        motifs: [
          {
            degrees: valence < 0 ? [5, 4, 3, 2, 1] : [1, 3, 5, 3, 1],
            rhythm: [1, 1, 1, 1, 2],
          },
        ],
      },
      dynamics,
      texture: 'simple',
      cadence: 'HC',
    },
    {
      name: 'B',
      measures: 8,
      chordProgression: valence < 0 ? ['VI', 'iv', 'V', 'i'] : ['vi', 'IV', 'I', 'V'],
      melody: {
        motifs: [
          {
            degrees: [3, 5, 6, 5, 3],
            rhythm: [0.5, 0.5, 1, 1, 2],
          },
        ],
      },
      dynamics,
      texture: 'simple',
      cadence: valence < 0 ? 'PICARDY' : 'PAC',
    },
  ];

  if (form === 'ABA') {
    sections.push({ ...sections[0], name: 'A (reprise)', cadence: valence < 0 ? 'PICARDY' : 'PAC' });
  }

  return {
    key,
    tempo,
    timeSignature,
    form,
    sections,
    instrumentation: 'piano',
    character: `${valence < 0 ? 'melancholic' : 'uplifting'} and ${arousal < 0.5 ? 'calm' : 'energetic'}`,
    reasoning: `Emergency fallback used: ${reason}`,
  };
}

function emergencyMidiBase64({ tempo, timeSignature }) {
  const track = new MidiWriter.Track();
  track.setTempo(Number(tempo) || 90);
  const ts = toTimeSignature(timeSignature);
  const [n, d] = ts.split('/').map(Number);
  track.setTimeSignature(n, d, 24, 8);

  // Simple 2-bar motif (C major-ish), safe defaults
  const pitches = [72, 74, 76, 77, 79, 77, 76, 74];
  for (const p of pitches) {
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [p],
        duration: '8',
        velocity: 92,
      })
    );
  }

  const writer = new MidiWriter.Writer([track]);
  const base64 = writer.dataUri().split(',')[1];
  return base64;
}

function safeStructureToMidi(structure, warnings) {
  try {
    const safe = {
      ...structure,
      tempo: Number(structure?.tempo) || 90,
      timeSignature: toTimeSignature(structure?.timeSignature),
      sections: Array.isArray(structure?.sections) && structure.sections.length ? structure.sections : makeEmergencyStructure({}, 'missing sections').sections,
    };
    return musicStructureToMIDI(safe);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`MIDI conversion failed; using emergency MIDI. (${msg.slice(0, 160)})`);
    return emergencyMidiBase64({ tempo: structure?.tempo, timeSignature: structure?.timeSignature });
  }
}



/**
 * Execute music generation with retry logic
 * @param {string} jobId - Job ID
 * @param {Object} request - Music generation request
 * @param {string} clientId - Client identifier for rate limiting
 */
async function executeMusicGeneration(jobId, request, clientId) {
  try {
    console.log(`[MusicGeneration] Starting job ${jobId}`);

    // Update job status to running
    updateMusicJob(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    const warnings = [];

    // Generate music structure using LLM (with fallback), but enforce a hard timeout.
    const { structure: rawStructure, provider } = await runWithTimeout(
      generateMusicStructureWithFallback(request),
      MUSIC_STRUCTURE_TIMEOUT_MS
    );

    const structure = {
      ...rawStructure,
      timeSignature: toTimeSignature(rawStructure?.timeSignature),
      tempo: Number(rawStructure?.tempo) || Math.round(60 + clampNumber(request?.arousal, { min: 0, max: 1, fallback: 0.5 }) * 80),
      sections: Array.isArray(rawStructure?.sections) && rawStructure.sections.length ? rawStructure.sections : makeEmergencyStructure(request, 'empty sections').sections,
      instrumentation: rawStructure?.instrumentation || 'piano',
      character: rawStructure?.character || 'unknown',
    };

    // Quality-loop invariant: ensure at least one cadence goal exists.
    try {
      const sections = Array.isArray(structure?.sections) ? structure.sections : [];
      const allowed = new Set(['HC', 'PAC', 'DC', 'PICARDY']);
      const hasCadence = sections.some((s) => s && typeof s.cadence === 'string' && allowed.has(s.cadence));
      if (!hasCadence && sections.length) {
        const key = String(structure?.key || '').toLowerCase();
        const minor = key.includes('minor');
        sections[sections.length - 1] = {
          ...(sections[sections.length - 1] || {}),
          cadence: minor ? 'PICARDY' : 'PAC',
        };
      }
    } catch {
      // ignore
    }

    // Update provider if it changed (e.g., fell back to rules)
    updateMusicJob(jobId, { provider });

    console.log(`[MusicGeneration] Generated structure with provider: ${provider}`);

    // Convert structure to MIDI (never hard-fail)
    const midiData = safeStructureToMidi(structure, warnings);

    console.log(`[MusicGeneration] Converted to MIDI (${midiData.length} bytes base64)`);

    // Update job as succeeded
    updateMusicJob(jobId, {
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      result: structure,
      midiData,
      warnings,
      fallbackUsed: provider !== 'openai' || warnings.length > 0,
      effectiveProvider: provider,
    });

    await maybeNotifyMusicJobSucceeded(jobId, structure).catch((e) => {
      console.warn('[EmailNotifications] music notify failed:', e);
    });

    console.log(`[MusicGeneration] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[MusicGeneration] Job ${jobId} failed:`, error);

    // Defense-in-depth: try to still succeed with an emergency MIDI.
    try {
      const warnings = [];
      const msg = error instanceof Error ? error.message : String(error);
      warnings.push(`Music generation failed; emergency fallback used. (${msg.slice(0, 180)})`);
      const structure = makeEmergencyStructure(request, 'generation error');
      const midiData = safeStructureToMidi(structure, warnings);
      updateMusicJob(jobId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        provider: 'rule-based',
        result: structure,
        midiData,
        warnings,
        fallbackUsed: true,
        effectiveProvider: 'emergency',
        fallbackReason: ERROR_CODES.EMERGENCY_FALLBACK,
        generationError: msg,
      });
      return;
    } catch (fallbackError) {
      console.error(`[MusicGeneration] Job ${jobId} emergency fallback also failed:`, fallbackError);
    }

    const errorCode = error?.response?.status === 429
      ? ERROR_CODES.RATE_LIMIT
      : error?.message?.includes('timeout')
      ? ERROR_CODES.TIMEOUT
      : error?.message?.includes('validation')
      ? ERROR_CODES.VALIDATION_ERROR
      : ERROR_CODES.API_ERROR;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    updateMusicJob(jobId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      errorCode,
      errorMessage,
      error: errorMessage,
    });
  } finally {
    // Release concurrency slot
    releaseJob(clientId);
  }
}

function getBearerToken(req) {
  const auth = String(req.headers?.authorization || '').trim();
  if (!auth) return '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? String(m[1]).trim() : '';
}

async function maybeNotifyMusicJobSucceeded(jobId, structure) {
  const job = getMusicJob(jobId);
  if (!job) return;
  if (job.status !== 'succeeded') return;
  if (!job.userId) return;
  if (job.emailNotifiedAt) return;

  const userRec = await getUserRecordById(String(job.userId));
  const to = userRec?.email;
  if (!to) return;

  const { subject, text, html } = makeGenerationEmail({ albumTitle: structure?.character || 'あなたの作品' });
  const result = await sendEmail({
    to,
    subject,
    text,
    html,
    dedupeKey: `music:${jobId}`,
    dedupeTtlMs: 24 * 60 * 60 * 1000,
  });

  if (!result?.skipped) {
    updateMusicJob(jobId, { emailNotifiedAt: new Date().toISOString() });
  }
}

/**
 * Generate music handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function generateMusic(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client identifier for rate limiting
  const clientId = getClientIdentifier(req);

  // Best-effort: attach job to logged-in user if Bearer session token is present.
  let userId = null;
  try {
    const token = getBearerToken(req);
    if (token) {
      const u = await getUserBySessionToken(token);
      userId = u?.id ? String(u.id) : null;
    }
  } catch {
    userId = null;
  }

  // Parse/sanitize request body early so we can always produce a fallback.
  const body = req.body || {};
  const warnings = [];
  const valence = clampNumber(body.valence, { min: -1, max: 1, fallback: 0 });
  const arousal = clampNumber(body.arousal, { min: 0, max: 1, fallback: 0.5 });
  const focus = clampNumber(body.focus, { min: 0, max: 1, fallback: 0.5 });
  const confidence = clampNumber(body.confidence, { min: 0, max: 1, fallback: 0.5 });
  const duration = clampNumber(body.duration, { min: 20, max: 420, fallback: 180 });
  const seed = body.seed;
  const motif_tags = normalizeMotifTags(body.motif_tags ?? body.motifTags);

  // Advanced musical controls (optional)
  const key = typeof body.key === 'string' ? body.key.trim().slice(0, 24) : undefined;
  const tempo = body.tempo != null ? clampNumber(body.tempo, { min: 40, max: 220, fallback: undefined }) : undefined;
  const timeSignature = body.timeSignature != null || body.time_signature != null ? toTimeSignature(body.timeSignature ?? body.time_signature) : undefined;
  const form = typeof body.form === 'string' ? body.form.trim().slice(0, 24) : undefined;
  const period = typeof body.period === 'string' ? body.period.trim().slice(0, 24) : undefined;
  const instrumentation = normalizeStringArray(body.instrumentation, 8);
  const motif_seed = normalizeNumberArray(body.motif_seed ?? body.motifSeedDegrees, { min: 1, max: 14, maxLen: 12 });
  const rhythm_seed = normalizeNumberArray(body.rhythm_seed ?? body.rhythmSeed, { min: 0.25, max: 4, maxLen: 12 });
  const section_plan = body.section_plan && typeof body.section_plan === 'object' ? body.section_plan : body.sectionPlan && typeof body.sectionPlan === 'object' ? body.sectionPlan : undefined;
  const emotional_arc = body.emotional_arc && typeof body.emotional_arc === 'object'
    ? body.emotional_arc
    : body.emotionalArc && typeof body.emotionalArc === 'object'
      ? body.emotionalArc
      : undefined;
  const humanize = body.humanize && typeof body.humanize === 'object' ? body.humanize : undefined;

  if (!Array.isArray(motif_tags) || motif_tags.length === 0) {
    warnings.push('motif_tags missing; using a default motif.');
  }

  // Check rate limit
  if (!checkRateLimit(clientId)) {
    const job = createMusicJob({
      provider: 'rule-based',
      userId,
      input: {
        valence,
        arousal,
        focus,
        motif_tags: motif_tags.length ? motif_tags : ['memory'],
        confidence,
        duration,
        seed,
        key,
        tempo,
        timeSignature,
        form,
        period,
        instrumentation: instrumentation.length ? instrumentation : undefined,
        motif_seed: motif_seed.length ? motif_seed : undefined,
        rhythm_seed: rhythm_seed.length ? rhythm_seed : undefined,
        section_plan,
        emotional_arc,
        humanize,
      },
      maxRetries: 0,
    });

    const fallbackWarnings = [...warnings, 'Rate limited; returning an emergency composition to keep the experience moving.'];
    const structure = makeEmergencyStructure(job.input, 'rate limit');
    const midiData = safeStructureToMidi(structure, fallbackWarnings);
    updateMusicJob(job.id, {
      status: 'succeeded',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      provider: 'rule-based',
      result: structure,
      midiData,
      warnings: fallbackWarnings,
      fallbackUsed: true,
      effectiveProvider: 'emergency',
      fallbackReason: ERROR_CODES.RATE_LIMIT,
    });

    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Music generation started',
    });
  }

  // Check concurrency limit
  if (!checkConcurrency(clientId)) {
    const job = createMusicJob({
      provider: 'rule-based',
      userId,
      input: {
        valence,
        arousal,
        focus,
        motif_tags: motif_tags.length ? motif_tags : ['memory'],
        confidence,
        duration,
        seed,
        key,
        tempo,
        timeSignature,
        form,
        period,
        instrumentation: instrumentation.length ? instrumentation : undefined,
        motif_seed: motif_seed.length ? motif_seed : undefined,
        rhythm_seed: rhythm_seed.length ? rhythm_seed : undefined,
        section_plan,
        emotional_arc,
        humanize,
      },
      maxRetries: 0,
    });

    const fallbackWarnings = [...warnings, 'Too many concurrent jobs; returning an emergency composition immediately.'];
    const structure = makeEmergencyStructure(job.input, 'concurrency');
    const midiData = safeStructureToMidi(structure, fallbackWarnings);
    updateMusicJob(job.id, {
      status: 'succeeded',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      provider: 'rule-based',
      result: structure,
      midiData,
      warnings: fallbackWarnings,
      fallbackUsed: true,
      effectiveProvider: 'emergency',
      fallbackReason: 'CONCURRENCY',
    });

    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Music generation started',
    });
  }

  try {
    // Create job
    const job = createMusicJob({
      provider: 'openai',
      userId,
      input: {
        valence,
        arousal,
        focus,
        motif_tags: motif_tags.length ? motif_tags : ['memory'],
        confidence,
        duration,
        seed,
        key,
        tempo,
        timeSignature,
        form,
        period,
        instrumentation: instrumentation.length ? instrumentation : undefined,
        motif_seed: motif_seed.length ? motif_seed : undefined,
        rhythm_seed: rhythm_seed.length ? rhythm_seed : undefined,
        section_plan,
        emotional_arc,
        humanize,
      },
      maxRetries: 1,
    });

    if (warnings.length) {
      updateMusicJob(job.id, { warnings });
    }

    // Start async music generation
    executeMusicGeneration(job.id, job.input, clientId);

    // Return job ID immediately
    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Music generation started',
    });
  } catch (error) {
    console.error('Request handling error:', error);
    releaseJob(clientId);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/music/preview
 * Resolve a legal short preview URL for a recommended track.
 * Uses iTunes Search API (no auth) and returns previewUrl + external link if found.
 */
export async function getMusicPreview(req, res) {
  try {
    const composer = String(req.body?.composer ?? '').trim();
    const title = String(req.body?.title ?? '').trim();

    if (!composer || !title) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'composer and title are required',
      });
    }

    if (typeof fetch !== 'function') {
      return res.status(500).json({
        error: 'Fetch not available',
        message: 'Server runtime does not support fetch()',
      });
    }

    const term = `${composer} ${title}`;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!resp.ok) {
      return res.status(502).json({
        error: 'Upstream error',
        message: `iTunes search failed (${resp.status})`,
      });
    }

    const data = await resp.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    const best = results.find((r) => typeof r?.previewUrl === 'string' && r.previewUrl.length > 0) || null;
    if (!best) {
      return res.json({
        found: false,
        previewUrl: null,
        trackUrl: null,
        artistName: null,
        trackName: null,
        artworkUrl: null,
      });
    }

    return res.json({
      found: true,
      previewUrl: best.previewUrl ?? null,
      trackUrl: best.trackViewUrl ?? null,
      artistName: best.artistName ?? null,
      trackName: best.trackName ?? null,
      artworkUrl: best.artworkUrl100 ?? best.artworkUrl60 ?? null,
      source: 'itunes',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
