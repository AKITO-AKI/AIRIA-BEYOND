/**
 * Analysis Job Store - Tracks LLM analysis jobs
 * Similar to jobStore.ts but specialized for analysis
 */

import { AnalysisJobData, SessionInput, IntermediateRepresentation } from './types';

// In-memory store (simple for prototype)
const analysisJobs = new Map<string, AnalysisJobData>();

// Cleanup old jobs after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000;

export function createAnalysisJob(data: {
  provider: 'openai' | 'rule-based';
  input: SessionInput;
  maxRetries?: number;
}): AnalysisJobData {
  const id = `analysis_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const job: AnalysisJobData = {
    id,
    status: 'queued',
    createdAt: new Date().toISOString(),
    provider: data.provider,
    input: data.input,
    retryCount: 0,
    maxRetries: data.maxRetries ?? 1, // Analysis usually doesn't need multiple retries
  };

  analysisJobs.set(id, job);

  console.log(`[AnalysisJobStore] Created job ${id}`, {
    provider: job.provider,
    mood: data.input.mood,
    duration: data.input.duration,
    createdAt: job.createdAt,
  });

  // Schedule cleanup
  setTimeout(() => {
    analysisJobs.delete(id);
  }, JOB_EXPIRY_MS);

  return job;
}

export function getAnalysisJob(id: string): AnalysisJobData | undefined {
  return analysisJobs.get(id);
}

export function updateAnalysisJob(
  id: string,
  updates: Partial<AnalysisJobData>
): AnalysisJobData | undefined {
  const job = analysisJobs.get(id);
  if (!job) return undefined;

  const updatedJob = { ...job, ...updates };
  analysisJobs.set(id, updatedJob);

  // Log status transitions
  if (updates.status && updates.status !== job.status) {
    console.log(`[AnalysisJobStore] Job ${id} status: ${job.status} -> ${updates.status}`, {
      previousStatus: job.status,
      newStatus: updates.status,
      provider: updatedJob.provider,
      error: updates.error,
      errorCode: updates.errorCode,
    });
  }

  return updatedJob;
}

export function incrementAnalysisRetryCount(id: string): AnalysisJobData | undefined {
  const job = analysisJobs.get(id);
  if (!job) return undefined;

  const updatedJob = { ...job, retryCount: job.retryCount + 1 };
  analysisJobs.set(id, updatedJob);

  console.log(
    `[AnalysisJobStore] Job ${id} retry attempt ${updatedJob.retryCount}/${updatedJob.maxRetries}`
  );

  return updatedJob;
}

export function getAllAnalysisJobs(): AnalysisJobData[] {
  return Array.from(analysisJobs.values());
}

export function clearAllAnalysisJobs(): void {
  const count = analysisJobs.size;
  analysisJobs.clear();
  console.log(`[AnalysisJobStore] Cleared ${count} analysis jobs`);
}

export function deleteAnalysisJob(id: string): boolean {
  const deleted = analysisJobs.delete(id);
  if (deleted) {
    console.log(`[AnalysisJobStore] Deleted job ${id}`);
  }
  return deleted;
}
