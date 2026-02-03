/**
 * POST /api/music/generate
 * 
 * Generate classical music from intermediate representation
 * Returns a job ID immediately, actual generation happens async
 */

import { createMusicJob, updateMusicJob, getMusicJob } from '../musicJobStore.js';
import { checkRateLimit, checkConcurrency, releaseJob } from '../lib/rate-limit.js';
import { generateMusicStructureWithFallback } from '../musicLLMService.js';
import { musicStructureToMIDI } from '../midiConverter.js';
import MidiWriter from 'midi-writer-js';

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
    },
  ];

  if (form === 'ABA') {
    sections.push({ ...sections[0], name: 'A (reprise)' });
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
 * Get client identifier (IP address) from request
 * @param {Object} req - Express request object
 * @returns {string} Client identifier
 */
function getClientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
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

    // Generate music structure using LLM (with fallback)
    const { structure: rawStructure, provider } = await generateMusicStructureWithFallback(request);

    const structure = {
      ...rawStructure,
      timeSignature: toTimeSignature(rawStructure?.timeSignature),
      tempo: Number(rawStructure?.tempo) || Math.round(60 + clampNumber(request?.arousal, { min: 0, max: 1, fallback: 0.5 }) * 80),
      sections: Array.isArray(rawStructure?.sections) && rawStructure.sections.length ? rawStructure.sections : makeEmergencyStructure(request, 'empty sections').sections,
      instrumentation: rawStructure?.instrumentation || 'piano',
      character: rawStructure?.character || 'unknown',
    };

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

  if (!Array.isArray(motif_tags) || motif_tags.length === 0) {
    warnings.push('motif_tags missing; using a default motif.');
  }

  // Check rate limit
  if (!checkRateLimit(clientId)) {
    const job = createMusicJob({
      provider: 'rule-based',
      input: {
        valence,
        arousal,
        focus,
        motif_tags: motif_tags.length ? motif_tags : ['memory'],
        confidence,
        duration,
        seed,
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
      input: {
        valence,
        arousal,
        focus,
        motif_tags: motif_tags.length ? motif_tags : ['memory'],
        confidence,
        duration,
        seed,
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
      input: {
        valence,
        arousal,
        focus,
        motif_tags: motif_tags.length ? motif_tags : ['memory'],
        confidence,
        duration,
        seed,
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
