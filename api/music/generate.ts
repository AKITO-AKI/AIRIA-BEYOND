/**
 * POST /api/music/generate
 * 
 * Generate classical music from intermediate representation
 * Returns a job ID immediately, actual generation happens async
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMusicJob, updateMusicJob, getMusicJob } from '../musicJobStore';
import { checkRateLimit, checkConcurrency, releaseJob } from '../rateLimiter';
import { generateMusicStructureWithFallback } from '../musicLLMService';
import { musicStructureToMIDI } from '../midiConverter';
import type { GenerateMusicRequest } from '../types';

// Error codes
const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
} as const;

// Helper to get client identifier (IP address)
function getClientIdentifier(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return (req.headers['x-real-ip'] as string) || 'unknown';
}

/**
 * Execute music generation with retry logic
 */
async function executeMusicGeneration(
  jobId: string,
  request: GenerateMusicRequest,
  clientId: string
): Promise<void> {
  try {
    console.log(`[MusicGeneration] Starting job ${jobId}`);

    // Update job status to running
    updateMusicJob(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    // Generate music structure using LLM (with fallback)
    const { structure, provider } = await generateMusicStructureWithFallback(request);

    // Update provider if it changed (e.g., fell back to rules)
    updateMusicJob(jobId, { provider });

    console.log(`[MusicGeneration] Generated structure with provider: ${provider}`);

    // Convert structure to MIDI
    const midiData = musicStructureToMIDI(structure);

    console.log(`[MusicGeneration] Converted to MIDI (${midiData.length} bytes base64)`);

    // Update job as succeeded
    updateMusicJob(jobId, {
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      result: structure,
      midiData,
    });

    console.log(`[MusicGeneration] Job ${jobId} completed successfully`);
  } catch (error: any) {
    console.error(`[MusicGeneration] Job ${jobId} failed:`, error);

    const errorCode = error?.response?.status === 429
      ? ERROR_CODES.RATE_LIMIT
      : error?.message?.includes('timeout')
      ? ERROR_CODES.TIMEOUT
      : error?.message?.includes('validation')
      ? ERROR_CODES.VALIDATION_ERROR
      : ERROR_CODES.API_ERROR;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    updateMusicJob(jobId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      errorCode,
      errorMessage,
      error: errorMessage,
    });
  } finally {
    // Release concurrency slot
    releaseJob(clientId);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client identifier for rate limiting
  const clientId = getClientIdentifier(req);

  // Check rate limit
  if (!checkRateLimit(clientId)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute and try again.',
    });
  }

  // Check concurrency limit
  if (!checkConcurrency(clientId)) {
    return res.status(429).json({
      error: 'Too many concurrent jobs',
      message: 'You have too many music generations running. Please wait for one to complete.',
    });
  }

  try {
    // Parse request body
    const body: GenerateMusicRequest = req.body;
    const { valence, arousal, focus, motif_tags, confidence, duration, seed } = body;

    // Validate required fields
    if (valence === undefined || arousal === undefined || focus === undefined) {
      releaseJob(clientId);
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'valence, arousal, and focus are required'
      });
    }

    if (!motif_tags || motif_tags.length === 0) {
      releaseJob(clientId);
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'motif_tags are required'
      });
    }

    // Create job
    const job = createMusicJob({
      provider: 'openai',
      input: {
        valence,
        arousal,
        focus,
        motif_tags,
        confidence: confidence ?? 0.5,
        duration: duration ?? 75,
        seed,
      },
      maxRetries: 1,
    });

    // Start async music generation
    executeMusicGeneration(job.id, job.input, clientId);

    // Return job ID immediately
    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Music generation started',
    });
  } catch (error) {
    console.error('Request handling error:', error);
    releaseJob(clientId);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
