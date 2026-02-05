/**
 * MIDI Player using Tone.js (P4)
 * Client-side MIDI playback for classical music generation
 */

import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

export interface MIDIPlayerOptions {
  onProgress?: (currentTime: number, duration: number) => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export class MIDIPlayer {
  private synth: Tone.PolySynth | null = null;
  private part: Tone.Part | null = null;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private duration: number = 0;
  private options: MIDIPlayerOptions;
  private progressInterval: number | null = null;

  constructor(options: MIDIPlayerOptions = {}) {
    this.options = options;
  }

  /**
   * Load MIDI data (base64 encoded) and prepare for playback
   */
  async loadMIDI(midiBase64: string): Promise<void> {
    try {
      // Decode base64 to binary
      const binaryString = atob(midiBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Parse real MIDI file (preferred). Fall back to placeholder notes if parsing fails.
      const notes = this.parseMIDIToNotes(bytes);

      // Create synth if needed
      if (!this.synth) {
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: 'sine',
          },
          envelope: {
            attack: 0.02,
            decay: 0.1,
            sustain: 0.3,
            release: 1,
          },
        }).toDestination();
      }

      // Create a Part with the notes
      this.part = new Tone.Part((time, note) => {
        this.synth?.triggerAttackRelease(
          note.name,
          note.duration,
          time,
          note.velocity
        );
      }, notes);

      // Calculate duration
      this.duration = this.calculateDuration(notes);

      // Set up end callback
      this.part.loop = false;

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load MIDI');
      this.options.onError?.(err);
      throw err;
    }
  }

  /**
   * Parse MIDI bytes to Tone.js note events
   * 
   * NOTE: This is a simplified implementation for the prototype phase.
   * For full production use, integrate a proper MIDI parser library
   * like @tonejs/midi or midi-parser-js to handle all MIDI file formats.
   * 
   * Current limitation: Generates a placeholder melody instead of parsing
   * the actual MIDI file structure. The MIDI data from our generator should
   * be parseable, but for the prototype we use this fallback.
   */
  private parseMIDIToNotes(bytes: Uint8Array): Array<{
    time: number;
    name: string;
    duration: number;
    velocity: number;
  }> {
    try {
      const midi = new Midi(bytes);
      const out: Array<{ time: number; name: string; duration: number; velocity: number }> = [];

      // Collect notes across tracks. Midi gives time/duration in seconds.
      for (const track of midi.tracks) {
        for (const note of track.notes) {
          const timeSec = Number(note.time);
          const durSec = Number(note.duration);
          if (!Number.isFinite(timeSec) || !Number.isFinite(durSec)) continue;

          out.push({
            time: timeSec,
            name: note.name,
            duration: durSec,
            velocity: typeof note.velocity === 'number' ? note.velocity : 0.8,
          });
        }
      }

      // Ensure deterministic order for playback
      out.sort((a, b) => Number(a.time) - Number(b.time));

      if (out.length) return out;
      throw new Error('No notes found in MIDI');
    } catch {
      // Placeholder fallback (keeps app usable even if parsing fails)
      const notes: Array<{ time: number; name: string; duration: number; velocity: number }> = [];
      const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
      let currentTime = 0;
      for (let i = 0; i < 16; i++) {
        notes.push({
          time: currentTime,
          name: scale[i % scale.length],
          duration: 0.4,
          velocity: 0.7,
        });
        currentTime += 0.5;
      }
      return notes;
    }
  }

  /**
   * Calculate total duration from notes
   */
  private calculateDuration(notes: Array<{ time: number; duration: number }>): number {
    if (notes.length === 0) return 0;
    
    let maxEnd = 0;
    for (const n of notes) {
      if (!Number.isFinite(n.time) || !Number.isFinite(n.duration)) continue;
      maxEnd = Math.max(maxEnd, n.time + n.duration);
    }
    return maxEnd;
  }

  /**
   * Play the loaded MIDI
   */
  async play(): Promise<void> {
    if (!this.part || !this.synth) {
      throw new Error('No MIDI loaded');
    }

    // Ensure audio context is started (required by browsers)
    await Tone.start();

    if (this.isPaused) {
      // Resume from pause
      Tone.getTransport().start();
      this.isPaused = false;
    } else {
      // Start from beginning
      this.part.start(0);
      Tone.getTransport().start();
    }

    this.isPlaying = true;

    // Start progress tracking
    this.startProgressTracking();

    // Set up end callback using transport time
    Tone.getTransport().schedule(() => {
      this.stop();
      this.options.onEnd?.();
    }, `+${this.duration}`);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.isPlaying) return;

    Tone.getTransport().pause();
    this.isPlaying = false;
    this.isPaused = true;
    this.stopProgressTracking();
  }

  /**
   * Stop playback
   */
  stop(): void {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    this.part?.stop();
    this.isPlaying = false;
    this.isPaused = false;
    this.stopProgressTracking();
  }

  /**
   * Seek to a specific time
   */
  seek(timeInSeconds: number): void {
    const clampedTime = Math.max(0, Math.min(timeInSeconds, this.duration));
    Tone.getTransport().seconds = clampedTime;
  }

  /**
   * Get current playback state
   */
  getState(): {
    isPlaying: boolean;
    isPaused: boolean;
    currentTime: number;
    duration: number;
  } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentTime: Tone.getTransport().seconds,
      duration: this.duration,
    };
  }

  /**
   * Start tracking playback progress
   */
  private startProgressTracking(): void {
    this.stopProgressTracking();
    
    this.progressInterval = window.setInterval(() => {
      const currentTime = Tone.getTransport().seconds;
      this.options.onProgress?.(currentTime, this.duration);
    }, 100);
  }

  /**
   * Stop tracking playback progress
   */
  private stopProgressTracking(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.part?.dispose();
    this.synth?.dispose();
    this.part = null;
    this.synth = null;
  }
}

/**
 * Global player instance (singleton for background playback)
 */
let globalPlayer: MIDIPlayer | null = null;

export function getGlobalPlayer(): MIDIPlayer {
  if (!globalPlayer) {
    globalPlayer = new MIDIPlayer();
  }
  return globalPlayer;
}

export function disposeGlobalPlayer(): void {
  if (globalPlayer) {
    globalPlayer.dispose();
    globalPlayer = null;
  }
}
