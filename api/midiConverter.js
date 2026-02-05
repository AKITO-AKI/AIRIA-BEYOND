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

// Roman numeral to chord intervals (simplified)
const CHORD_MAP = {
  'i': [0, 3, 7],  // minor triad
  'I': [0, 4, 7],  // major triad
  'ii': [2, 5, 9],
  'II': [2, 6, 9],
  'iii': [4, 7, 11],
  'III': [4, 8, 11],
  'iv': [5, 8, 12],
  'IV': [5, 9, 12],
  'v': [7, 10, 14],
  'V': [7, 11, 14],
  'vi': [9, 12, 16],
  'VI': [9, 13, 16],
  'vii': [11, 14, 17],
  'VII': [11, 15, 17],
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

  for (let measure = 0; measure < Number(section.measures || 0); measure++) {
    const chord = safeChordProgression[measure % safeChordProgression.length];
    const chordNotesMid = getChordNotes(chord, keyInfo, 60); // mid register
    const chordNotesBass = getChordNotes(chord, keyInfo, 36);
    const bassRoot = chordNotesBass[0] ?? (keyInfo.tonic - 12);

    // Harmony: repeat a soft chord each beat (simple but stable).
    if (chordNotesMid.length) {
      for (let b = 0; b < quarterBeats; b += 1) {
        tracks.harmonyTrack.addEvent(
          new MidiWriter.NoteEvent({
            pitch: chordNotesMid,
            duration: '4',
            velocity: harmonyVel,
          })
        );
      }
    } else {
      // Keep time moving even if chord parsing fails.
      for (let b = 0; b < quarterBeats; b += 1) {
        tracks.harmonyTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [keyInfo.tonic], duration: '4', velocity: harmonyVel }));
      }
    }

    // Bass: simple root pulse.
    if (quarterBeats >= 4) {
      tracks.bassTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [bassRoot], duration: '2', velocity: bassVel }));
      tracks.bassTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [bassRoot], duration: '2', velocity: bassVel }));
    } else {
      for (let b = 0; b < quarterBeats; b += 1) {
        tracks.bassTrack.addEvent(new MidiWriter.NoteEvent({ pitch: [bassRoot], duration: '4', velocity: bassVel }));
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
function getChordNotes(romanNumeral, keyInfo, baseOctave = 60) {
  const chordIntervals = CHORD_MAP[romanNumeral] || CHORD_MAP['I'];
  
  return chordIntervals.map((interval) => {
    // Map interval to scale degree
    const scaleDegree = Math.floor(interval / 2);
    const scaleNote = keyInfo.scale[scaleDegree % keyInfo.scale.length];
    const octaveOffset = Math.floor(interval / 12) * 12;
    return baseOctave + scaleNote + octaveOffset;
  });
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
