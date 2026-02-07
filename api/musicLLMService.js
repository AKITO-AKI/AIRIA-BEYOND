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

function normalizePeriod(p) {
  const s = String(p ?? '').trim().toLowerCase();
  if (!s) return '';
  if (['baroque', 'baroq', 'barok'].includes(s)) return 'baroque';
  if (['classical', 'classic', 'viennese'].includes(s)) return 'classical';
  if (['romantic', 'rom'].includes(s)) return 'romantic';
  if (['modern', '20c', '20th', 'impressionist', 'neoclassical'].includes(s)) return 'modern';
  return s.slice(0, 24);
}

function normalizeForm(f) {
  const s = String(f ?? '').trim().toLowerCase();
  if (!s) return '';
  if (['aba', 'ternary'].includes(s)) return 'ABA';
  if (['rondo', 'abaca', 'abacaba'].includes(s)) return 'rondo';
  if (['theme-variation', 'theme-variations', 'theme and variations', 'variations'].includes(s)) return 'theme-variation';
  if (['sonata', 'sonata-allegro', 'sonata allegro'].includes(s)) return 'sonata';
  if (['minuet', 'minuet-trio', 'minuet and trio', 'scherzo'].includes(s)) return 'minuet-trio';
  return String(f).slice(0, 24);
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

function relatedKey(key, kind) {
  const k = normalizeKey(key);
  const map = {
    'C major': { dominant: 'G major', subdominant: 'F major', relMinor: 'a minor' },
    'D major': { dominant: 'A major', subdominant: 'G major', relMinor: 'b minor' },
    'E major': { dominant: 'B major', subdominant: 'A major', relMinor: 'c minor' },
    'F major': { dominant: 'C major', subdominant: 'B major', relMinor: 'd minor' },
    'G major': { dominant: 'D major', subdominant: 'C major', relMinor: 'e minor' },
    'A major': { dominant: 'E major', subdominant: 'D major', relMinor: 'f minor' },
    'B major': { dominant: 'F major', subdominant: 'E major', relMinor: 'g minor' },
    'c minor': { dominant: 'G major', subdominant: 'f minor', relMajor: 'E major' },
    'd minor': { dominant: 'A major', subdominant: 'g minor', relMajor: 'F major' },
    'e minor': { dominant: 'B major', subdominant: 'a minor', relMajor: 'G major' },
    'f minor': { dominant: 'C major', subdominant: 'b minor', relMajor: 'A major' },
    'g minor': { dominant: 'D major', subdominant: 'c minor', relMajor: 'B major' },
    'a minor': { dominant: 'E major', subdominant: 'd minor', relMajor: 'C major' },
    'b minor': { dominant: 'F major', subdominant: 'e minor', relMajor: 'D major' },
  };

  const entry = map[k];
  if (!entry) return k;
  if (kind === 'dominant') return entry.dominant || k;
  if (kind === 'subdominant') return entry.subdominant || k;
  if (kind === 'relative') return entry.relMajor || entry.relMinor || k;
  return k;
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

  // Prefer functional-harmony defaults (avoid pop-loop feel).
  const fallback = mode === 'minor' ? ['i', 'iv', 'V', 'i'] : ['I', 'ii', 'V', 'I'];
  const use = degrees.length ? degrees : fallback.map((c) => romanDegreeFromText(c)).filter(Boolean);
  const normalized = use.map((d) => romanForDegree(d, mode));
  const uniq = normalized.filter(Boolean);
  return uniq.length ? uniq.slice(0, 32) : fallback;
}

function applyCadence(chords, { mode, cadence }) {
  const prog = Array.isArray(chords) ? chords.filter(Boolean).map((c) => String(c).trim()).filter(Boolean) : [];
  const tonic = mode === 'minor' ? 'i' : 'I';
  const picardyTonic = mode === 'minor' ? 'I' : tonic;
  const dominant = 'V';
  const submediant = mode === 'minor' ? 'VI' : 'vi';

  if (!prog.length) return cadence === 'HC' ? [tonic, dominant] : [tonic, dominant, tonic];

  // Ensure starts on tonic-ish.
  if (romanDegreeFromText(prog[0]) !== 1) {
    prog.unshift(tonic);
  }

  if (cadence === 'HC') {
    prog[prog.length - 1] = dominant;
    return prog.slice(0, 32);
  }
  if (cadence === 'DC') {
    // V -> vi/VI
    if (prog.length < 2) prog.push(dominant);
    prog[prog.length - 2] = dominant;
    prog[prog.length - 1] = submediant;
    return prog.slice(0, 32);
  }

  if (cadence === 'PICARDY') {
    // Picardy third: minor-key resolution to major tonic.
    // For major mode, treat as a normal cadence.
    if (prog.length < 2) prog.push(dominant);
    prog[prog.length - 2] = dominant;
    prog[prog.length - 1] = picardyTonic;
    return prog.slice(0, 32);
  }

  // Default PAC/IAC-ish: ... V - I
  if (prog.length < 2) prog.push(dominant);
  prog[prog.length - 2] = dominant;
  prog[prog.length - 1] = tonic;
  return prog.slice(0, 32);
}

function normalizeHarmonicFunctions(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const allowed = new Set(['tension', 'release', 'ambiguity']);
  const out = [];
  for (const v of arr) {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) continue;
    if (allowed.has(s)) out.push(s);
  }
  return out.length ? out.slice(0, 64) : undefined;
}

function normalizeLeitmotifs(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const item of arr.slice(0, 6)) {
    const obj = item && typeof item === 'object' ? item : {};
    const tag = String(obj.tag ?? obj.keyword ?? '').trim().slice(0, 32);
    if (!tag) continue;
    const motif = obj.motif && typeof obj.motif === 'object' ? obj.motif : obj;
    const motifs = normalizeMotifs([{ degrees: motif.degrees, rhythm: motif.rhythm }]);
    const m0 = motifs[0];
    out.push({
      tag,
      degrees: m0.degrees,
      rhythm: m0.rhythm,
      meaning: obj.meaning ? String(obj.meaning).slice(0, 160) : undefined,
      transformations: Array.isArray(obj.transformations)
        ? obj.transformations.map((t) => String(t).slice(0, 48)).filter(Boolean).slice(0, 8)
        : undefined,
    });
  }
  return out.length ? out : undefined;
}

function normalizeHumanize(raw, request) {
  const obj = raw && typeof raw === 'object' ? raw : {};

  const rubatoRaw = String(obj.rubato ?? obj.rubatoLevel ?? '').trim().toLowerCase();
  const rubato = rubatoRaw === 'expressive' || rubatoRaw === 'strong'
    ? 'expressive'
    : rubatoRaw === 'subtle' || rubatoRaw === 'light'
      ? 'subtle'
      : 'none';

  const phraseCurveRaw = String(obj.velocityCurve ?? obj.dynamicsCurve ?? '').trim().toLowerCase();
  const velocityCurve = phraseCurveRaw === 'phrase' || phraseCurveRaw === 'arc' ? 'phrase' : 'flat';

  const peakBoost = clamp(obj.peakBoost ?? obj.peak_boost, 0, 0.6, 0.22);
  const phraseEndSoftness = clamp(obj.phraseEndSoftness ?? obj.phrase_end_softness, 0, 0.8, 0.35);

  // Allow explicit request overrides (future UI use); keep optional.
  const requestHumanize = request?.humanize && typeof request.humanize === 'object' ? request.humanize : null;
  const requestRubato = requestHumanize ? String(requestHumanize.rubato ?? '').toLowerCase() : '';
  const rubatoFinal = requestRubato === 'subtle' || requestRubato === 'expressive' || requestRubato === 'none'
    ? requestRubato
    : rubato;

  return {
    rubato: rubatoFinal || rubato,
    velocityCurve,
    peakBoost,
    phraseEndSoftness,
  };
}

function normalizeMotifSeed(seed) {
  const arr = Array.isArray(seed) ? seed : [];
  const degrees = arr.map((d) => clamp(d, 1, 14, 1)).filter((d) => Number.isFinite(d)).slice(0, 12);
  return degrees.length ? degrees : null;
}

function normalizeRhythmSeed(seed) {
  const arr = Array.isArray(seed) ? seed : [];
  const choices = [0.25, 0.5, 1, 2, 4];
  const out = [];
  for (const r0 of arr) {
    const r = Number(r0);
    if (!Number.isFinite(r) || r <= 0) continue;
    let best = 1;
    let bestErr = Infinity;
    for (const c of choices) {
      const err = Math.abs(r - c);
      if (err < bestErr) {
        bestErr = err;
        best = c;
      }
    }
    out.push(best);
  }
  return out.length ? out.slice(0, 12) : null;
}

function varyMotif(motif, variation) {
  const m = motif && typeof motif === 'object' ? motif : {};
  const degrees = Array.isArray(m.degrees) ? m.degrees.map((d) => clamp(d, 1, 14, 1)) : [1, 3, 5, 3];
  const rhythm = Array.isArray(m.rhythm) ? m.rhythm.map((r) => Number(r) || 1) : [1, 1, 1, 1];

  const clampDeg = (d) => clamp(d, 1, 14, 1);
  const snapRh = (r) => {
    const choices = [0.25, 0.5, 1, 2, 4];
    let best = 1;
    let bestErr = Infinity;
    for (const c of choices) {
      const err = Math.abs((Number(r) || 1) - c);
      if (err < bestErr) {
        bestErr = err;
        best = c;
      }
    }
    return best;
  };

  if (variation === 'sequence-up') {
    return {
      degrees: degrees.map((d) => clampDeg(d + 1)),
      rhythm: rhythm.map((r) => snapRh(r)),
    };
  }
  if (variation === 'sequence-down') {
    return {
      degrees: degrees.map((d) => clampDeg(d - 1)),
      rhythm: rhythm.map((r) => snapRh(r)),
    };
  }
  if (variation === 'inversion') {
    const center = clampDeg(degrees[0] || 1);
    return {
      degrees: degrees.map((d) => clampDeg(center + (center - clampDeg(d)))),
      rhythm: rhythm.map((r) => snapRh(r)),
    };
  }
  if (variation === 'augmentation') {
    return {
      degrees: degrees.map((d) => clampDeg(d)),
      rhythm: rhythm.map((r) => snapRh((Number(r) || 1) * 2)),
    };
  }
  if (variation === 'diminution') {
    return {
      degrees: degrees.map((d) => clampDeg(d)),
      rhythm: rhythm.map((r) => snapRh((Number(r) || 1) / 2)),
    };
  }
  return {
    degrees: degrees.map((d) => clampDeg(d)),
    rhythm: rhythm.map((r) => snapRh(r)),
  };
}

function buildClassicalPlan(request, { key, tempo, timeSignature }) {
  const form = normalizeForm(request?.form) || (Number(request?.focus) > 0.72 ? 'sonata' : Number(request?.focus) > 0.5 ? 'ABA' : 'theme-variation');
  const period = normalizePeriod(request?.period);
  const mode = modeFromKey(key);

  // baseline measures allocation by form; final measures will be fit-to-duration.
  const base = {
    ABA: [
      { name: 'A', role: 'theme', weight: 1.0, key: key, cadence: 'PAC', variation: 'none' },
      { name: 'B', role: 'contrast', weight: 1.0, key: relatedKey(key, mode === 'minor' ? 'relative' : 'dominant'), cadence: 'HC', variation: 'sequence-up' },
      { name: "A'", role: 'return', weight: 1.0, key: key, cadence: 'PAC', variation: 'inversion' },
    ],
    rondo: [
      { name: 'A', role: 'refrain', weight: 1.0, key: key, cadence: 'PAC', variation: 'none' },
      { name: 'B', role: 'episode', weight: 0.9, key: relatedKey(key, 'dominant'), cadence: 'PAC', variation: 'sequence-up' },
      { name: 'A2', role: 'refrain', weight: 0.8, key: key, cadence: 'PAC', variation: 'diminution' },
      { name: 'C', role: 'episode', weight: 0.9, key: relatedKey(key, 'subdominant'), cadence: 'HC', variation: 'inversion' },
      { name: 'A3', role: 'refrain', weight: 1.0, key: key, cadence: 'PAC', variation: 'augmentation' },
    ],
    'theme-variation': [
      { name: 'Theme', role: 'theme', weight: 1.0, key: key, cadence: 'PAC', variation: 'none' },
      { name: 'Var.1', role: 'variation', weight: 0.9, key: key, cadence: 'PAC', variation: 'diminution' },
      { name: 'Var.2', role: 'variation', weight: 0.9, key: relatedKey(key, 'relative'), cadence: 'PAC', variation: 'sequence-up' },
      { name: 'Var.3', role: 'variation', weight: 0.9, key: key, cadence: 'PAC', variation: 'inversion' },
      { name: 'Coda', role: 'coda', weight: 0.6, key: key, cadence: 'PAC', variation: 'augmentation' },
    ],
    sonata: [
      { name: 'Exposition (P)', role: 'exposition', weight: 1.0, key: key, cadence: 'HC', variation: 'none' },
      { name: 'Exposition (S)', role: 'exposition', weight: 1.1, key: relatedKey(key, mode === 'minor' ? 'relative' : 'dominant'), cadence: 'PAC', variation: 'sequence-up' },
      { name: 'Development', role: 'development', weight: 1.0, key: relatedKey(key, 'subdominant'), cadence: 'HC', variation: 'inversion' },
      { name: 'Recapitulation', role: 'recap', weight: 1.2, key: key, cadence: 'PAC', variation: 'augmentation' },
      { name: 'Coda', role: 'coda', weight: 0.6, key: key, cadence: 'PAC', variation: 'none' },
    ],
    'minuet-trio': [
      { name: 'Minuet', role: 'dance', weight: 1.0, key: key, cadence: 'PAC', variation: 'none' },
      { name: 'Trio', role: 'dance', weight: 1.0, key: relatedKey(key, 'subdominant'), cadence: 'PAC', variation: 'sequence-down' },
      { name: 'Minuet da capo', role: 'dance', weight: 1.0, key: key, cadence: 'PAC', variation: 'diminution' },
    ],
  };

  const sections = base[form] || base.ABA;
  const totalWeight = sections.reduce((a, s) => a + (Number(s.weight) || 1), 0) || 1;
  const durationSec = Number(request?.duration);
  let desiredMeasures = null;
  if (Number.isFinite(durationSec) && durationSec > 0) {
    const { measureBeats } = parseTimeSignature(timeSignature);
    const secPerMeasure = (measureBeats * 60) / Math.max(1, Number(tempo) || 90);
    desiredMeasures = Math.max(12, Math.min(220, Math.round(durationSec / Math.max(0.001, secPerMeasure))));
  }

  const seeded = sections.map((s) => ({
    ...s,
    measures: desiredMeasures
      ? Math.max(6, Math.round((desiredMeasures * (Number(s.weight) || 1)) / totalWeight))
      : 8,
  }));

  return { form, period, sections: seeded };
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

  const requestKey = request?.key || request?.music_key;
  const key = normalizeKey(requestKey || s.key, { valence });
  const tempoHint = request?.tempo ?? request?.bpm;
  const tempo = clamp(
    tempoHint != null ? tempoHint : s.tempo,
    40,
    220,
    clamp(60 + clamp(request?.arousal, 0, 1, 0.5) * 80, 40, 220, 96)
  );
  const timeSignature = normalizeTimeSignature(request?.timeSignature || request?.time_signature || s.timeSignature);
  const reqForm = normalizeForm(request?.form);
  const form = reqForm || String(s.form || 'ABA').slice(0, 24);
  const period = normalizePeriod(request?.period);

  const plan = buildClassicalPlan(request, { key, tempo, timeSignature });

  const leitmotifs = normalizeLeitmotifs(s.leitmotifs || s.leitMotifs || s.leit_motifs);
  const humanize = normalizeHumanize(s.humanize || s.humanization || s.performance, request);

  const sections = Array.isArray(s.sections) ? s.sections : [];

  const safeSections = sections.slice(0, 12).map((sec, idx) => {
    const obj = sec && typeof sec === 'object' ? sec : {};

    const sectionKey = normalizeKey(obj.key || obj.localKey || obj.sectionKey || plan?.sections?.[idx]?.key || key, { valence });
    const mode = modeFromKey(sectionKey);
    const cadenceRaw = String(obj.cadence || obj.cadenceType || plan?.sections?.[idx]?.cadence || 'PAC').toUpperCase();
    const cadence = cadenceRaw.includes('PIC') ? 'PICARDY' : cadenceRaw === 'HC' ? 'HC' : cadenceRaw === 'DC' ? 'DC' : 'PAC';

    const melody = obj.melody && typeof obj.melody === 'object' ? obj.melody : {};
    const safeMotifs = normalizeMotifs(melody.motifs);

    const chordProgressionBase = normalizeChordProgression(obj.chordProgression, { key: sectionKey });
    const chordProgression = applyCadence(chordProgressionBase, { mode, cadence });

    const harmonicFunctions = normalizeHarmonicFunctions(obj.harmonicFunctions || obj.harmonic_functions || obj.emotional_function);

    return {
      name: String(obj.name || String.fromCharCode(65 + (idx % 26))).slice(0, 20),
      measures: clamp(obj.measures, 1, 256, 8),
      key: sectionKey,
      chordProgression,
      melody: { motifs: safeMotifs },
      dynamics: String(obj.dynamics || 'mf').slice(0, 4),
      texture: String(obj.texture || 'simple').slice(0, 24),
      cadence: cadence === 'PICARDY' ? 'PICARDY' : cadence,
      harmonicFunctions,
    };
  });

  // If the model didn't provide enough sections, seed from the plan.
  let seededSections = safeSections;
  if (!seededSections.length && plan?.sections?.length) {
    seededSections = plan.sections.map((p) => {
      const sectionKey = normalizeKey(p.key || key, { valence });
      const mode = modeFromKey(sectionKey);
      const chords = applyCadence(normalizeChordProgression([], { key: sectionKey }), { mode, cadence: p.cadence || 'PAC' });
      return {
        name: String(p.name || 'A').slice(0, 20),
        measures: clamp(p.measures, 1, 256, 8),
        key: sectionKey,
        chordProgression: chords,
        melody: { motifs: normalizeMotifs([]) },
        dynamics: 'mf',
        texture: period === 'baroque' ? 'contrapuntal' : 'homophonic',
      };
    });
  }

  // Apply motif seeding + development for stronger classical unity.
  const motifSeedDegrees = normalizeMotifSeed(request?.motif_seed || request?.motifSeedDegrees);
  const rhythmSeed = normalizeRhythmSeed(request?.rhythm_seed || request?.rhythmSeed);

  const leitBase = leitmotifs?.[0]
    ? { degrees: leitmotifs[0].degrees, rhythm: leitmotifs[0].rhythm }
    : null;
  const baseMotif = {
    degrees: motifSeedDegrees || leitBase?.degrees || (seededSections?.[0]?.melody?.motifs?.[0]?.degrees ?? [1, 3, 5, 3]),
    rhythm: rhythmSeed || leitBase?.rhythm || (seededSections?.[0]?.melody?.motifs?.[0]?.rhythm ?? [1, 1, 1, 1]),
  };

  const developedSections = seededSections.map((sec, idx) => {
    const planVar = plan?.sections?.[idx]?.variation || 'none';
    const variation = idx === 0 ? 'none' : planVar;
    const motif = variation === 'none' ? varyMotif(baseMotif, 'none') : varyMotif(baseMotif, variation);
    const extraLeit = Array.isArray(leitmotifs)
      ? leitmotifs.slice(1, 3).map((m) => ({ degrees: m.degrees, rhythm: m.rhythm }))
      : [];
    return {
      ...sec,
      melody: {
        motifs: Array.isArray(sec?.melody?.motifs) && sec.melody.motifs.length
          ? sec.melody.motifs
          : [motif, ...extraLeit].slice(0, 4),
      },
    };
  });

  const fittedSections = fitMeasuresToDuration(developedSections.length ? developedSections : [{
    name: 'A',
    measures: 8,
    key,
    chordProgression: applyCadence(normalizeChordProgression(['I', 'V', 'vi', 'IV'], { key }), { mode: modeFromKey(key), cadence: 'PAC' }),
    melody: { motifs: normalizeMotifs([]) },
    dynamics: 'mf',
    texture: 'simple',
  }], { tempo, timeSignature, durationSec });

  return {
    key,
    tempo,
    timeSignature,
    form: String(form || plan.form || 'ABA').slice(0, 24),
    sections: fittedSections,
    instrumentation: String(request?.instrumentation ?? s.instrumentation ?? 'piano').slice(0, 40),
    character: String(s.character || '').slice(0, 160),
    reasoning: s.reasoning ? String(s.reasoning).slice(0, 1200) : undefined,
    leitmotifs,
    humanize,
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
      emotional_arc,
      key: requestKey,
      tempo: requestTempo,
      timeSignature: requestTimeSignature,
      form: requestForm,
      period,
      motif_seed,
      rhythm_seed,
      section_plan,
    } = request;

    const keyHint = normalizeKey(requestKey, { valence });
    const tempoHint = clamp(requestTempo, 40, 220, null);
    const timeSigHint = normalizeTimeSignature(requestTimeSignature);
    const formHint = normalizeForm(requestForm);
    const plan = buildClassicalPlan(request, {
      key: keyHint,
      tempo: tempoHint || Math.round(60 + clamp(arousal, 0, 1, 0.5) * 80),
      timeSignature: timeSigHint,
    });

    const systemPrompt = `You are a music composition assistant specializing in generating structured music data based on emotional parameters.

Your task is to generate a JSON structure representing a composition that can be rendered by a single-track MIDI prototype.
Prefer piano-first writing, but you may describe broader instrumentation in the metadata when requested.

Guidelines:
- Default to classical composition principles (motifs, development, recapitulation)
- Use classical forms (ABA, sonata, rondo, theme-and-variations)
- Use functional harmony and proper cadences
- If jazz influence is requested/allowed, incorporate it subtly (extended harmony, gentle syncopation) while keeping the overall form coherent
- Avoid modern/pop music patterns

Artistic "soul" requirements:
- Map psychological tension/release to harmonic resolution:
  - unresolved/conflicted: prefer HC or DC (deceptive), and carry dominant tension across section boundaries
  - overcome/acceptance: prefer strong PAC; in minor keys you MAY use a Picardy third cadence (PICARDY) for redemption
  - complex/ambiguous: use modal color by emphasizing non-tonic scale degrees (ii/IV in major; iv/VI in minor) and avoid overly-final cadences
- Use leitmotifs: pick 2–3 theme keywords and define short motifs (degrees+rhythm). Reintroduce them with variation (sequence, inversion, augmentation, diminution).
- Humanize performance (MIDI-friendly): describe rubato level + velocity shaping (peak emphasis, phrase-end softening).

Output ONLY valid JSON with this exact structure:
{
  "key": "string (e.g., 'd minor', 'C major')",
  "tempo": number (BPM),
  "timeSignature": "string (e.g., '3/4', '4/4')",
  "form": "string (e.g., 'ABA', 'theme-variation', 'rondo')",
  "sections": [
    {
      "name": "string (e.g., 'A', 'B')",
      "key": "optional local key for this section (e.g., 'G major')",
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
      "texture": "string (simple, contrapuntal, homophonic)",
      "cadence": "optional cadence goal (HC|PAC|DC|PICARDY)",
      "harmonicFunctions": ["optional", "array", "of", "tension|release|ambiguity", "aligned", "to", "chords"]
    }
  ],
  "leitmotifs": [
    {
      "tag": "string (picked from theme keywords)",
      "degrees": [1, 3, 5, 3],
      "rhythm": [0.5, 0.5, 1, 1],
      "meaning": "optional short meaning",
      "transformations": ["optional variation hints"]
    }
  ],
  "humanize": {
    "rubato": "none|subtle|expressive",
    "velocityCurve": "flat|phrase",
    "peakBoost": 0.0,
    "phraseEndSoftness": 0.0
  },
  "instrumentation": "string (e.g., 'piano' or 'piano trio')",
  "character": "string describing emotional character",
  "reasoning": "brief explanation of why you chose this key, tempo, form, and other musical decisions"
}

Hard constraints for MIDI compatibility:
- timeSignature MUST be one of: "3/4", "4/4", "6/8" (recommended: 4/4)
- tempo MUST be a number (40..220)
- section.key (if provided) MUST be one of: C major, c minor, D major, d minor, E major, e minor, F major, f minor, G major, g minor, A major, a minor, B major, b minor
- chordProgression MUST use ONLY these diatonic roman numerals (no slashes, no 7ths):
  - Major mode: I, ii, iii, IV, V, vi, vii
  - Minor mode: i, III, iv, V, VI, VII (and optionally ii)
- degrees MUST be integers 1..7 (optionally up to 14 for octave shifts)
- rhythm values MUST be in beats and should be from: 0.25, 0.5, 1, 2, 4
`;

    const constraintsBlock = `\n\nCreative constraints (optional):\n- Period/era: ${normalizePeriod(period) || 'classical'}\n- Preferred form: ${formHint || plan.form}\n- Preferred key (global): ${requestKey ? normalizeKey(requestKey, { valence }) : 'auto'}\n- Tempo hint: ${tempoHint ?? 'auto'}\n- Time signature hint: ${requestTimeSignature ? normalizeTimeSignature(requestTimeSignature) : 'auto'}\n- Motif seed degrees: ${Array.isArray(motif_seed) ? JSON.stringify(motif_seed.slice(0, 12)) : 'n/a'}\n- Rhythm seed (beats): ${Array.isArray(rhythm_seed) ? JSON.stringify(rhythm_seed.slice(0, 12)) : 'n/a'}\n- Section plan override: ${section_plan ? JSON.stringify(section_plan).slice(0, 600) : 'n/a'}\n- Allowed genres: ${Array.isArray(genre_palette) && genre_palette.length ? genre_palette.join(', ') : 'classical'}\n- Primary genre hint: ${primary_genre || 'classical'}\n- Instrumentation hint: ${Array.isArray(instrumentation) && instrumentation.length ? instrumentation.join(', ') : 'piano'}\n- Timbre arc: ${timbre_arc ? JSON.stringify(timbre_arc) : 'n/a'}\n- Theme: ${theme ? JSON.stringify({ title: theme.title, keywords: theme.keywords }) : 'n/a'}\n- Emotional arc: ${emotional_arc ? JSON.stringify(emotional_arc).slice(0, 600) : 'n/a'}\n- Personality axes: ${Array.isArray(personality_axes) ? JSON.stringify(personality_axes.slice(0, 3)) : 'n/a'}\n\nSection plan you MUST follow (names, approximate measures, section keys, cadence goals):\n${JSON.stringify(plan.sections.map((s) => ({ name: s.name, measures: s.measures, key: s.key, cadence: s.cadence })), null, 2)}\n`;

    const userPrompt = `Generate a single cohesive classical piece (not a loop) with the following emotional parameters:\n\nValence: ${Number(valence).toFixed(2)}\nArousal: ${Number(arousal).toFixed(2)}\nFocus: ${Number(focus).toFixed(2)}\nArtistic motifs: ${Array.isArray(motif_tags) ? motif_tags.join(', ') : ''}\nTarget duration: ${duration} seconds\n\nClassical-theory requirements:\n- Use clear phrase structure (often 4+4 or 8-bar periods) and motivic unity across sections\n- Use functional harmony and cadences at section endings (HC/PAC)\n- Use development techniques (sequence, inversion, augmentation/diminution) especially in development/variation sections\n- Avoid pop-loop progressions and avoid random chord jumps\n\nNow add artistic depth:\n- Define 2–3 leitmotifs from the theme keywords (tagged), and restate them later with variation.\n- Annotate chord functions with tension/release/ambiguity where it helps the narrative (optional).\n- Add humanize guidance (rubato + velocity shaping) compatible with MIDI.${constraintsBlock}`;

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
    emotional_arc,
    key: requestKey,
    tempo: requestTempo,
    timeSignature: requestTimeSignature,
    form: requestForm,
    period,
    motif_seed,
    rhythm_seed,
    section_plan,
  } = request;

  const keyHint = normalizeKey(requestKey, { valence });
  const tempoHint = clamp(requestTempo, 40, 220, null);
  const timeSigHint = normalizeTimeSignature(requestTimeSignature);
  const formHint = normalizeForm(requestForm);
  const plan = buildClassicalPlan(request, {
    key: keyHint,
    tempo: tempoHint || Math.round(60 + clamp(arousal, 0, 1, 0.5) * 80),
    timeSignature: timeSigHint,
  });

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

Artistic "soul" requirements:
- Map psychological tension/release to harmonic resolution:
  - unresolved/conflicted: prefer HC or DC (deceptive), and carry dominant tension across section boundaries
  - overcome/acceptance: prefer strong PAC; in minor keys you MAY use a Picardy third cadence (PICARDY) for redemption
  - complex/ambiguous: use modal color by emphasizing non-tonic scale degrees (ii/IV in major; iv/VI in minor) and avoid overly-final cadences
- Use leitmotifs: pick 2–3 theme keywords and define short motifs (degrees+rhythm). Reintroduce them with variation (sequence, inversion, augmentation, diminution).
- Humanize performance (MIDI-friendly): describe rubato level + velocity shaping (peak emphasis, phrase-end softening).

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
      "key": "optional local key for this section (e.g., 'G major')",
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
      "texture": "string (simple, contrapuntal, homophonic)",
      "cadence": "optional cadence goal (HC|PAC|DC|PICARDY)",
      "harmonicFunctions": ["optional", "array", "of", "tension|release|ambiguity", "aligned", "to", "chords"]
    }
  ],
  "leitmotifs": [
    {
      "tag": "string (picked from theme keywords)",
      "degrees": [1, 3, 5, 3],
      "rhythm": [0.5, 0.5, 1, 1],
      "meaning": "optional short meaning",
      "transformations": ["optional variation hints"]
    }
  ],
  "humanize": {
    "rubato": "none|subtle|expressive",
    "velocityCurve": "flat|phrase",
    "peakBoost": 0.0,
    "phraseEndSoftness": 0.0
  },
  "instrumentation": "string (e.g., 'piano' or 'piano trio')",
  "character": "string describing emotional character",
  "reasoning": "brief explanation of why you chose this key, tempo, form, and other musical decisions"
}

Hard constraints for MIDI compatibility:
- timeSignature MUST be one of: "3/4", "4/4", "6/8" (recommended: 4/4)
- tempo MUST be a number (40..220)
- section.key (if provided) MUST be one of: C major, c minor, D major, d minor, E major, e minor, F major, f minor, G major, g minor, A major, a minor, B major, b minor
- chordProgression MUST use ONLY these diatonic roman numerals (no slashes, no 7ths):
  - Major mode: I, ii, iii, IV, V, vi, vii
  - Minor mode: i, III, iv, V, VI, VII (and optionally ii)
- degrees MUST be integers 1..7 (optionally up to 14 for octave shifts)
- rhythm values MUST be in beats and should be from: 0.25, 0.5, 1, 2, 4
`;

  const constraintsBlock = `\n\nCreative constraints (optional):\n- Period/era: ${normalizePeriod(period) || 'classical'}\n- Preferred form: ${formHint || plan.form}\n- Preferred key (global): ${requestKey ? normalizeKey(requestKey, { valence }) : 'auto'}\n- Tempo hint: ${tempoHint ?? 'auto'}\n- Time signature hint: ${requestTimeSignature ? normalizeTimeSignature(requestTimeSignature) : 'auto'}\n- Motif seed degrees: ${Array.isArray(motif_seed) ? JSON.stringify(motif_seed.slice(0, 12)) : 'n/a'}\n- Rhythm seed (beats): ${Array.isArray(rhythm_seed) ? JSON.stringify(rhythm_seed.slice(0, 12)) : 'n/a'}\n- Section plan override: ${section_plan ? JSON.stringify(section_plan).slice(0, 600) : 'n/a'}\n- Allowed genres: ${Array.isArray(genre_palette) && genre_palette.length ? genre_palette.join(', ') : 'classical'}\n- Primary genre hint: ${primary_genre || 'classical'}\n- Instrumentation hint: ${Array.isArray(instrumentation) && instrumentation.length ? instrumentation.join(', ') : 'piano'}\n- Timbre arc: ${timbre_arc ? JSON.stringify(timbre_arc) : 'n/a'}\n- Theme: ${theme ? JSON.stringify({ title: theme.title, keywords: theme.keywords }) : 'n/a'}\n- Emotional arc: ${emotional_arc ? JSON.stringify(emotional_arc).slice(0, 600) : 'n/a'}\n- Personality axes: ${Array.isArray(personality_axes) ? JSON.stringify(personality_axes.slice(0, 3)) : 'n/a'}\n\nSection plan you MUST follow (names, approximate measures, section keys, cadence goals):\n${JSON.stringify(plan.sections.map((s) => ({ name: s.name, measures: s.measures, key: s.key, cadence: s.cadence })), null, 2)}\n`;

  const userPrompt = `Generate a single cohesive classical piece (not a loop) with the following emotional parameters:

Valence: ${valence.toFixed(2)} (${valence < -0.3 ? 'negative/sad' : valence > 0.3 ? 'positive/happy' : 'neutral'})
Arousal: ${arousal.toFixed(2)} (${arousal < 0.3 ? 'calm' : arousal > 0.7 ? 'energetic' : 'moderate'})
Focus: ${focus.toFixed(2)} (${focus < 0.3 ? 'diffuse' : focus > 0.7 ? 'concentrated' : 'balanced'})
Artistic motifs: ${motif_tags.join(', ')}
Target duration: ${duration} seconds

Classical-theory requirements:
- Use clear phrase structure (often 4+4 or 8-bar periods) and motivic unity across sections
- Use functional harmony and cadences at section endings (HC/PAC)
- Use development techniques (sequence, inversion, augmentation/diminution) especially in development/variation sections
- Avoid pop-loop progressions and avoid random chord jumps

Now add artistic depth:
- Define 2–3 leitmotifs from the theme keywords (tagged), and restate them later with variation.
- Annotate chord functions with tension/release/ambiguity where it helps the narrative (optional).
- Add humanize guidance (rubato + velocity shaping) compatible with MIDI.

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
  const { valence, arousal, focus, instrumentation, primary_genre } = request;

  const key = normalizeKey(request?.key || (valence < 0 ? 'd minor' : 'C major'), { valence });
  const tempo = clamp(request?.tempo, 40, 220, Math.round(60 + clamp(arousal, 0, 1, 0.5) * 80));
  const timeSignature = normalizeTimeSignature(request?.timeSignature || (focus > 0.6 ? '4/4' : '3/4'));
  const plan = buildClassicalPlan(request, { key, tempo, timeSignature });

  const baseMotif = {
    degrees: normalizeMotifSeed(request?.motif_seed || request?.motifSeedDegrees) || (valence < 0 ? [5, 4, 3, 2, 1] : [1, 3, 5, 3, 1]),
    rhythm: normalizeRhythmSeed(request?.rhythm_seed || request?.rhythmSeed) || [1, 1, 1, 1, 2],
  };

  const dynamics = clamp(arousal, 0, 1, 0.5) < 0.3 ? 'p' : clamp(arousal, 0, 1, 0.5) > 0.7 ? 'f' : 'mf';
  const sections = plan.sections.map((p) => {
    const sectionKey = normalizeKey(p.key, { valence });
    const mode = modeFromKey(sectionKey);
    const chords = applyCadence(normalizeChordProgression([], { key: sectionKey }), { mode, cadence: p.cadence || 'PAC' });
    const motif = p.variation && p.variation !== 'none' ? varyMotif(baseMotif, p.variation) : varyMotif(baseMotif, 'none');
    return {
      name: String(p.name || 'A').slice(0, 20),
      measures: clamp(p.measures, 6, 256, 8),
      key: sectionKey,
      chordProgression: chords,
      melody: { motifs: [motif] },
      dynamics,
      texture: normalizePeriod(request?.period) === 'baroque' ? 'contrapuntal' : 'homophonic',
    };
  });

  const character = `${valence < 0 ? 'melancholic' : 'uplifting'} and ${arousal < 0.5 ? 'calm' : 'energetic'}`;

  return {
    key,
    tempo,
    timeSignature,
    form: plan.form,
    sections: fitMeasuresToDuration(sections, { tempo, timeSignature, durationSec: request?.duration }),
    instrumentation: Array.isArray(instrumentation) && instrumentation.length
      ? instrumentation.join(', ')
      : primary_genre === 'jazz'
      ? 'piano (jazz-influenced)'
      : 'piano',
    character,
  };
}
