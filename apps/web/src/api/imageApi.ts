/**
 * Client API utilities for communicating with the backend
 */

/**
 * Analysis request/response types
 */
export interface AnalyzeRequest {
  mood: string;
  duration: number;
  onboardingData?: {
    emotionalProfile?: string;
    preferences?: Record<string, any>;
  };
  freeText?: string;
  timestamp?: string;
}

export interface AnalyzeResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface IntermediateRepresentation {
  valence: number;
  arousal: number;
  focus: number;
  motif_tags: string[];
  confidence: number;
  classical_profile?: {
    tempo?: string;
    dynamics?: string;
    harmony?: string;
  };
}

export interface AnalysisJobStatus {
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
  input: AnalyzeRequest;
  result?: IntermediateRepresentation;
}

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

/**
 * Analyze session data to generate intermediate representation
 */
export async function analyzeSession(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || error.error || 'Failed to analyze session');
  }

  return response.json();
}

/**
 * Get analysis job status
 */
export async function getAnalysisJobStatus(jobId: string): Promise<AnalysisJobStatus> {
  const response = await fetch(`${API_BASE}/api/analyze/${jobId}`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || error.error || 'Failed to get analysis job status');
  }

  return response.json();
}

/**
 * Poll analysis job status until completion
 */
export async function pollAnalysisJobStatus(
  jobId: string,
  onUpdate?: (status: AnalysisJobStatus) => void,
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<AnalysisJobStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getAnalysisJobStatus(jobId);
    
    if (onUpdate) {
      onUpdate(status);
    }

    if (status.status === 'succeeded' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Analysis job polling timeout');
}

/**
 * Music generation types (P4)
 */
export interface GenerateMusicRequest {
  valence: number;
  arousal: number;
  focus: number;
  motif_tags: string[];
  confidence: number;
  duration?: number;
  seed?: number;
}

export interface GenerateMusicResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface MusicStructure {
  key: string;
  tempo: number;
  timeSignature: string;
  form: string;
  sections: any[];
  instrumentation: string;
  character: string;
}

export interface MusicJobStatus {
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
  input: GenerateMusicRequest;
  result?: MusicStructure;
  midiData?: string;
}

/**
 * Generate music using the API
 */
export async function generateMusic(
  request: GenerateMusicRequest
): Promise<GenerateMusicResponse> {
  const response = await fetch(`${API_BASE}/api/music/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || error.error || 'Failed to generate music');
  }

  return response.json();
}

/**
 * Get music generation job status
 */
export async function getMusicJobStatus(jobId: string): Promise<MusicJobStatus> {
  const response = await fetch(`${API_BASE}/api/music/${jobId}`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || error.error || 'Failed to get music job status');
  }

  return response.json();
}

/**
 * Poll music job status until completion
 */
export async function pollMusicJobStatus(
  jobId: string,
  onUpdate?: (status: MusicJobStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<MusicJobStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getMusicJobStatus(jobId);
    
    if (onUpdate) {
      onUpdate(status);
    }

    if (status.status === 'succeeded' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Music job polling timeout');
}
