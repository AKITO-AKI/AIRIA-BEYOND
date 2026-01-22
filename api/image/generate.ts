/**
 * POST /api/image/generate
 * 
 * Generate an image using Replicate (SDXL)
 * Returns a job ID immediately, actual generation happens async
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Replicate from 'replicate';
import { createJob, updateJob } from '../jobStore';
import { checkRateLimit, checkConcurrency, releaseJob } from '../rateLimiter';
import { buildPrompt } from '../promptBuilder';

// SDXL model on Replicate
const SDXL_MODEL = 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

// Helper to get client identifier (IP address)
function getClientIdentifier(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] as string || 'unknown';
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if API token is configured
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return res.status(503).json({
      error: 'External image generation is not configured',
      message: 'REPLICATE_API_TOKEN is not set. Please use local generation instead.',
    });
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
      message: 'You have too many images generating. Please wait for one to complete.',
    });
  }

  try {
    // Parse request body
    const {
      mood,
      duration,
      motifTags = [],
      stylePreset = 'abstract-oil',
      seed,
      valence,
      arousal,
      focus,
      confidence,
    } = req.body;

    // Validate required fields
    if (!mood) {
      releaseJob(clientId);
      return res.status(400).json({ error: 'mood is required' });
    }

    // Build prompt from IR
    const { prompt, negativePrompt } = buildPrompt({
      mood,
      duration,
      motifTags,
      stylePreset,
    });

    // Create job
    const job = createJob({
      provider: 'replicate',
      model: SDXL_MODEL,
      inputSummary: {
        mood,
        duration,
        stylePreset,
        seed,
      },
    });

    // Start async generation
    (async () => {
      try {
        const replicate = new Replicate({
          auth: apiToken,
        });

        // Update job status to running
        updateJob(job.id, {
          status: 'running',
          startedAt: new Date().toISOString(),
        });

        // Run prediction
        const prediction = await replicate.run(SDXL_MODEL, {
          input: {
            prompt,
            negative_prompt: negativePrompt,
            width: 1024,
            height: 1024,
            num_inference_steps: 25,
            guidance_scale: 7.5,
            seed: seed || Math.floor(Math.random() * 1000000),
          },
        });

        // Get result URL (output is an array of URLs for SDXL)
        const resultUrl = Array.isArray(prediction) ? prediction[0] : prediction;

        // Update job as succeeded
        updateJob(job.id, {
          status: 'succeeded',
          finishedAt: new Date().toISOString(),
          resultUrl: resultUrl as string,
        });
      } catch (error) {
        console.error('Image generation error:', error);
        updateJob(job.id, {
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        // Release concurrency slot
        releaseJob(clientId);
      }
    })();

    // Return job ID immediately
    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Image generation started',
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
