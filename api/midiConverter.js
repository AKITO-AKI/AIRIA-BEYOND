/**
 * MIDI converter: JSON music structure → MIDI file (P4)
 * Converts LLM-generated music structure to MIDI format
 */

import MidiWriter from 'midi-writer-js';

// Map of note names to MIDI note numbers (C4 = middle C = 60)
const NOTE_MAP = {
  'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
};

// Key signatures map (simplified for prototype)
const KEY_SIGNATURES = {
  'C major': { tonic: 60, scale: [0, 2, 4, 5, 7, 9, 11] },
  'c minor': { tonic: 60, scale: [0, 2, 3, 5, 7, 8, 10] },
  'D major': { tonic: 62, scale: [0, 2, 4, 5, 7, 9, 11] },
  'd minor': { tonic: 62, scale: [0, 2, 3, 5, 7, 8, 10] },
  'E major': { tonic: 64, scale: [0, 2, 4, 5, 7, 9, 11] },
  'e minor': { tonic: 64, scale: [0, 2, 3, 5, 7, 8, 10] },
  'F major': { tonic: 65, scale: [0, 2, 4, 5, 7, 9, 11] },
  'f minor': { tonic: 65, scale: [0, 2, 3, 5, 7, 8, 10] },
  'G major': { tonic: 67, scale: [0, 2, 4, 5, 7, 9, 11] },
  'g minor': { tonic: 67, scale: [0, 2, 3, 5, 7, 8, 10] },
  'A major': { tonic: 69, scale: [0, 2, 4, 5, 7, 9, 11] },
  'a minor': { tonic: 69, scale: [0, 2, 3, 5, 7, 8, 10] },
  'B major': { tonic: 71, scale: [0, 2, 4, 5, 7, 9, 11] },
  'b minor': { tonic: 71, scale: [0, 2, 3, 5, 7, 8, 10] },
};

// Chord quality templates (semitones from chord root)
const TRIADS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
};

// Dynamics to MIDI velocity mapping
const DYNAMICS_MAP = {
  'pp': 40,
  'p': 60,
  'mp': 75,
  'mf': 90,
  'f': 105,
  'ff': 120,
};

/**
 * Convert music structure to MIDI data (Base64 encoded)
 * @param {Object} structure - Music structure object
 * @returns {string} Base64-encoded MIDI data
 */
export function musicStructureToMIDI(structure) {
  const { key, tempo, timeSignature, sections } = structure;

  // Get key information
  const keyInfo = KEY_SIGNATURES[key] || KEY_SIGNATURES['C major'];

  const { numerator, denominator, measureBeats } = parseTimeSignature(timeSignature);

  // Multi-track: harmony + bass + melody (still simple, but far more musical).
  const harmonyTrack = new MidiWriter.Track();
  const bassTrack = new MidiWriter.Track();
  const melodyTrack = new MidiWriter.Track();

  for (const t of [harmonyTrack, bassTrack, melodyTrack]) {
    t.setTempo(tempo);
    t.setTimeSignature(numerator, denominator, 24, 8);
  }

  // Convert each section
  for (const section of sections) {
    convertSectionToMIDI({ harmonyTrack, bassTrack, melodyTrack }, section, keyInfo, measureBeats);
  }

  // Create MIDI file
  const writer = new MidiWriter.Writer([melodyTrack, harmonyTrack, bassTrack]);

  // Get data URI and extract base64 part
  const dataUri = writer.dataUri();
  const base64Data = dataUri.split(',')[1];

  return base64Data;
}

/**
 * Convert a music section to MIDI events
 * @param {Object} track - MIDI track
 * @param {Object} section - Music section
 * @param {Object} keyInfo - Key signature information
 * @param {number} tempo - Tempo in BPM
 */
function parseTimeSignature(timeSignature) {
  const [nRaw, dRaw] = String(timeSignature || '4/4').split('/');
  const n = Math.max(1, Math.min(12, Number(nRaw) || 4));
  const d = [2, 4, 8, 16].includes(Number(dRaw)) ? Number(dRaw) : 4;
  const measureBeats = n * (4 / d); // beats in quarter-note units
  return { numerator: n, denominator: d, measureBeats };
}

function convertSectionToMIDI(tracks, section, keyInfo, measureBeats) {
  const { chordProgression, melody, dynamics } = section;
  const velocity = DYNAMICS_MAP[dynamics] || 90;

  const safeChordProgression = Array.isArray(chordProgression) && chordProgression.length ? chordProgression : ['I', 'V', 'vi', 'IV'];
  const motifs = Array.isArray(melody?.motifs) ? melody.motifs : [];

  const harmonyVel = Math.floor(velocity * 0.62);
  const bassVel = Math.floor(velocity * 0.72);
  const melodyVel = velocity;

  const quarterBeats = Math.max(1, Math.min(16, Math.round(measureBeats)));

  const midTonic = clampMidi(keyInfo.tonic - 12);
  const bassTonic = clampMidi(keyInfo.tonic - 24);
  let prevMidVoicing = null;

  for (let measure = 0; measure < Number(section.measures || 0); measure++) {
    const chord = safeChordProgression[measure % safeChordProgression.length];
    const midVoicingRaw = getChordNotes(chord, keyInfo, midTonic);
    const chordNotesMid = prevMidVoicing ? voiceLeadChord(midVoicingRaw, prevMidVoicing) : midVoicingRaw;
    prevMidVoicing = chordNotesMid.length ? chordNotesMid.slice() : prevMidVoicing;

    const bassRoot = getChordRoot(chord, keyInfo, bassTonic) ?? bassTonic;

    // Harmony: broken-chord arpeggio (less blocky than repeated triads)
    if (chordNotesMid.length) {
      addArpeggioPattern(tracks.harmonyTrack, chordNotesMid, quarterBeats, harmonyVel);
    } else {
      for (let b = 0; b < quarterBeats; b += 1) {
        tracks.harmonyTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [midTonic], duration: '4', velocity: harmonyVel }));
      }
    }

    // Bass: root on downbeat, (optional) fifth on mid-measure for motion.
    const fifth = chordNotesMid?.[2] ? clampMidi(chordNotesMid[2] - 24) : clampMidi(bassRoot + 7);
    if (quarterBeats >= 4) {
      tracks.bassTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [bassRoot], duration: '2', velocity: bassVel }));
      tracks.bassTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [fifth], duration: '2', velocity: Math.floor(bassVel * 0.95) }));
    } else {
      for (let b = 0; b < quarterBeats; b += 1) {
        const p = b === 0 ? bassRoot : fifth;
        tracks.bassTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [p], duration: '4', velocity: bassVel }));
      }
    }

    // Melody: fit a motif into the measure.
    if (motifs.length) {
      const motif = motifs[measure % motifs.length];
      addMotifToTrack(tracks.melodyTrack, motif, keyInfo, melodyVel, quarterBeats);
    } else {
      // Minimal melodic time-keeper
      for (let b = 0; b < quarterBeats; b += 1) {
        tracks.melodyTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [keyInfo.tonic + 12], duration: '4', velocity: Math.floor(melodyVel * 0.55) }));
      }
    }
  }
}

/**
 * Get MIDI note numbers for a chord
 * @param {string} romanNumeral - Roman numeral chord notation
 * @param {Object} keyInfo - Key signature information
 * @param {number} [baseOctave=60] - Base octave for chord
 * @returns {number[]} Array of MIDI note numbers
 */
function clampMidi(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 60;
  return Math.max(0, Math.min(127, Math.round(x)));
}

function normalizeRoman(romanNumeral) {
  const s = String(romanNumeral ?? '').trim();
  // Keep roman letters only; preserve case for quality heuristics.
  const cleaned = s.replace(/[^ivIV]/g, '');
  return cleaned || 'I';
}

function romanToDegree(romanNumeral) {
  const r = normalizeRoman(romanNumeral).toUpperCase();
  // Order matters (VI vs V etc.)
  const map = {
    VII: 7,
    VI: 6,
    IV: 4,
    V: 5,
    III: 3,
    II: 2,
    I: 1,
  };
  return map[r] || null;
}

function getTriadQuality(romanNumeral) {
  const r = normalizeRoman(romanNumeral);
  const upper = r.toUpperCase();
  const isLower = r === r.toLowerCase();
  if (upper === 'VII') return 'diminished';
  return isLower ? 'minor' : 'major';
}

function getChordRoot(romanNumeral, keyInfo, baseTonic) {
  const degree = romanToDegree(romanNumeral);
  if (!degree) return null;
  const scaleSemitone = keyInfo.scale[(degree - 1) % keyInfo.scale.length] ?? 0;
  return clampMidi(baseTonic + scaleSemitone);
}

function getChordNotes(romanNumeral, keyInfo, baseTonic) {
  const root = getChordRoot(romanNumeral, keyInfo, baseTonic);
  if (root === null) return [];
  const quality = getTriadQuality(romanNumeral);
  const intervals = TRIADS[quality] || TRIADS.major;
  const notes = intervals.map((d) => clampMidi(root + d));
  notes.sort((a, b) => a - b);
  return notes;
}

function voiceLeadChord(chordNotes, prevNotes) {
  if (!Array.isArray(chordNotes) || chordNotes.length < 3) return chordNotes;
  if (!Array.isArray(prevNotes) || prevNotes.length < 3) return chordNotes;

  const base = chordNotes.slice(0, 3).sort((a, b) => a - b);
  const prev = prevNotes.slice(0, 3).sort((a, b) => a - b);

  const inv0 = [base[0], base[1], base[2]];
  const inv1 = [base[1], base[2], clampMidi(base[0] + 12)];
  const inv2 = [base[2], clampMidi(base[0] + 12), clampMidi(base[1] + 12)];
  const candidates = [inv0, inv1, inv2]
    .flatMap((v) => [v, v.map((n) => clampMidi(n + 12)), v.map((n) => clampMidi(n - 12))])
    .map((v) => v.slice().sort((a, b) => a - b));

  let best = candidates[0];
  let bestScore = Infinity;
  for (const c of candidates) {
    const score = Math.abs(c[0] - prev[0]) + Math.abs(c[1] - prev[1]) + Math.abs(c[2] - prev[2]);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function addArpeggioPattern(track, chordNotes, quarterBeats, velocity) {
  const notes = chordNotes.slice().sort((a, b) => a - b);
  const steps = Math.max(2, Math.round(quarterBeats * 2)); // eighth notes
  const pattern = [0, 1, 2, 1];
  for (let i = 0; i < steps; i += 1) {
    const idx = pattern[i % pattern.length];
    const isDownbeat = i % 2 === 0;
    const vel = isDownbeat ? velocity : Math.floor(velocity * 0.92);
    track.addEvent(new MidiWriter.NoteEvent({ pitch: [notes[idx] ?? notes[0]], duration: '8', velocity: vel }));
  }
}

/**
 * Add a melody motif to the track
 * @param {Object} track - MIDI track
 * @param {Object} motif - Melody motif with degrees and rhythm
 * @param {Object} keyInfo - Key signature information
 * @param {number} velocity - MIDI velocity
 */
function addMotifToTrack(track, motif, keyInfo, velocity, quarterBeats) {
  const degrees = Array.isArray(motif?.degrees) ? motif.degrees : [];
  const rhythm = Array.isArray(motif?.rhythm) ? motif.rhythm : [];
  if (!degrees.length) {
    for (let b = 0; b < quarterBeats; b += 1) {
      track.addEvent(new MidiWriter.NoteEvent({ pitch: [keyInfo.tonic + 12], duration: '4', velocity: Math.floor(velocity * 0.55) }));
    }
    return;
  }

  const rawDurations = degrees.map((_, i) => Number(rhythm[i] ?? 1)).map((d) => (Number.isFinite(d) && d > 0 ? d : 1));
  const sum = rawDurations.reduce((a, b) => a + b, 0) || 1;
  const scale = quarterBeats / sum;

  let remaining = quarterBeats;
  for (let i = 0; i < degrees.length && remaining > 0.01; i++) {
    const degree = Number(degrees[i] ?? 1);
    const scaled = rawDurations[i] * scale;
    const q = quantizeBeats(Math.min(remaining, scaled));
    remaining -= q;

    const scaleIndex = ((degree - 1) % keyInfo.scale.length + keyInfo.scale.length) % keyInfo.scale.length;
    const octaveOffset = Math.floor((degree - 1) / keyInfo.scale.length) * 12;
    const note = keyInfo.tonic + 12 + keyInfo.scale[scaleIndex] + octaveOffset;

    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [note],
        duration: beatsToMidiDuration(q),
        velocity,
      })
    );
  }

  // Fill any remaining time with a gentle sustain.
  while (remaining > 0.01) {
    const q = quantizeBeats(remaining);
    remaining -= q;
    track.addEvent(new MidiWriter.NoteEvent({ pitch: [keyInfo.tonic + 12], duration: beatsToMidiDuration(q), velocity: Math.floor(velocity * 0.45) }));
  }
}

function quantizeBeats(beats) {
  const b = Number(beats);
  if (!Number.isFinite(b) || b <= 0) return 0.25;
  const choices = [4, 2, 1, 0.5, 0.25];
  let best = choices[choices.length - 1];
  let bestErr = Infinity;
  for (const c of choices) {
    const err = Math.abs(b - c);
    if (err < bestErr) {
      bestErr = err;
      best = c;
    }
  }
  return best;
}

function beatsToMidiDuration(beats) {
  const b = quantizeBeats(beats);
  if (b >= 3) return '1';
  if (b >= 1.5) return '2';
  if (b >= 0.75) return '4';
  if (b >= 0.375) return '8';
  return '16';
}

/**
 * Convert Base64 MIDI data to data URL for browser download
 * @param {string} base64 - Base64-encoded MIDI data
 * @returns {string} Data URL
 */
export function midiBase64ToDataURL(base64) {
  return `data:audio/midi;base64,${base64}`;
}
