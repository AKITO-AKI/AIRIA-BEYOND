/**
 * Client API utilities for communicating with the backend
 */

export interface GenerateImageRequest {
  mood: string;
  duration: number;
  motifTags?: string[];
  stylePreset?: string;
  seed?: number;
  valence?: number;
  arousal?: number;
  focus?: number;
  confidence?: number;
}

export interface GenerateImageResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface JobStatus {
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
  provider: string;
  model: string;
  input: {
    mood?: string;
    duration?: number;
    stylePreset?: string;
    seed?: number;
    motifTags?: string[];
    valence?: number;
    arousal?: number;
    focus?: number;
    confidence?: number;
  };
  inputSummary: {
    mood?: string;
    duration?: number;
    stylePreset?: string;
    seed?: number;
  };
  result?: string;
  resultUrl?: string;
}

export interface ApiError {
  error: string;
  message?: string;
}

// Detect API base URL (local dev vs deployed)
const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

/**
 * Generate an image using the external API
 */
export async function generateImage(
  request: GenerateImageRequest
): Promise<GenerateImageResponse> {
  const response = await fetch(`${API_BASE}/api/image/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || error.error || 'Failed to generate image');
  }

  return response.json();
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE}/api/job/${jobId}`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || error.error || 'Failed to get job status');
  }

  return response.json();
}

/**
 * Poll job status until completion
 * @param jobId Job ID to poll
 * @param onUpdate Callback for status updates
 * @param maxAttempts Maximum number of polling attempts (default: 60)
 * @param intervalMs Polling interval in milliseconds (default: 2000)
 */
export async function pollJobStatus(
  jobId: string,
  onUpdate?: (status: JobStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<JobStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getJobStatus(jobId);
    
    if (onUpdate) {
      onUpdate(status);
    }

    if (status.status === 'succeeded' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Job polling timeout');
}

/**
 * Retry a failed job by creating a new generation with the same input
 */
export async function retryJob(failedJobId: string): Promise<GenerateImageResponse> {
  // Get the failed job to extract input parameters
  const failedJob = await getJobStatus(failedJobId);
  
  if (!failedJob.input) {
    throw new Error('Cannot retry: job input not available');
  }
  
  // Create a new generation with the same input
  return generateImage({
    mood: failedJob.input.mood || '',
    duration: failedJob.input.duration || 60,
    motifTags: failedJob.input.motifTags,
    stylePreset: failedJob.input.stylePreset,
    seed: failedJob.input.seed,
    valence: failedJob.input.valence,
    arousal: failedJob.input.arousal,
    focus: failedJob.input.focus,
    confidence: failedJob.input.confidence,
  });
}
