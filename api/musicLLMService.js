/**
 * LLM-based music structure generation service (P4)
 * Generates classical music structure from intermediate representation
 */

import OpenAI from 'openai';
import { ollamaChatJson } from './lib/ollamaClient.js';
import { parseJsonLoose } from './lib/json.js';

function envStr(name, fallback = '') {
  const v = String(process.env[name] ?? '').trim();
  return v || fallback;
}

function envNum(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

function getMusicModel() {
  return envStr('OPENAI_MODEL_MUSIC', 'gpt-4o-mini');
}

function getMusicTemperature() {
  return Math.max(0, Math.min(1, envNum('LLM_TEMPERATURE_MUSIC', 0.65)));
}

function clamp(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function normalizeTimeSignature(ts) {
  const s = String(ts || '').trim();
  if (!s) return '4/4';
  const [nRaw, dRaw] = s.split('/');
  const n = Math.max(1, Math.min(12, Number(nRaw) || 4));
  const d = [2, 4, 8, 16].includes(Number(dRaw)) ? Number(dRaw) : 4;
  return `${n}/${d}`;
}

function parseTimeSignature(ts) {
  const [nRaw, dRaw] = normalizeTimeSignature(ts).split('/');
  const n = Number(nRaw) || 4;
  const d = Number(dRaw) || 4;
  const measureBeats = n * (4 / d);
  return { n, d, measureBeats };
}

function normalizeKey(rawKey, { valence } = {}) {
  const supported = [
    'C major',
    'c minor',
    'D major',
    'd minor',
    'E major',
    'e minor',
    'F major',
    'f minor',
    'G major',
    'g minor',
    'A major',
    'a minor',
    'B major',
    'b minor',
  ];

  const s = String(rawKey || '').trim();
  if (s) {
    const lower = s.toLowerCase();
    const hit = supported.find((k) => k.toLowerCase() === lower);
    if (hit) return hit;
  }

  // Default based on valence
  const v = Number(valence);
  if (Number.isFinite(v) && v < -0.15) return 'd minor';
  return 'C major';
}

function modeFromKey(key) {
  const s = String(key || '').toLowerCase();
  return s.includes('minor') ? 'minor' : 'major';
}

function romanDegreeFromText(text) {
  const m = String(text || '').match(/[ivIV]{1,3}/);
  if (!m) return null;
  const upper = m[0].toUpperCase();
  const map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
  return map[upper] || null;
}

function romanForDegree(degree, mode) {
  const d = Number(degree);
  if (![1, 2, 3, 4, 5, 6, 7].includes(d)) return mode === 'minor' ? 'i' : 'I';
  const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const base = romans[d] || 'I';

  // Encode triad quality via case (midiConverter uses case + VII => diminished).
  if (mode === 'major') {
    if (d === 1 || d === 4 || d === 5) return base; // major
    if (d === 7) return base.toLowerCase(); // diminished via VII check
    return base.toLowerCase(); // minor
  }

  // minor (approx natural minor)
  if (d === 1 || d === 4 || d === 5) return base.toLowerCase(); // minor i/iv/v
  if (d === 7) return base.toLowerCase(); // diminished-ish; converter will treat VII as diminished
  return base; // major III/VI/VII
}

function normalizeChordProgression(raw, { key }) {
  const mode = modeFromKey(key);
  const input = Array.isArray(raw) ? raw : [];
  const degrees = input
    .map((c) => romanDegreeFromText(c))
    .filter((d) => Number.isFinite(d));

  const fallback = mode === 'minor' ? ['i', 'VI', 'III', 'VII'] : ['I', 'V', 'vi', 'IV'];
  const use = degrees.length ? degrees : fallback.map((c) => romanDegreeFromText(c)).filter(Boolean);
  const normalized = use.map((d) => romanForDegree(d, mode));
  const uniq = normalized.filter(Boolean);
  return uniq.length ? uniq.slice(0, 32) : fallback;
}

function getCadencePlan(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'classical-balanced';
  if (['balanced', 'classic', 'classical', 'classical-balanced'].includes(s)) return 'classical-balanced';
  if (['strong', 'strong-final', 'final-strong'].includes(s)) return 'strong-final';
  if (['closed', 'closed-every-section', 'all-authentic'].includes(s)) return 'closed-every-section';
  if (['open', 'open-ended', 'half-cadence'].includes(s)) return 'open-ended';
  return 'classical-balanced';
}

function tonicRoman(mode) {
  return mode === 'minor' ? 'i' : 'I';
}

function dominantRoman() {
  return 'V';
}

function predominantRoman(mode) {
  return mode === 'minor' ? 'iv' : 'ii';
}

function makeClassicalProgression({ mode, measures, cadenceType }) {
  const m = Math.max(1, Number(measures) || 1);
  const I = tonicRoman(mode);
  const V = dominantRoman();
  const PD = predominantRoman(mode);
  const vi = mode === 'minor' ? 'VI' : 'vi';
  const iii = mode === 'minor' ? 'III' : 'iii';
  const IV = mode === 'minor' ? 'iv' : 'IV';
  const VII = mode === 'minor' ? 'VII' : 'vii';

  // Default 4-bar phrase (tonic → prolongation → predominant → dominant)
  const phrase4 = [I, vi, PD, V];
  const out = [];
  while (out.length < m) out.push(...phrase4);
  out.length = m;

  // Add a touch of variety in the middle for longer sections.
  if (m >= 8) {
    out[Math.floor(m / 2) - 1] = iii;
    out[Math.floor(m / 2)] = IV;
    out[Math.floor(m / 2) + 1] = PD;
  }
  if (m >= 12) {
    out[2] = IV;
    out[3] = V;
    out[4] = I;
    out[5] = VII;
  }

  return applyCadence(out, { mode, measures: m, cadenceType });
}

function applyCadence(prog, { mode, measures, cadenceType }) {
  const m = Math.max(1, Number(measures) || 1);
  const out = Array.isArray(prog) ? prog.slice(0, m) : [];
  while (out.length < m) out.push(tonicRoman(mode));

  const I = tonicRoman(mode);
  const V = dominantRoman();
  const PD = predominantRoman(mode);

  if (m === 1) {
    out[0] = cadenceType === 'half' ? V : I;
    return out;
  }

  if (cadenceType === 'half') {
    out[m - 1] = V;
    if (m >= 2) out[m - 2] = PD;
    if (m >= 4) out[0] = I;
    return out;
  }

  // authentic
  out[m - 1] = I;
  out[m - 2] = V;
  if (m >= 3) out[m - 3] = PD;
  if (m >= 4) out[0] = I;
  return out;
}

function expandChordProgressionToMeasures(chords, measures, { key, cadenceType }) {
  const mode = modeFromKey(key);
  const m = Math.max(1, Number(measures) || 1);
  const normalized = normalizeChordProgression(chords, { key });
  if (!Array.isArray(normalized) || !normalized.length) {
    return makeClassicalProgression({ mode, measures: m, cadenceType });
  }

  // If LLM already provided one-chord-per-bar, keep it (then enforce cadence).
  const out = [];
  while (out.length < m) out.push(...normalized);
  out.length = m;
  return applyCadence(out, { mode, measures: m, cadenceType });
}

function wrapDegreeToScale(d) {
  const x = Number(d);
  if (!Number.isFinite(x)) return 1;
  const base = ((Math.round(x) - 1) % 7 + 7) % 7;
  return base + 1;
}

function ensureMotifsForClassicalCadence(motifs, { key }) {
  const mode = modeFromKey(key);
  const base = Array.isArray(motifs) && motifs.length ? motifs : [{ degrees: [1, 3, 5, 3], rhythm: [1, 1, 1, 1] }];
  const m0 = base[0] || { degrees: [1, 3, 5, 3], rhythm: [1, 1, 1, 1] };

  const degrees0 = Array.isArray(m0.degrees) && m0.degrees.length ? m0.degrees : [1, 3, 5, 3];
  const rhythm0 = Array.isArray(m0.rhythm) && m0.rhythm.length ? m0.rhythm : [1, 1, 1, 1];

  const opening = { degrees: degrees0.slice(0, 10), rhythm: rhythm0.slice(0, 10) };
  const sequence = {
    degrees: degrees0.map((d) => wrapDegreeToScale(d + 1)).slice(0, 10),
    rhythm: rhythm0.slice(0, 10),
  };
  const continuation = {
    degrees: degrees0
      .slice(0, 6)
      .map((d, i, arr) => (i % 2 === 0 ? wrapDegreeToScale(d) : wrapDegreeToScale(arr[Math.max(0, i - 1)] - 1)))
      .slice(0, 10),
    rhythm: rhythm0.map((r) => (Number(r) <= 0.5 ? 0.5 : 1)).slice(0, 10),
  };

  // Cadential motif: stepwise approach to tonic.
  const cadenceDegrees = mode === 'minor' ? [2, 7, 1, 1] : [2, 7, 1, 1];
  const cadence = { degrees: cadenceDegrees, rhythm: [0.5, 0.5, 1, 2] };

  const out = [opening, sequence, continuation, cadence];
  return normalizeMotifs(out);
}

function normalizeMotifs(rawMotifs) {
  const motifs = Array.isArray(rawMotifs) ? rawMotifs : [];
  const safe = motifs.slice(0, 4).map((m) => {
    const mm = m && typeof m === 'object' ? m : {};
    const degreesRaw = Array.isArray(mm.degrees) ? mm.degrees : [];
    const rhythmRaw = Array.isArray(mm.rhythm) ? mm.rhythm : [];

    const degrees = degreesRaw
      .map((d) => clamp(d, 1, 14, 1))
      .filter((d) => Number.isFinite(d))
      .slice(0, 12);

    const rhythmChoices = [0.25, 0.5, 1, 2, 4];
    const rhythm = degrees.map((_, i) => {
      const r = Number(rhythmRaw[i] ?? 1);
      if (!Number.isFinite(r) || r <= 0) return 1;
      // snap to the closest supported rhythm
      let best = 1;
      let bestErr = Infinity;
      for (const c of rhythmChoices) {
        const err = Math.abs(r - c);
        if (err < bestErr) {
          bestErr = err;
          best = c;
        }
      }
      return best;
    });

    const finalDegrees = degrees.length ? degrees : [1, 3, 5, 3];
    const finalRhythm = rhythm.length ? rhythm : [1, 1, 1, 1];
    return { degrees: finalDegrees, rhythm: finalRhythm };
  });

  return safe.length ? safe : [{ degrees: [1, 3, 5, 3], rhythm: [1, 1, 1, 1] }];
}

function fitMeasuresToDuration(sections, { tempo, timeSignature, durationSec }) {
  const secs = Number(durationSec);
  if (!Number.isFinite(secs) || secs <= 0) return sections;
  const t = Number(tempo);
  if (!Number.isFinite(t) || t <= 0) return sections;

  const { measureBeats } = parseTimeSignature(timeSignature);
  const secPerMeasure = (measureBeats * 60) / t;
  if (!Number.isFinite(secPerMeasure) || secPerMeasure <= 0) return sections;

  const desired = Math.max(8, Math.min(160, Math.round(secs / secPerMeasure)));
  const weights = sections.map((s) => Math.max(1, Number(s.measures) || 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  const out = sections.map((s, i) => ({ ...s, measures: Math.max(4, Math.round((desired * weights[i]) / weightSum)) }));
  let sum = out.reduce((a, s) => a + (Number(s.measures) || 0), 0);
  // Adjust to match desired total exactly.
  let idx = 0;
  while (sum !== desired && idx < 5000) {
    const i = idx % out.length;
    if (sum < desired) {
      out[i].measures += 1;
      sum += 1;
    } else if (sum > desired && out[i].measures > 4) {
      out[i].measures -= 1;
      sum -= 1;
    }
    idx += 1;
  }

  return out;
}

function sanitizeMusicStructure(raw, request) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const valence = request?.valence;
  const durationSec = request?.duration;

  const requestedKey = request?.key || request?.requestedKey;
  const requestedForm = request?.form;
  const requestedTimeSignature = request?.timeSignature;
  const requestedTempo = request?.tempoBpm ?? request?.tempo;
  const cadencePlan = getCadencePlan(request?.cadencePlan);

  const key = normalizeKey(requestedKey || s.key, { valence });
  const tempo = clamp(
    requestedTempo ?? s.tempo,
    40,
    220,
    clamp(60 + clamp(request?.arousal, 0, 1, 0.5) * 80, 40, 220, 96)
  );
  const timeSignature = normalizeTimeSignature(requestedTimeSignature || s.timeSignature);

  const sections = Array.isArray(s.sections) ? s.sections : [];

  const safeSections = sections.slice(0, 8).map((sec, idx) => {
    const obj = sec && typeof sec === 'object' ? sec : {};

    const melody = obj.melody && typeof obj.melody === 'object' ? obj.melody : {};
    const safeMotifs = normalizeMotifs(melody.motifs);

    return {
      name: String(obj.name || String.fromCharCode(65 + (idx % 26))).slice(0, 20),
      measures: clamp(obj.measures, 1, 256, 8),
      chordProgression: obj.chordProgression,
      melody: { motifs: safeMotifs },
      dynamics: String(obj.dynamics || 'mf').slice(0, 4),
      texture: String(obj.texture || 'simple').slice(0, 24),
    };
  });

  const fittedSections = fitMeasuresToDuration(safeSections.length ? safeSections : [{
    name: 'A',
    measures: 8,
    chordProgression: normalizeChordProgression(['I', 'V', 'vi', 'IV'], { key }),
    melody: { motifs: normalizeMotifs([]) },
    dynamics: 'mf',
    texture: 'simple',
  }], { tempo, timeSignature, durationSec });

  const finalSections = fittedSections.map((sec, idx) => {
    const isLast = idx === fittedSections.length - 1;
    const cadenceType =
      cadencePlan === 'open-ended'
        ? 'half'
        : cadencePlan === 'closed-every-section'
        ? 'authentic'
        : isLast
        ? 'authentic'
        : 'half';

    const measures = Math.max(1, Number(sec.measures) || 1);
    const chordProgression = expandChordProgressionToMeasures(sec.chordProgression, measures, { key, cadenceType });

    const motifs = ensureMotifsForClassicalCadence(sec.melody?.motifs, { key });

    return {
      ...sec,
      measures,
      chordProgression,
      melody: { motifs },
    };
  });

  return {
    key,
    tempo,
    timeSignature,
    form: String(requestedForm || s.form || 'ABA').slice(0, 24),
    sections: finalSections,
    instrumentation: String(s.instrumentation || 'piano').slice(0, 40),
    character: String(s.character || '').slice(0, 160),
    reasoning: s.reasoning ? String(s.reasoning).slice(0, 1200) : undefined,
  };
}

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function getProviderPreference() {
  return String(process.env.LLM_PROVIDER ?? '').toLowerCase();
}

function hasOllamaConfigured() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL);
}

/**
 * Generate music structure using LLM
 * @param {Object} request - Music generation request
 * @param {number} request.valence - Emotional valence (-1 to 1)
 * @param {number} request.arousal - Arousal level (0 to 1)
 * @param {number} request.focus - Focus level (0 to 1)
 * @param {string[]} request.motif_tags - Artistic motif tags
 * @param {number} [request.duration=180] - Target duration in seconds
 * @param {string[]} [request.genre_palette] - Allowed genres (event flow uses at least classical+jazz)
 * @param {string} [request.primary_genre] - Primary genre hint (classical|jazz|hybrid)
 * @param {string[]} [request.instrumentation] - Instrument list hint
 * @param {Object} [request.timbre_arc] - Timbre plan for early/middle/late
 * @param {Object} [request.theme] - Theme object (title/keywords)
 * @param {Array} [request.personality_axes] - Personality axes used for instrument choice
 * @returns {Promise<Object>} Music structure
 */
export async function generateMusicStructure(request) {
  const providerPref = getProviderPreference();
  if (providerPref !== 'openai' && (providerPref === 'ollama' || (!openai && hasOllamaConfigured()))) {
    const {
      valence,
      arousal,
      focus,
      motif_tags,
      duration = 180,
      genre_palette,
      primary_genre,
      instrumentation,
      timbre_arc,
      theme,
      personality_axes,
    } = request;

    const systemPrompt = `You are a music composition assistant specializing in generating structured music data based on emotional parameters.

Your task is to generate a JSON structure representing a composition that can be rendered by a single-track MIDI prototype.
Prefer piano-first writing, but you may describe broader instrumentation in the metadata when requested.

Guidelines:
- Default to classical composition principles (motifs, development, recapitulation)
- Use classical forms (ABA, sonata, rondo, theme-and-variations)
- Use functional harmony and proper cadences
- If jazz influence is requested/allowed, incorporate it subtly (extended harmony, gentle syncopation) while keeping the overall form coherent
- Avoid modern/pop music patterns

Output ONLY valid JSON with this exact structure:
{
  "key": "string (e.g., 'd minor', 'C major')",
  "tempo": number (BPM),
  "timeSignature": "string (e.g., '3/4', '4/4')",
  "form": "string (e.g., 'ABA', 'theme-variation', 'rondo')",
  "sections": [
    {
      "name": "string (e.g., 'A', 'B')",
      "measures": number,
      "chordProgression": ["array", "of", "roman", "numerals"],
      "melody": {
        "motifs": [
          {
            "degrees": [1, 3, 5, 3],
            "rhythm": [0.5, 0.5, 1, 1]
          }
        ]
      },
      "dynamics": "string (pp, p, mp, mf, f, ff)",
      "texture": "string (simple, contrapuntal, homophonic)"
    }
  ],
  "instrumentation": "string (e.g., 'piano' or 'piano trio')",
  "character": "string describing emotional character",
  "reasoning": "brief explanation of why you chose this key, tempo, form, and other musical decisions"
}

Hard constraints for MIDI compatibility:
- timeSignature MUST be one of: "3/4", "4/4", "6/8" (recommended: 4/4)
- tempo MUST be a number (40..220)
- chordProgression MUST be exactly "measures" long (one chord per bar)
- chordProgression MUST use ONLY these diatonic roman numerals (no slashes, no 7ths):
  - Major mode: I, ii, iii, IV, V, vi, vii
  - Minor mode: i, III, iv, V, VI, VII (and optionally ii)
- degrees MUST be integers 1..7 (optionally up to 14 for octave shifts)
- rhythm values MUST be in beats and should be from: 0.25, 0.5, 1, 2, 4

Classical structure requirements:
- Prefer 4-bar phrases with clear cadences.
- Non-final sections should usually end with a HALF cadence (... V).
- The final section MUST end with an AUTHENTIC cadence (V -> I for major, V -> i for minor).
`;

    const constraintsBlock = `\n\nCreative constraints (optional):\n- Allowed genres: ${Array.isArray(genre_palette) && genre_palette.length ? genre_palette.join(', ') : 'classical'}\n- Primary genre hint: ${primary_genre || 'classical'}\n- Instrumentation hint: ${Array.isArray(instrumentation) && instrumentation.length ? instrumentation.join(', ') : 'piano'}\n- Timbre arc: ${timbre_arc ? JSON.stringify(timbre_arc) : 'n/a'}\n- Theme: ${theme ? JSON.stringify({ title: theme.title, keywords: theme.keywords }) : 'n/a'}\n- Personality axes: ${Array.isArray(personality_axes) ? JSON.stringify(personality_axes.slice(0, 3)) : 'n/a'}\n`;

    const prefLines = [];
    if (request?.key) prefLines.push(`Preferred key: ${String(request.key).slice(0, 32)}`);
    if (request?.tempoBpm || request?.tempo) prefLines.push(`Preferred tempo (BPM): ${Number(request.tempoBpm ?? request.tempo)}`);
    if (request?.timeSignature) prefLines.push(`Preferred timeSignature: ${String(request.timeSignature).slice(0, 12)}`);
    if (request?.form) prefLines.push(`Preferred form: ${String(request.form).slice(0, 32)}`);
    if (request?.cadencePlan) prefLines.push(`Cadence plan: ${String(request.cadencePlan).slice(0, 32)}`);
    if (Array.isArray(request?.composerHints) && request.composerHints.length) {
      prefLines.push(`Composer/era hints: ${request.composerHints.map((s) => String(s).slice(0, 24)).slice(0, 4).join(', ')}`);
    }

    const preferenceBlock = prefLines.length ? `\n\nPreferences:\n- ${prefLines.join('\n- ')}` : '';

    const userPrompt = `Generate a composition with the following emotional parameters:\n\nValence: ${Number(valence).toFixed(2)}\nArousal: ${Number(arousal).toFixed(2)}\nFocus: ${Number(focus).toFixed(2)}\nArtistic motifs: ${Array.isArray(motif_tags) ? motif_tags.join(', ') : ''}\nTarget duration: ${duration} seconds${preferenceBlock}\n\nCreate a composition that reflects these emotional qualities, staying within the allowed genre palette and respecting the timbre arc when provided.${constraintsBlock}`;

    const musicStructure = await ollamaChatJson({
      system: systemPrompt,
      user: userPrompt,
      temperature: getMusicTemperature(),
      maxTokens: 1800,
      model: process.env.OLLAMA_MODEL_MUSIC || process.env.OLLAMA_MODEL,
      debugTag: 'MusicLLM',
    });

    const sanitized = sanitizeMusicStructure(musicStructure, request);
    if (!sanitized?.key || !sanitized?.tempo || !sanitized?.sections?.length) {
      throw new Error('Invalid music structure from Ollama');
    }

    console.log('[MusicLLM] Generated music structure (ollama):', {
      key: musicStructure.key,
      tempo: musicStructure.tempo,
      form: musicStructure.form,
      sections: Array.isArray(musicStructure.sections) ? musicStructure.sections.length : 0,
    });

    return sanitized;
  }

  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const {
    valence,
    arousal,
    focus,
    motif_tags,
    duration = 180,
    genre_palette,
    primary_genre,
    instrumentation,
    timbre_arc,
    theme,
    personality_axes,
  } = request;

  // Build the system prompt for music generation
  const systemPrompt = `You are a music composition assistant specializing in generating structured music data based on emotional parameters.

Your task is to generate a JSON structure representing a composition that can be rendered by a single-track MIDI prototype.
Prefer piano-first writing, but you may describe broader instrumentation in the metadata when requested.

Guidelines:
- Default to classical composition principles (motifs, development, recapitulation)
- Use classical forms (ABA, sonata, rondo, theme-and-variations)
- Use functional harmony and proper cadences
- If jazz influence is requested/allowed, incorporate it subtly (extended harmony, gentle syncopation) while keeping the overall form coherent
- Avoid modern/pop music patterns

Emotional Parameter Interpretation:
- Valence (-1 to +1): negative = minor keys, descending motifs, darker harmonies; positive = major keys, ascending motifs, brighter harmonies
- Arousal (0 to 1): low = slower tempo, sparse texture, legato; high = faster tempo, rhythmic drive, forte dynamics
- Focus (0 to 1): influences structural clarity and development complexity

Output ONLY valid JSON with this exact structure:
{
  "key": "string (e.g., 'd minor', 'C major')",
  "tempo": number (BPM),
  "timeSignature": "string (e.g., '3/4', '4/4')",
  "form": "string (e.g., 'ABA', 'theme-variation', 'rondo')",
  "sections": [
    {
      "name": "string (e.g., 'A', 'B')",
      "measures": number,
      "chordProgression": ["array", "of", "roman", "numerals"],
      "melody": {
        "motifs": [
          {
            "degrees": [1, 3, 5, 3],
            "rhythm": [0.5, 0.5, 1, 1]
          }
        ]
      },
      "dynamics": "string (pp, p, mp, mf, f, ff)",
      "texture": "string (simple, contrapuntal, homophonic)"
    }
  ],
  "instrumentation": "string (e.g., 'piano' or 'piano trio')",
  "character": "string describing emotional character",
  "reasoning": "brief explanation of why you chose this key, tempo, form, and other musical decisions"
}

Hard constraints for MIDI compatibility:
- timeSignature MUST be one of: "3/4", "4/4", "6/8" (recommended: 4/4)
- tempo MUST be a number (40..220)
- chordProgression MUST be exactly "measures" long (one chord per bar)
- chordProgression MUST use ONLY these diatonic roman numerals (no slashes, no 7ths):
  - Major mode: I, ii, iii, IV, V, vi, vii
  - Minor mode: i, III, iv, V, VI, VII (and optionally ii)
- degrees MUST be integers 1..7 (optionally up to 14 for octave shifts)
- rhythm values MUST be in beats and should be from: 0.25, 0.5, 1, 2, 4

Classical structure requirements:
- Prefer 4-bar phrases with clear cadences.
- Non-final sections should usually end with a HALF cadence (… V).
- The final section MUST end with an AUTHENTIC cadence (V -> I for major, V -> i for minor).
`;

  const constraintsBlock = `\n\nCreative constraints (optional):\n- Allowed genres: ${Array.isArray(genre_palette) && genre_palette.length ? genre_palette.join(', ') : 'classical'}\n- Primary genre hint: ${primary_genre || 'classical'}\n- Instrumentation hint: ${Array.isArray(instrumentation) && instrumentation.length ? instrumentation.join(', ') : 'piano'}\n- Timbre arc: ${timbre_arc ? JSON.stringify(timbre_arc) : 'n/a'}\n- Theme: ${theme ? JSON.stringify({ title: theme.title, keywords: theme.keywords }) : 'n/a'}\n- Personality axes: ${Array.isArray(personality_axes) ? JSON.stringify(personality_axes.slice(0, 3)) : 'n/a'}\n`;

  const prefLines = [];
  if (request?.key) prefLines.push(`Preferred key: ${String(request.key).slice(0, 32)}`);
  if (request?.tempoBpm || request?.tempo) prefLines.push(`Preferred tempo (BPM): ${Number(request.tempoBpm ?? request.tempo)}`);
  if (request?.timeSignature) prefLines.push(`Preferred timeSignature: ${String(request.timeSignature).slice(0, 12)}`);
  if (request?.form) prefLines.push(`Preferred form: ${String(request.form).slice(0, 32)}`);
  if (request?.cadencePlan) prefLines.push(`Cadence plan: ${String(request.cadencePlan).slice(0, 32)}`);
  if (Array.isArray(request?.composerHints) && request.composerHints.length) {
    prefLines.push(`Composer/era hints: ${request.composerHints.map((s) => String(s).slice(0, 24)).slice(0, 4).join(', ')}`);
  }

  const preferenceBlock = prefLines.length ? `\n\nPreferences:\n- ${prefLines.join('\n- ')}` : '';

  const userPrompt = `Generate a composition with the following emotional parameters:

Valence: ${valence.toFixed(2)} (${valence < -0.3 ? 'negative/sad' : valence > 0.3 ? 'positive/happy' : 'neutral'})
Arousal: ${arousal.toFixed(2)} (${arousal < 0.3 ? 'calm' : arousal > 0.7 ? 'energetic' : 'moderate'})
Focus: ${focus.toFixed(2)} (${focus < 0.3 ? 'diffuse' : focus > 0.7 ? 'concentrated' : 'balanced'})
Artistic motifs: ${motif_tags.join(', ')}
Target duration: ${duration} seconds
${preferenceBlock}

Create a composition that reflects these emotional qualities, staying within the allowed genre palette and respecting the timbre arc when provided.${constraintsBlock}`;

  try {
    const attempt = async (temperature, strictTag) => {
      const completion = await openai.chat.completions.create({
        model: getMusicModel(),
        messages: [
          {
            role: 'system',
            content:
              systemPrompt +
              (strictTag
                ? '\n\nSTRICT MODE: Output ONLY valid JSON. Ensure types: tempo/measures are numbers, arrays are arrays.'
                : ''),
          },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 2200,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No content in LLM response');
      const parsed = parseJsonLoose(content);
      if (parsed == null) throw new Error('Music JSON parse failed');
      const sanitized = sanitizeMusicStructure(parsed, request);
      if (!sanitized.key || !sanitized.tempo || !Array.isArray(sanitized.sections) || !sanitized.sections.length) {
        throw new Error('Invalid music structure from LLM');
      }
      return sanitized;
    };

    let musicStructure;
    try {
      musicStructure = await attempt(getMusicTemperature(), false);
    } catch (e) {
      console.warn('[MusicLLM] First attempt invalid; retrying strict mode');
      musicStructure = await attempt(0.2, true);
    }

    console.log('[MusicLLM] Generated music structure:', {
      key: musicStructure.key,
      tempo: musicStructure.tempo,
      form: musicStructure.form,
      sections: musicStructure.sections.length,
    });

    return musicStructure;
  } catch (error) {
    console.error('[MusicLLM] Error generating music structure:', error);
    throw error;
  }
}

/**
 * Generate music structure with fallback to rule-based generation
 * @param {Object} request - Music generation request
 * @returns {Promise<Object>} Music structure and provider info
 */
export async function generateMusicStructureWithFallback(request) {
  try {
    const structure = await generateMusicStructure(request);
    const providerPref = getProviderPreference();
    const provider = providerPref === 'ollama' || (!openai && hasOllamaConfigured()) ? 'ollama' : 'openai';
    return { structure, provider };
  } catch (error) {
    console.warn('[MusicLLM] Falling back to rule-based generation:', error);
    const structure = generateRuleBasedMusic(request);
    return { structure, provider: 'rule-based' };
  }
}

/**
 * Rule-based music generation fallback
 * @param {Object} request - Music generation request
 * @returns {Object} Music structure
 */
function generateRuleBasedMusic(request) {
  const { valence, arousal, focus, motif_tags, instrumentation, primary_genre } = request;

  // Determine key based on valence
  const key = valence < 0 ? 'd minor' : 'C major';

  // Determine tempo based on arousal (40-160 BPM range)
  const tempo = Math.round(60 + arousal * 80);

  // Determine time signature based on focus
  const timeSignature = focus > 0.6 ? '4/4' : '3/4';

  // Determine form based on focus
  const form = focus > 0.5 ? 'ABA' : 'theme-variation';

  // Determine dynamics based on arousal
  const dynamics = arousal < 0.3 ? 'p' : arousal > 0.7 ? 'f' : 'mf';

  // Create simple sections
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

  // Add return to A if form is ABA
  if (form === 'ABA') {
    sections.push({
      ...sections[0],
      name: 'A (reprise)',
    });
  }

  const character = `${valence < 0 ? 'melancholic' : 'uplifting'} and ${arousal < 0.5 ? 'calm' : 'energetic'}`;

  return {
    key,
    tempo,
    timeSignature,
    form,
    sections,
    instrumentation: Array.isArray(instrumentation) && instrumentation.length
      ? instrumentation.join(', ')
      : primary_genre === 'jazz'
      ? 'piano (jazz-influenced)'
      : 'piano',
    character,
  };
}
