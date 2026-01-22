/**
 * In-memory job store for music generation jobs (P4)
 * Similar to analysisJobStore.ts but for music generation
 */

import type { MusicJobData, GenerateMusicRequest } from './types';

// In-memory job store
const jobs = new Map<string, MusicJobData>();

// Job ID counter
let jobIdCounter = 0;

/**
 * Create a new music generation job
 */
export function createMusicJob(data: {
  provider: 'openai';
  input: GenerateMusicRequest;
  maxRetries?: number;
}): MusicJobData {
  const jobId = `music_job_${Date.now()}_${jobIdCounter++}`;

  const job: MusicJobData = {
    id: jobId,
    status: 'queued',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: data.maxRetries ?? 2,
    provider: data.provider,
    input: data.input,
  };

  jobs.set(jobId, job);
  console.log(`[MusicJobStore] Created job ${jobId}`);

  return job;
}

/**
 * Get a job by ID
 */
export function getMusicJob(jobId: string): MusicJobData | undefined {
  return jobs.get(jobId);
}

/**
 * Update job with partial data
 */
export function updateMusicJob(
  jobId: string,
  updates: Partial<MusicJobData>
): void {
  const job = jobs.get(jobId);
  if (!job) {
    console.error(`[MusicJobStore] Job ${jobId} not found`);
    return;
  }

  Object.assign(job, updates);
  console.log(`[MusicJobStore] Updated job ${jobId}:`, updates);
}

/**
 * Increment retry count for a job
 */
export function incrementMusicJobRetryCount(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) {
    console.error(`[MusicJobStore] Job ${jobId} not found`);
    return;
  }

  job.retryCount++;
  console.log(`[MusicJobStore] Job ${jobId} retry count: ${job.retryCount}`);
}

/**
 * Delete old jobs to prevent memory leaks
 * Call this periodically to clean up completed/failed jobs older than 1 hour
 */
export function cleanupOldMusicJobs(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let deletedCount = 0;

  for (const [jobId, job] of jobs.entries()) {
    const jobTime = new Date(job.createdAt).getTime();
    const isOld = jobTime < oneHourAgo;
    const isCompleted = job.status === 'succeeded' || job.status === 'failed';

    if (isOld && isCompleted) {
      jobs.delete(jobId);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`[MusicJobStore] Cleaned up ${deletedCount} old jobs`);
  }
}

// Schedule cleanup every 30 minutes
setInterval(cleanupOldMusicJobs, 30 * 60 * 1000);
