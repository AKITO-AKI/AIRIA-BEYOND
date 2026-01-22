/**
 * Type definitions for Prototype P2: LLM-based analysis
 * Intermediate Representation (IR) and related types
 */

import { z } from 'zod';

/**
 * Session input data for LLM analysis
 */
export interface SessionInput {
  mood: string;
  duration: number;
  onboardingData?: {
    emotionalProfile?: string;
    preferences?: Record<string, any>;
  };
  freeText?: string;
  timestamp: string;
}

/**
 * Intermediate Representation (IR) - output from LLM analysis
 */
export interface IntermediateRepresentation {
  valence: number; // -1.0 to +1.0 (negative=unpleasant, positive=pleasant)
  arousal: number; // 0.0 to 1.0 (low=calm, high=excited)
  focus: number; // 0.0 to 1.0 (attention/concentration level)
  motif_tags: string[]; // classical/artistic vocabulary, 3-5 tags
  confidence: number; // 0.0 to 1.0 (how confident the analysis is)
  classical_profile?: {
    // Additional classical music hints for P4
    tempo?: string;
    dynamics?: string;
    harmony?: string;
  };
  reasoning?: string; // P5: LLM's explanation of why these values were chosen
}

/**
 * Zod schema for IR validation
 */
export const IntermediateRepresentationSchema = z.object({
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(0).max(1),
  focus: z.number().min(0).max(1),
  motif_tags: z.array(z.string()).min(3).max(5),
  confidence: z.number().min(0).max(1),
  classical_profile: z
    .object({
      tempo: z.string().optional(),
      dynamics: z.string().optional(),
      harmony: z.string().optional(),
    })
    .optional(),
  reasoning: z.string().optional(), // P5: reasoning for causal logging
});

/**
 * Analysis job data extending base JobData
 */
export interface AnalysisJobData {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  provider: 'openai' | 'rule-based';
  input: SessionInput;
  result?: IntermediateRepresentation;
}

/**
 * Analysis request/response types
 */
export interface AnalyzeRequest {
  mood: string;
  duration: number;
  onboardingData?: SessionInput['onboardingData'];
  freeText?: string;
  timestamp?: string;
}

export interface AnalyzeResponse {
  jobId: string;
  status: string;
  message: string;
}

/**
 * Music generation types (P4)
 */
export interface MusicStructure {
  key: string; // e.g., "d minor"
  tempo: number; // BPM
  timeSignature: string; // e.g., "3/4"
  form: string; // e.g., "ABA", "theme-variation", "rondo"
  sections: MusicSection[];
  instrumentation: string; // e.g., "piano"
  character: string; // e.g., "melancholic and introspective"
  reasoning?: string; // P5: LLM's explanation of musical choices
}

export interface MusicSection {
  name: string; // e.g., "A", "B"
  measures: number;
  chordProgression: string[]; // Roman numeral analysis, e.g., ["i", "iv", "V", "i"]
  melody: {
    motifs: MusicMotif[];
  };
  dynamics: string; // pp, p, mp, mf, f, ff
  texture: string; // simple, contrapuntal, homophonic
}

export interface MusicMotif {
  degrees: number[]; // scale degrees, e.g., [1, 3, 5, 3]
  rhythm: number[]; // durations in beats, e.g., [0.5, 0.5, 1, 1]
}

export interface GenerateMusicRequest {
  // Intermediate representation
  valence: number;
  arousal: number;
  focus: number;
  motif_tags: string[];
  confidence: number;
  // Optional parameters
  duration?: number; // in seconds, default 60-90
  seed?: number;
}

export interface GenerateMusicResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface MusicJobData {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  provider: 'openai';
  input: GenerateMusicRequest;
  result?: MusicStructure;
  midiData?: string; // Base64 encoded MIDI data
}
