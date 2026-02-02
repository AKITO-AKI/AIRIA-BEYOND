/**
 * Analysis Job Store - Tracks LLM analysis jobs
 * Similar to jobStore.ts but specialized for analysis
 */

/**
 * @typedef {Object} SessionInput
 * @property {string} [mood]
 * @property {number} [duration]
 * @property {string} [stylePreset]
 * @property {number} [seed]
 */

/**
 * @typedef {Object} IntermediateRepresentation
 * @property {number} valence
 * @property {number} arousal
 * @property {number} focus
 * @property {number} confidence
 * @property {string[]} motif_tags
 * @property {string} [reasoning]
 */

/**
 * @typedef {Object} AnalysisJobData
 * @property {string} id
 * @property {'queued' | 'running' | 'succeeded' | 'failed'} status
 * @property {string} createdAt
 * @property {string} [startedAt]
 * @property {string} [finishedAt]
 * @property {string} [error]
 * @property {string} [errorCode]
 * @property {string} [errorMessage]
 * @property {number} retryCount
 * @property {number} maxRetries
 * @property {'openai' | 'ollama' | 'rule-based'} provider
 * @property {SessionInput} input
 * @property {IntermediateRepresentation} [result]
 */

// In-memory store (simple for prototype)
const analysisJobs = new Map();

// Cleanup old jobs after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Create a new analysis job
 * @param {Object} data
 * @param {'openai' | 'ollama' | 'rule-based'} data.provider
 * @param {SessionInput} data.input
 * @param {number} [data.maxRetries]
 * @returns {AnalysisJobData}
 */
export function createAnalysisJob(data) {
  const id = `analysis_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const job = {
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

/**
 * Get an analysis job by ID
 * @param {string} id
 * @returns {AnalysisJobData | undefined}
 */
export function getAnalysisJob(id) {
  return analysisJobs.get(id);
}

/**
 * Update an analysis job with partial data
 * @param {string} id
 * @param {Partial<AnalysisJobData>} updates
 * @returns {AnalysisJobData | undefined}
 */
export function updateAnalysisJob(id, updates) {
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

/**
 * Increment retry count for an analysis job
 * @param {string} id
 * @returns {AnalysisJobData | undefined}
 */
export function incrementAnalysisRetryCount(id) {
  const job = analysisJobs.get(id);
  if (!job) return undefined;

  const updatedJob = { ...job, retryCount: job.retryCount + 1 };
  analysisJobs.set(id, updatedJob);

  console.log(
    `[AnalysisJobStore] Job ${id} retry attempt ${updatedJob.retryCount}/${updatedJob.maxRetries}`
  );

  return updatedJob;
}

/**
 * Get all analysis jobs
 * @returns {AnalysisJobData[]}
 */
export function getAllAnalysisJobs() {
  return Array.from(analysisJobs.values());
}

/**
 * Clear all analysis jobs (for testing/admin)
 * @returns {void}
 */
export function clearAllAnalysisJobs() {
  const count = analysisJobs.size;
  analysisJobs.clear();
  console.log(`[AnalysisJobStore] Cleared ${count} analysis jobs`);
}

/**
 * Delete a specific analysis job
 * @param {string} id
 * @returns {boolean}
 */
export function deleteAnalysisJob(id) {
  const deleted = analysisJobs.delete(id);
  if (deleted) {
    console.log(`[AnalysisJobStore] Deleted job ${id}`);
  }
  return deleted;
}
