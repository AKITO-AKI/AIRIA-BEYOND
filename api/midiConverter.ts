/**
 * MIDI converter: JSON music structure → MIDI file (P4)
 * Converts LLM-generated music structure to MIDI format
 */

import MidiWriter from 'midi-writer-js';
import type { MusicStructure, MusicSection, MusicMotif } from './types';

// Map of note names to MIDI note numbers (C4 = middle C = 60)
const NOTE_MAP: { [key: string]: number } = {
  'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
};

// Key signatures map (simplified for prototype)
const KEY_SIGNATURES: { [key: string]: { tonic: number; scale: number[] } } = {
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
const CHORD_MAP: { [key: string]: number[] } = {
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
const DYNAMICS_MAP: { [key: string]: number } = {
  'pp': 40,
  'p': 60,
  'mp': 75,
  'mf': 90,
  'f': 105,
  'ff': 120,
};

/**
 * Convert music structure to MIDI data (Base64 encoded)
 */
export function musicStructureToMIDI(structure: MusicStructure): string {
  const { key, tempo, timeSignature, sections } = structure;

  // Get key information
  const keyInfo = KEY_SIGNATURES[key] || KEY_SIGNATURES['C major'];

  // Create MIDI track
  const track = new MidiWriter.Track();

  // Set tempo
  track.setTempo(tempo);

  // Set time signature (parse "3/4" -> [3, 4])
  const [numerator, denominator] = timeSignature.split('/').map(Number);
  track.setTimeSignature(numerator, denominator);

  // Convert each section
  for (const section of sections) {
    convertSectionToMIDI(track, section, keyInfo, tempo);
  }

  // Create MIDI file
  const writer = new MidiWriter.Writer([track]);

  // Get data URI and extract base64 part
  const dataUri = writer.dataUri();
  const base64Data = dataUri.split(',')[1];

  return base64Data;
}

/**
 * Convert a music section to MIDI events
 */
function convertSectionToMIDI(
  track: any,
  section: MusicSection,
  keyInfo: { tonic: number; scale: number[] },
  tempo: number
): void {
  const { chordProgression, melody, dynamics } = section;
  const velocity = DYNAMICS_MAP[dynamics] || 90;

  // Simple approach: alternate between chords and melody
  // In a real implementation, we'd layer them properly

  const beatsPerMeasure = 4; // Simplified, should parse from time signature
  let currentBeat = 0;

  // Process each measure
  for (let measure = 0; measure < section.measures; measure++) {
    const chordIndex = measure % chordProgression.length;
    const chord = chordProgression[chordIndex];

    // Add chord (harmony)
    const chordNotes = getChordNotes(chord, keyInfo, 48); // Bass octave
    if (chordNotes.length > 0) {
      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: chordNotes,
          duration: '2', // Half note for each chord
          velocity: Math.floor(velocity * 0.7), // Softer for accompaniment
        })
      );
    }

    // Add melody motif
    if (melody.motifs.length > 0) {
      const motifIndex = measure % melody.motifs.length;
      const motif = melody.motifs[motifIndex];
      addMotifToTrack(track, motif, keyInfo, velocity);
    }
  }
}

/**
 * Get MIDI note numbers for a chord
 */
function getChordNotes(
  romanNumeral: string,
  keyInfo: { tonic: number; scale: number[] },
  baseOctave: number = 60
): number[] {
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
 */
function addMotifToTrack(
  track: any,
  motif: MusicMotif,
  keyInfo: { tonic: number; scale: number[] },
  velocity: number
): void {
  const { degrees, rhythm } = motif;

  for (let i = 0; i < degrees.length; i++) {
    const degree = degrees[i];
    const duration = rhythm[i] || 1;

    // Convert scale degree to MIDI note (melody octave)
    const scaleIndex = (degree - 1) % keyInfo.scale.length;
    const octaveOffset = Math.floor((degree - 1) / keyInfo.scale.length) * 12;
    const note = keyInfo.tonic + 12 + keyInfo.scale[scaleIndex] + octaveOffset; // +12 for melody octave

    // Convert duration to MIDI duration string
    const midiDuration = getDurationString(duration);

    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [note],
        duration: midiDuration,
        velocity,
      })
    );
  }
}

/**
 * Convert numeric duration to MIDI duration string
 */
function getDurationString(beats: number): string {
  if (beats >= 4) return '1';      // Whole note
  if (beats >= 2) return '2';      // Half note
  if (beats >= 1) return '4';      // Quarter note
  if (beats >= 0.5) return '8';    // Eighth note
  return '16';                      // Sixteenth note
}

/**
 * Convert Base64 MIDI data to data URL for browser download
 */
export function midiBase64ToDataURL(base64: string): string {
  return `data:audio/midi;base64,${base64}`;
}
