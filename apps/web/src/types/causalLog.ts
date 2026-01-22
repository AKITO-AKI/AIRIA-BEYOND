/**
 * P5: Causal Log Types
 * Data model for tracking the entire generation flow with explainability
 */

export interface CausalLog {
  id: string;
  sessionId: string;
  createdAt: Date;
  
  // Input stage
  input: {
    mood?: string;
    onboardingAnswers?: object;
    customInput?: string;
    duration?: number;
    timestamp: Date;
  };
  
  // Analysis stage (P2)
  analysis?: {
    intermediateRepresentation: {
      valence: number;
      arousal: number;
      focus: number;
      motif_tags: string[];
      confidence: number;
    };
    reasoning: string;  // LLM's explanation of why these values
    timestamp: Date;
    duration: number;  // ms
    provider: string;  // "openai", "rule-based", etc.
    model: string;
  };
  
  // Image generation stage (P3)
  imageGeneration?: {
    prompt: string;
    negativePrompt: string;
    stylePreset: string;
    seed?: number;
    reasoning: string;  // Why this prompt/style was chosen
    jobId: string;
    provider: string;  // "replicate"
    model: string;  // "sdxl"
    resultUrl: string;
    timestamp: Date;
    duration: number;
    retryCount: number;
  };
  
  // Music generation stage (P4)
  musicGeneration?: {
    structure: any;  // The LLM-generated music JSON - use any for flexibility
    reasoning: string;  // Why this structure (key, tempo, form, etc.)
    midiUrl?: string;
    audioUrl?: string;
    jobId: string;
    provider: string;
    model: string;
    timestamp: Date;
    duration: number;
    retryCount: number;
  };
  
  // Album creation stage
  album?: {
    albumId: string;
    title: string;
    timestamp: Date;
  };
  
  // Overall metadata
  totalDuration: number;
  success: boolean;
  errors?: Array<{ stage: string; error: string; timestamp: Date }>;
}

export interface CausalLogSummary {
  id: string;
  sessionId: string;
  createdAt: Date;
  success: boolean;
  totalDuration: number;
  albumId?: string;
}
