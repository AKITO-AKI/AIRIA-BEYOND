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
  provider: string;
  model: string;
  inputSummary: {
    mood?: string;
    duration?: number;
    stylePreset?: string;
    seed?: number;
  };
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
  inputSummary: JobData['inputSummary'];
}): JobData {
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const job: JobData = {
    id,
    status: 'queued',
    createdAt: new Date().toISOString(),
    provider: data.provider,
    model: data.model,
    inputSummary: data.inputSummary,
  };
  
  jobs.set(id, job);
  
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
  return updatedJob;
}

export function getAllJobs(): JobData[] {
  return Array.from(jobs.values());
}
