/**
 * Job Store - In-memory job tracking for image generation
 * 
 * For prototype: uses in-memory storage
 * Future: can be upgraded to Vercel KV or other persistent storage
 */

/**
 * @typedef {Object} JobDataInput
 * @property {string} [mood]
 * @property {number} [duration]
 * @property {string} [stylePreset]
 * @property {number} [seed]
 * @property {string[]} [motifTags]
 * @property {number} [valence]
 * @property {number} [arousal]
 * @property {number} [focus]
 * @property {number} [confidence]
 */

/**
 * @typedef {Object} JobDataInputSummary
 * @property {string} [mood]
 * @property {number} [duration]
 * @property {string} [stylePreset]
 * @property {number} [seed]
 */

/**
 * @typedef {Object} JobData
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
 * @property {string} provider
 * @property {string} model
 * @property {JobDataInput} input
 * @property {JobDataInputSummary} inputSummary
 * @property {string} [result]
 * @property {string} [resultUrl]
 * @property {string} [replicatePredictionId]
 * @property {string[]} [warnings]
 * @property {boolean} [fallbackUsed]
 * @property {string} [effectiveProvider]
 * @property {string} [fallbackReason]
 * @property {string} [generationError]
 */

// In-memory store (simple for prototype)
const jobs = new Map();

// Cleanup old jobs after 1 hour
const JOB_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Create a new job
 * @param {Object} data
 * @param {string} data.provider
 * @param {string} data.model
 * @param {JobDataInput} data.input
 * @param {JobDataInputSummary} data.inputSummary
 * @param {number} [data.maxRetries]
 * @returns {JobData}
 */
export function createJob(data) {
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const job = {
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

/**
 * Get a job by ID
 * @param {string} id
 * @returns {JobData | undefined}
 */
export function getJob(id) {
  return jobs.get(id);
}

/**
 * Update a job with partial data
 * @param {string} id
 * @param {Partial<JobData>} updates
 * @returns {JobData | undefined}
 */
export function updateJob(id, updates) {
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
 * @param {string} id
 * @returns {JobData | undefined}
 */
export function incrementRetryCount(id) {
  const job = jobs.get(id);
  if (!job) return undefined;
  
  const updatedJob = { ...job, retryCount: job.retryCount + 1 };
  jobs.set(id, updatedJob);
  
  console.log(`[JobStore] Job ${id} retry attempt ${updatedJob.retryCount}/${updatedJob.maxRetries}`);
  
  return updatedJob;
}

/**
 * Get all jobs
 * @returns {JobData[]}
 */
export function getAllJobs() {
  return Array.from(jobs.values());
}

/**
 * Clear all jobs (for testing/admin)
 * @returns {void}
 */
export function clearAllJobs() {
  const count = jobs.size;
  jobs.clear();
  console.log(`[JobStore] Cleared ${count} jobs`);
}

/**
 * Delete a specific job
 * @param {string} id
 * @returns {boolean}
 */
export function deleteJob(id) {
  const deleted = jobs.delete(id);
  if (deleted) {
    console.log(`[JobStore] Deleted job ${id}`);
  }
  return deleted;
}
