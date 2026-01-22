/**
 * P5: Causal Logging Helper Functions
 * Non-blocking async logging utilities for each stage of generation
 */

import { CausalLog } from '../../types/causalLog';

/**
 * Log input stage
 */
export function logInputStage(
  updateLog: (logId: string, updates: Partial<CausalLog>) => void,
  logId: string,
  sessionData: any
): void {
  try {
    // Input is already logged on createLog, but we can update if needed
    console.log('[CausalLog] Input stage logged for', logId);
  } catch (error) {
    console.error('[CausalLog] Failed to log input stage:', error);
    // Non-blocking: don't throw
  }
}

/**
 * Log analysis stage
 */
export function logAnalysisStage(
  updateLog: (logId: string, updates: Partial<CausalLog>) => void,
  logId: string,
  params: {
    ir: any;
    reasoning?: string;
    duration: number;
    provider: string;
    model: string;
  }
): void {
  try {
    const { ir, reasoning, duration, provider, model } = params;
    
    updateLog(logId, {
      analysis: {
        intermediateRepresentation: {
          valence: ir.valence,
          arousal: ir.arousal,
          focus: ir.focus,
          motif_tags: ir.motif_tags,
          confidence: ir.confidence,
        },
        reasoning: reasoning || 'No reasoning provided',
        timestamp: new Date(),
        duration,
        provider,
        model,
      },
    });
    
    console.log('[CausalLog] Analysis stage logged for', logId);
  } catch (error) {
    console.error('[CausalLog] Failed to log analysis stage:', error);
    // Non-blocking: don't throw
  }
}

/**
 * Log image generation stage
 */
export function logImageStage(
  updateLog: (logId: string, updates: Partial<CausalLog>) => void,
  logId: string,
  params: {
    prompt: string;
    negativePrompt: string;
    stylePreset: string;
    seed?: number;
    reasoning: string;
    jobId: string;
    provider: string;
    model: string;
    resultUrl: string;
    duration: number;
    retryCount: number;
  }
): void {
  try {
    updateLog(logId, {
      imageGeneration: {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        stylePreset: params.stylePreset,
        seed: params.seed,
        reasoning: params.reasoning,
        jobId: params.jobId,
        provider: params.provider,
        model: params.model,
        resultUrl: params.resultUrl,
        timestamp: new Date(),
        duration: params.duration,
        retryCount: params.retryCount,
      },
    });
    
    console.log('[CausalLog] Image generation stage logged for', logId);
  } catch (error) {
    console.error('[CausalLog] Failed to log image generation stage:', error);
    // Non-blocking: don't throw
  }
}

/**
 * Log music generation stage
 */
export function logMusicStage(
  updateLog: (logId: string, updates: Partial<CausalLog>) => void,
  logId: string,
  params: {
    structure: any;
    reasoning: string;
    midiUrl?: string;
    audioUrl?: string;
    jobId: string;
    provider: string;
    model: string;
    duration: number;
    retryCount: number;
  }
): void {
  try {
    updateLog(logId, {
      musicGeneration: {
        structure: params.structure,
        reasoning: params.reasoning,
        midiUrl: params.midiUrl,
        audioUrl: params.audioUrl,
        jobId: params.jobId,
        provider: params.provider,
        model: params.model,
        timestamp: new Date(),
        duration: params.duration,
        retryCount: params.retryCount,
      },
    });
    
    console.log('[CausalLog] Music generation stage logged for', logId);
  } catch (error) {
    console.error('[CausalLog] Failed to log music generation stage:', error);
    // Non-blocking: don't throw
  }
}

/**
 * Log album creation stage
 */
export function logAlbumStage(
  updateLog: (logId: string, updates: Partial<CausalLog>) => void,
  logId: string,
  params: {
    albumId: string;
    title: string;
  }
): void {
  try {
    updateLog(logId, {
      album: {
        albumId: params.albumId,
        title: params.title,
        timestamp: new Date(),
      },
      success: true,
    });
    
    console.log('[CausalLog] Album creation stage logged for', logId);
  } catch (error) {
    console.error('[CausalLog] Failed to log album creation stage:', error);
    // Non-blocking: don't throw
  }
}

/**
 * Log an error at any stage
 */
export function logError(
  updateLog: (logId: string, updates: Partial<CausalLog>) => void,
  getLog: (logId: string) => CausalLog | undefined,
  logId: string,
  stage: string,
  error: string
): void {
  try {
    const log = getLog(logId);
    const existingErrors = log?.errors || [];
    
    updateLog(logId, {
      errors: [
        ...existingErrors,
        {
          stage,
          error,
          timestamp: new Date(),
        },
      ],
    });
    
    console.log('[CausalLog] Error logged for', logId, 'at stage', stage);
  } catch (err) {
    console.error('[CausalLog] Failed to log error:', err);
    // Non-blocking: don't throw
  }
}
