/**
 * POST /api/image/generate
 * 
 * Generate an image using Replicate (SDXL) or local ComfyUI
 * Returns a job ID immediately, actual generation happens async
 */

import Replicate from 'replicate';
import { createJob, updateJob, incrementRetryCount, getJob } from '../jobStore.js';
import { checkRateLimit, checkConcurrency, releaseJob } from '../lib/rate-limit.js';
import { buildPrompt } from '../promptBuilder.js';
import { trackUsage } from '../lib/usage-tracker.js';
import { debugAiConsole, debugAiLog } from '../lib/aiDebug.js';
import {
  buildBasicComfyWorkflow,
  comfyuiSubmitPrompt,
  comfyuiWaitForImage,
  comfyuiFetchImageBytes,
  bytesToDataUrl,
} from '../lib/comfyuiClient.js';

// SDXL model on Replicate
const SDXL_MODEL = 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

// SDXL generation parameters
const SDXL_PARAMS = {
  width: 1024,
  height: 1024,
  num_inference_steps: 25,
  guidance_scale: 7.5,
};

// Timeout for image generation (120 seconds)
const GENERATION_TIMEOUT_MS = 120 * 1000;

// Retry configuration
const INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds
const MAX_RETRY_DELAY_MS = 30000; // 30 seconds

// Error codes
const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
};

function resolveImageProvider(requestedProvider) {
  const pref = String(requestedProvider ?? process.env.IMAGE_PROVIDER ?? '').toLowerCase();
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;

  if (pref === 'replicate') return 'replicate';
  if (pref === 'comfyui' || pref === 'comfy') return 'comfyui';
  if (pref === 'auto') {
    return hasReplicate ? 'replicate' : 'comfyui';
  }

  // Default mode:
  // - In dev/local, prefer ComfyUI to avoid paid services.
  // - In production, keep the legacy behavior if Replicate token exists.
  if (process.env.NODE_ENV === 'production') {
    return hasReplicate ? 'replicate' : 'comfyui';
  }
  return 'comfyui';
}

async function executeComfyUiGeneration(jobId, prompt, negativePrompt, seed) {
  const steps = Number(process.env.COMFYUI_STEPS) || 25;
  const cfg = Number(process.env.COMFYUI_CFG) || 7.5;
  const width = Number(process.env.COMFYUI_WIDTH) || 1024;
  const height = Number(process.env.COMFYUI_HEIGHT) || 1024;
  const sampler_name = process.env.COMFYUI_SAMPLER || 'euler';
  const scheduler = process.env.COMFYUI_SCHEDULER || 'normal';
  const checkpoint = process.env.COMFYUI_CHECKPOINT;

  updateJob(jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  const workflow = buildBasicComfyWorkflow({
    prompt,
    negativePrompt,
    seed,
    width,
    height,
    steps,
    cfg,
    sampler_name,
    scheduler,
    ckpt_name: checkpoint,
    filenamePrefix: `AIRIA_${jobId}`,
  });

  const promptId = await comfyuiSubmitPrompt({
    workflow,
    clientId: `airia_${jobId}`,
    debugTag: `ComfyUI_${jobId}`,
  });

  const { ref } = await comfyuiWaitForImage({
    promptId,
    debugTag: `ComfyUI_${jobId}`,
  });

  const { bytes, contentType } = await comfyuiFetchImageBytes(ref);
  const resultUrl = bytesToDataUrl(bytes, contentType);

  // Local usage, no paid cost.
  trackUsage('comfyui', 0, 'local-image-generation', {
    jobId,
    promptId,
    checkpoint: checkpoint || 'unknown',
    width,
    height,
    steps,
    cfg,
  });

  return { resultUrl, promptId };
}

/**
 * Get client identifier (IP address) from request
 * @param {Object} req - Express request object
 * @returns {string} Client identifier
 */
function getClientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'unknown';
}

/**
 * Check if error is transient and should be retried
 * @param {any} error - Error object
 * @returns {boolean} True if error is transient
 */
function isTransientError(error) {
  const errorMessage = error?.message || '';
  const errorStatus = error?.response?.status || error?.status;
  
  // Network errors
  if (errorMessage.includes('ECONNREFUSED') || 
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('network')) {
    return true;
  }
  
  // 5xx server errors from Replicate
  if (errorStatus && errorStatus >= 500 && errorStatus < 600) {
    return true;
  }
  
  // Rate limit errors (429)
  if (errorStatus === 429) {
    return true;
  }
  
  return false;
}

/**
 * Calculate exponential backoff delay
 * @param {number} retryCount - Current retry count
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(retryCount) {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Run Replicate prediction with timeout
 * @param {Promise} promise - Promise to run
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} jobId - Job ID for logging
 * @returns {Promise} Result with timeout
 */
async function runWithTimeout(promise, timeoutMs, jobId) {
  let timeoutHandle;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Generation timeout after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Execute image generation with retry logic
 * @param {Replicate} replicate - Replicate client
 * @param {string} jobId - Job ID
 * @param {string} prompt - Image prompt
 * @param {string} negativePrompt - Negative prompt
 * @param {number} seed - Random seed
 * @param {string} clientId - Client identifier for rate limiting
 * @returns {Promise<string>} Result URL
 */
async function executeGeneration(replicate, jobId, prompt, negativePrompt, seed, clientId) {
  const job = getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  
  const maxRetries = job.maxRetries;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Generation] Job ${jobId} attempt ${attempt + 1}/${maxRetries + 1}`);
      
      // Update job status to running on first attempt
      if (attempt === 0) {
        updateJob(jobId, {
          status: 'running',
          startedAt: new Date().toISOString(),
        });
      }
      
      // Run prediction with timeout
      const prediction = await runWithTimeout(
        replicate.run(SDXL_MODEL, {
          input: {
            prompt,
            negative_prompt: negativePrompt,
            ...SDXL_PARAMS,
            seed,
          },
        }),
        GENERATION_TIMEOUT_MS,
        jobId
      );
      
      // Get result URL
      const resultUrl = Array.isArray(prediction) ? prediction[0] : prediction;
      
      if (!resultUrl || typeof resultUrl !== 'string') {
        throw new Error('Invalid result from Replicate');
      }
      
      // Track API usage cost (approximate cost per image)
      trackUsage('replicate', 0.0055, 'sdxl-image-generation', { 
        model: SDXL_MODEL,
        jobId,
        attempt: attempt + 1
      });
      
      console.log(`[Generation] Job ${jobId} succeeded on attempt ${attempt + 1}`);
      return resultUrl;
      
    } catch (error) {
      lastError = error;
      
      // Check if timeout
      if (error.message?.includes('timeout')) {
        console.error(`[Generation] Job ${jobId} timeout on attempt ${attempt + 1}:`, error.message);
        
        updateJob(jobId, {
          errorCode: ERROR_CODES.TIMEOUT,
          errorMessage: error.message,
        });
        
        // Don't retry on timeout - it's unlikely to succeed
        if (attempt >= maxRetries) {
          break;
        }
      }
      // Check if transient error and should retry
      else if (isTransientError(error) && attempt < maxRetries) {
        console.error(`[Generation] Job ${jobId} transient error on attempt ${attempt + 1}:`, error.message);
        
        // Increment retry count
        incrementRetryCount(jobId);
        
        // Wait with exponential backoff before retry
        const delay = getRetryDelay(attempt);
        console.log(`[Generation] Job ${jobId} retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        continue;
      }
      // Non-transient error or max retries reached
      else {
        console.error(`[Generation] Job ${jobId} permanent error on attempt ${attempt + 1}:`, error.message);
        
        const errorCode = error.response?.status === 429 ? ERROR_CODES.RATE_LIMIT :
                          isTransientError(error) ? ERROR_CODES.NETWORK_ERROR :
                          ERROR_CODES.API_ERROR;
        
        updateJob(jobId, {
          errorCode,
          errorMessage: error.message,
        });
        
        break;
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}

/**
 * Generate image handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function generateImage(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provider = resolveImageProvider(req.body?.provider);
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (provider === 'replicate' && !apiToken) {
    return res.status(503).json({
      error: 'External image generation is not configured',
      message: 'REPLICATE_API_TOKEN is not set. Set IMAGE_PROVIDER=comfyui or start ComfyUI locally.',
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
      stylePreset,
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

    // Build prompt from IR (P3 Enhanced)
    const { prompt, negativePrompt } = buildPrompt({
      mood,
      duration,
      motifTags,
      stylePreset,
      valence,
      arousal,
      focus,
    });

    debugAiConsole('image.generate.request', {
      provider,
      mood,
      duration,
      stylePreset,
      motifTagsCount: Array.isArray(motifTags) ? motifTags.length : 0,
    });

    // Create job with full input data
    const job = createJob({
      provider,
      model: provider === 'replicate' ? SDXL_MODEL : `comfyui:${process.env.COMFYUI_CHECKPOINT || 'workflow'}`,
      input: {
        mood,
        duration,
        motifTags,
        stylePreset,
        seed,
        valence,
        arousal,
        focus,
        confidence,
        provider,
      },
      inputSummary: {
        mood,
        duration,
        stylePreset,
        seed,
      },
    });

    debugAiLog('image_generate', {
      jobId: job.id,
      provider,
      model: job.model,
      prompt,
      negativePrompt,
      seed,
      input: job.input,
      inputSummary: job.inputSummary,
    });

    // Start async generation with retry logic
    (async () => {
      try {
        const finalSeed = seed || Math.floor(Math.random() * 1000000);
        let resultUrl;
        let extraMeta;

        if (provider === 'replicate') {
          resultUrl = await executeGeneration(
            new Replicate({ auth: apiToken }),
            job.id,
            prompt,
            negativePrompt,
            finalSeed,
            clientId
          );
        } else {
          const out = await executeComfyUiGeneration(job.id, prompt, negativePrompt, finalSeed);
          resultUrl = out.resultUrl;
          extraMeta = { comfyuiPromptId: out.promptId };
        }

        // Update job as succeeded
        updateJob(job.id, {
          status: 'succeeded',
          finishedAt: new Date().toISOString(),
          result: resultUrl,
          resultUrl: resultUrl,
          ...(extraMeta ? extraMeta : {}),
        });
        
        console.log(`[Generation] Job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`[Generation] Job ${job.id} failed permanently:`, error);
        
        const jobData = getJob(job.id);
        const errorCode = jobData?.errorCode || ERROR_CODES.API_ERROR;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        updateJob(job.id, {
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
