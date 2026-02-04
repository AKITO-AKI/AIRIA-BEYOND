/**
 * POST /api/analyze
 * 
 * Analyze session data and generate intermediate representation using LLM
 * Integrates with P1 job system for status tracking and retry logic
 */

import { createAnalysisJob, updateAnalysisJob } from '../analysisJobStore.js';
import { checkRateLimit, checkConcurrency, releaseJob } from '../lib/rate-limit.js';
import { generateIR } from '../llmService.js';

function hasOllamaConfigured() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL);
}

function getInitialProvider() {
  const pref = String(process.env.LLM_PROVIDER ?? '').toLowerCase();
  const hasOllama = hasOllamaConfigured();
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const disableLLM = !!process.env.DISABLE_LLM_ANALYSIS;

  if (disableLLM) return 'rule-based';
  if (pref === 'ollama' && hasOllama) return 'ollama';
  if (pref === 'openai' && hasOpenAI) return 'openai';
  if (hasOllama && pref !== 'openai') return 'ollama';
  if (hasOpenAI) return 'openai';
  return 'rule-based';
}

// Error codes
const ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
};

// Timeout for analysis generation (LLM can be slow; we always have a rules fallback)
const ANALYSIS_TIMEOUT_MS = 60 * 1000;

async function runWithTimeout(promise, timeoutMs) {
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Analysis timeout after ${timeoutMs / 1000}s`)), timeoutMs);
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
 * Execute analysis with retry logic
 * @param {string} jobId - Job ID
 * @param {Object} input - Session input data
 * @param {string} clientId - Client identifier for rate limiting
 */
async function executeAnalysis(jobId, input, clientId) {
  try {
    console.log(`[Analysis] Starting job ${jobId}`);

    // Update job status to running
    updateAnalysisJob(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    // Generate IR using LLM with fallback; enforce a hard timeout.
    let ir;
    let provider;
    try {
      const out = await runWithTimeout(generateIR(input), ANALYSIS_TIMEOUT_MS);
      ir = out.ir;
      provider = out.provider;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Analysis] Timed out or errored; using rule-based IR:', msg);
      const out = await generateIR(input, true);
      ir = out.ir;
      provider = 'rule-based';
      updateAnalysisJob(jobId, {
        errorCode: ERROR_CODES.TIMEOUT,
        errorMessage: msg,
        error: msg,
        fallbackUsed: true,
        fallbackReason: ERROR_CODES.TIMEOUT,
      });
    }

    // Update provider if it changed (e.g., fell back to rules)
    updateAnalysisJob(jobId, { provider });

    // Update job as succeeded
    updateAnalysisJob(jobId, {
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      result: ir,
    });

    console.log(`[Analysis] Job ${jobId} completed successfully with provider: ${provider}`);
  } catch (error) {
    console.error(`[Analysis] Job ${jobId} failed:`, error);

    const errorCode = error?.response?.status === 429
      ? ERROR_CODES.RATE_LIMIT
      : error?.message?.includes('timeout')
      ? ERROR_CODES.TIMEOUT
      : error?.message?.includes('validation')
      ? ERROR_CODES.VALIDATION_ERROR
      : ERROR_CODES.API_ERROR;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Defense-in-depth: never brick the UX; fall back to rules and succeed.
    try {
      const fallback = await generateIR(input, true);
      updateAnalysisJob(jobId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        provider: 'rule-based',
        result: fallback.ir,
        errorCode,
        errorMessage,
        error: errorMessage,
        fallbackUsed: true,
        fallbackReason: errorCode,
      });
    } catch {
      updateAnalysisJob(jobId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorCode,
        errorMessage,
        error: errorMessage,
      });
    }
  } finally {
    // Release concurrency slot
    releaseJob(clientId);
  }
}

/**
 * Analyze session data handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function analyzeSession(req, res) {
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
      message: 'You have too many analyses running. Please wait for one to complete.',
    });
  }

  try {
    // Parse request body
    const { mood, duration, onboardingData, freeText, timestamp } = req.body;

    // Validate required fields
    if (!mood) {
      releaseJob(clientId);
      return res.status(400).json({ error: 'mood is required' });
    }

    if (!duration || duration <= 0) {
      releaseJob(clientId);
      return res.status(400).json({ error: 'duration must be a positive number' });
    }

    // Build session input
    const sessionInput = {
      mood,
      duration,
      onboardingData,
      freeText,
      timestamp: timestamp || new Date().toISOString(),
    };

    // Create job (provider may update during execution if fallback happens)
    const job = createAnalysisJob({
      provider: getInitialProvider(),
      input: sessionInput,
      maxRetries: 1,
    });

    // Start async analysis
    executeAnalysis(job.id, sessionInput, clientId);

    // Return job ID immediately
    return res.status(202).json({
      jobId: job.id,
      status: 'queued',
      message: 'Analysis started',
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
