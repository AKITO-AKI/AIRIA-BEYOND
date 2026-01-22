/**
 * POST /api/analyze
 * 
 * Analyze session data and generate intermediate representation using LLM
 * Integrates with P1 job system for status tracking and retry logic
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createAnalysisJob, updateAnalysisJob } from '../analysisJobStore';
import { checkRateLimit, checkConcurrency, releaseJob } from '../rateLimiter';
import { generateIR } from '../llmService';
import type { AnalyzeRequest, SessionInput } from '../types';

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
 * Execute analysis with retry logic
 */
async function executeAnalysis(
  jobId: string,
  input: SessionInput,
  clientId: string
): Promise<void> {
  try {
    console.log(`[Analysis] Starting job ${jobId}`);

    // Update job status to running
    updateAnalysisJob(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    // Generate IR using LLM with fallback
    const { ir, provider } = await generateIR(input);

    // Update provider if it changed (e.g., fell back to rules)
    updateAnalysisJob(jobId, { provider });

    // Update job as succeeded
    updateAnalysisJob(jobId, {
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      result: ir,
    });

    console.log(`[Analysis] Job ${jobId} completed successfully with provider: ${provider}`);
  } catch (error: any) {
    console.error(`[Analysis] Job ${jobId} failed:`, error);

    const errorCode = error?.response?.status === 429
      ? ERROR_CODES.RATE_LIMIT
      : error?.message?.includes('timeout')
      ? ERROR_CODES.TIMEOUT
      : error?.message?.includes('validation')
      ? ERROR_CODES.VALIDATION_ERROR
      : ERROR_CODES.API_ERROR;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    updateAnalysisJob(jobId, {
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
      message: 'You have too many analyses running. Please wait for one to complete.',
    });
  }

  try {
    // Parse request body
    const body: AnalyzeRequest = req.body;
    const { mood, duration, onboardingData, freeText, timestamp } = body;

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
    const sessionInput: SessionInput = {
      mood,
      duration,
      onboardingData,
      freeText,
      timestamp: timestamp || new Date().toISOString(),
    };

    // Create job (start with 'openai' provider, may change to 'rule-based' if fallback)
    const job = createAnalysisJob({
      provider: 'openai',
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
