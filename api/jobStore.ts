/**
 * Job Store - In-memory job tracking for image generation
 * 
 * For prototype: uses in-memory storage
 * Future: can be upgraded to Vercel KV or other persistent storage
 */

export interface JobData {
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
  replicatePredictionId?: string;
}

// In-memory store (simple for prototype)
const jobs = new Map<string, JobData>();

// Cleanup old jobs after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000;

export function createJob(data: {
  provider: string;
  model: string;
  input: JobData['input'];
  inputSummary: JobData['inputSummary'];
  maxRetries?: number;
}): JobData {
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const job: JobData = {
    id,
    status: 'queued',
    createdAt: new Date().toISOString(),
    provider: data.provider,
    model: data.model,
    input: data.input,
    inputSummary: data.inputSummary,
    retryCount: 0,
    maxRetries: data.maxRetries ?? 3,
  };
  
  jobs.set(id, job);
  
  // Log job creation
  console.log(`[JobStore] Created job ${id}`, {
    provider: job.provider,
    model: job.model,
    inputSummary: job.inputSummary,
    createdAt: job.createdAt,
  });
  
  // Schedule cleanup
  setTimeout(() => {
    jobs.delete(id);
  }, JOB_EXPIRY_MS);
  
  return job;
}

export function getJob(id: string): JobData | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<JobData>): JobData | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  
  const updatedJob = { ...job, ...updates };
  jobs.set(id, updatedJob);
  
  // Log status transitions
  if (updates.status && updates.status !== job.status) {
    console.log(`[JobStore] Job ${id} status: ${job.status} -> ${updates.status}`, {
      previousStatus: job.status,
      newStatus: updates.status,
      retryCount: updatedJob.retryCount,
      error: updates.error,
      errorCode: updates.errorCode,
    });
  }
  
  return updatedJob;
}

/**
 * Increment retry count for a job
 */
export function incrementRetryCount(id: string): JobData | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  
  const updatedJob = { ...job, retryCount: job.retryCount + 1 };
  jobs.set(id, updatedJob);
  
  console.log(`[JobStore] Job ${id} retry attempt ${updatedJob.retryCount}/${updatedJob.maxRetries}`);
  
  return updatedJob;
}

export function getAllJobs(): JobData[] {
  return Array.from(jobs.values());
}

/**
 * Clear all jobs (for testing/admin)
 */
export function clearAllJobs(): void {
  const count = jobs.size;
  jobs.clear();
  console.log(`[JobStore] Cleared ${count} jobs`);
}

/**
 * Delete a specific job
 */
export function deleteJob(id: string): boolean {
  const deleted = jobs.delete(id);
  if (deleted) {
    console.log(`[JobStore] Deleted job ${id}`);
  }
  return deleted;
}
