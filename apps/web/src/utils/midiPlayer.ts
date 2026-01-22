/**
 * MIDI Player using Tone.js (P4)
 * Client-side MIDI playback for classical music generation
 */

import * as Tone from 'tone';

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

      // Parse MIDI file (simplified - we'll use our known structure)
      // For prototype, we'll convert our known MIDI structure to Tone.js events
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
    time: string;
    name: string;
    duration: string;
    velocity: number;
  }> {
    // Simplified placeholder for prototype
    // TODO: Implement proper MIDI parsing for production
    
    const notes: Array<{
      time: string;
      name: string;
      duration: string;
      velocity: number;
    }> = [];

    // Generate simple C major scale as fallback
    // In production, this should parse the MIDI file structure
    const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    let currentTime = 0;

    for (let i = 0; i < 16; i++) {
      notes.push({
        time: `${currentTime}`,
        name: scale[i % scale.length],
        duration: '4n',
        velocity: 0.7,
      });
      currentTime += 0.5;
    }

    return notes;
  }

  /**
   * Calculate total duration from notes
   */
  private calculateDuration(notes: Array<{ time: string; duration: string }>): number {
    if (notes.length === 0) return 0;
    
    // Find the last note and add its duration
    const lastNote = notes[notes.length - 1];
    const lastTime = parseFloat(lastNote.time);
    
    // Convert duration to seconds (simplified)
    const durationMap: { [key: string]: number } = {
      '1n': 2,
      '2n': 1,
      '4n': 0.5,
      '8n': 0.25,
      '16n': 0.125,
    };
    const lastDuration = durationMap[lastNote.duration] || 0.5;
    
    return lastTime + lastDuration;
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
