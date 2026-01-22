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
