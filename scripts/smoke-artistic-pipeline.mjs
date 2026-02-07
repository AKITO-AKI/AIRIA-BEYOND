import { generateMusicStructureWithFallback } from '../api/musicLLMService.js';
import { musicStructureToMIDI } from '../api/midiConverter.js';
import { buildPrompt } from '../api/promptBuilder.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const request = {
  valence: -0.45,
  arousal: 0.62,
  focus: 0.74,
  confidence: 0.85,
  duration: 120,
  seed: 42,
  motif_tags: ['孤独', '希望', '静寂'],

  // Advanced musical controls
  period: 'romantic',
  form: 'sonata',
  instrumentation: ['piano', 'strings'],

  // New artistic controls
  emotional_arc: {
    early: { valence: -0.55, arousal: 0.45, focus: 0.7, note: 'unresolved' },
    middle: { valence: -0.25, arousal: 0.7, focus: 0.8, note: 'conflict' },
    late: { valence: 0.15, arousal: 0.55, focus: 0.75, note: 'acceptance' },
  },
  humanize: { rubato: 'subtle', velocityCurve: 'phrase', peakBoost: 0.22, phraseEndSoftness: 0.35 },

  motif_seed: [1, 3, 5, 3, 2, 1],
  rhythm_seed: [0.5, 0.5, 1, 1, 2],
};

const { structure, provider } = await generateMusicStructureWithFallback(request);
assert(structure && typeof structure === 'object', 'No structure returned');
assert(typeof structure.key === 'string' && structure.key.length > 0, 'Structure key missing');
assert(typeof structure.tempo === 'number' && Number.isFinite(structure.tempo), 'Structure tempo missing/invalid');
assert(Array.isArray(structure.sections) && structure.sections.length > 0, 'No sections returned');

const midi = musicStructureToMIDI(structure);
assert(typeof midi === 'string' && midi.length > 100, 'MIDI base64 output too short');

const { prompt, negativePrompt, stylePreset } = buildPrompt({
  mood: '高度で芸術的な孤独と希望',
  valence: request.valence,
  arousal: request.arousal,
  focus: request.focus,
  confidence: request.confidence,
  motif_tags: request.motif_tags,
  stylePreset: 'oil-painting',
  period: request.period,
  instrumentation: request.instrumentation,
  density: 0.62,
  subject: '都会の電車とスマホ',
  palette: 'umber, ultramarine, soft gold',
  ambiguity: 0.65,
});

assert(typeof prompt === 'string' && prompt.length > 30, 'Prompt missing/too short');
assert(typeof negativePrompt === 'string', 'Negative prompt missing');

console.log('[smoke-artistic-pipeline] OK');
console.log('provider:', provider);
console.log('key:', structure.key, 'tempo:', structure.tempo, 'sections:', structure.sections.length);
console.log('stylePreset:', stylePreset);
console.log('prompt sample:', prompt.slice(0, 180).replace(/\s+/g, ' ') + '...');
console.log('midi base64 length:', midi.length);
