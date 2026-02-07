/**
 * In-memory job store for music generation jobs (P4)
 * Similar to analysisJobStore.ts but for music generation
 */

/**
 * @typedef {Object} GenerateMusicRequest
 * @property {string} [mood]
 * @property {number} [duration]
 * @property {string} [stylePreset]
 * @property {number} [seed]
 * @property {number} [valence]
 * @property {number} [arousal]
 * @property {number} [focus]
 * @property {number} [confidence]
 * @property {string[]} [motif_tags]
 * @property {string} [key] - e.g., "C major" or "d minor"
 * @property {number} [tempo] - BPM (40..220)
 * @property {string} [timeSignature] - e.g., "3/4", "4/4", "6/8"
 * @property {string} [form] - e.g., "sonata", "rondo", "ABA", "theme-variation"
 * @property {string} [period] - baroque|classical|romantic|modern
 * @property {string[]} [instrumentation] - hint list
 * @property {number[]} [motif_seed] - seed degrees (1..14)
 * @property {number[]} [rhythm_seed] - seed rhythm in beats
 * @property {any} [section_plan] - optional override object
 * @property {any} [emotional_arc] - optional narrative arc object
 * @property {any} [humanize] - optional performance shaping override
 */

/**
 * @typedef {Object} MusicJobData
 * @property {string} id
 * @property {'queued' | 'running' | 'succeeded' | 'failed'} status
 * @property {string | null} [userId]
 * @property {string} [emailNotifiedAt]
 * @property {string} createdAt
 * @property {string} [startedAt]
 * @property {string} [finishedAt]
 * @property {string} [error]
 * @property {string} [errorCode]
 * @property {string} [errorMessage]
 * @property {number} retryCount
 * @property {number} maxRetries
 * @property {'openai' | 'ollama' | 'rule-based'} provider
 * @property {GenerateMusicRequest} input
 * @property {Object} [inputSummary]
 * @property {number} [inputSummary.duration]
 * @property {string} [inputSummary.period]
 * @property {string} [inputSummary.form]
 * @property {string} [inputSummary.key]
 * @property {number} [inputSummary.tempo]
 * @property {string} [inputSummary.timeSignature]
 * @property {number} [inputSummary.motifTagsCount]
 * @property {number} [inputSummary.instrumentationCount]
 * @property {Object} [inputSummary.humanize]
 * @property {string} [result]
 * @property {string} [resultUrl]
 * @property {string} [midiData]
 * @property {string[]} [warnings]
 * @property {boolean} [fallbackUsed]
 * @property {string} [effectiveProvider]
 * @property {string} [fallbackReason]
 * @property {string} [generationError]
 */

// In-memory job store
const jobs = new Map();

// Job ID counter
let jobIdCounter = 0;

/**
 * Create a new music generation job
 * @param {Object} data
 * @param {'openai' | 'ollama' | 'rule-based'} data.provider
 * @param {GenerateMusicRequest} data.input
 * @param {string} [data.userId]
 * @param {number} [data.maxRetries]
 * @returns {MusicJobData}
 */
export function createMusicJob(data) {
  const jobId = `music_job_${Date.now()}_${jobIdCounter++}`;

  const job = {
    id: jobId,
    status: 'queued',
    createdAt: new Date().toISOString(),
    userId: data.userId ? String(data.userId) : null,
    retryCount: 0,
    maxRetries: data.maxRetries ?? 2,
    provider: data.provider,
    input: data.input,
    inputSummary: {
      duration: typeof data?.input?.duration === 'number' ? data.input.duration : undefined,
      period: typeof data?.input?.period === 'string' ? data.input.period : undefined,
      form: typeof data?.input?.form === 'string' ? data.input.form : undefined,
      key: typeof data?.input?.key === 'string' ? data.input.key : undefined,
      tempo: typeof data?.input?.tempo === 'number' ? data.input.tempo : undefined,
      timeSignature: typeof data?.input?.timeSignature === 'string' ? data.input.timeSignature : undefined,
      motifTagsCount: Array.isArray(data?.input?.motif_tags) ? data.input.motif_tags.length : undefined,
      instrumentationCount: Array.isArray(data?.input?.instrumentation) ? data.input.instrumentation.length : undefined,
      humanize: data?.input?.humanize && typeof data.input.humanize === 'object' ? data.input.humanize : undefined,
    },
  };

  jobs.set(jobId, job);
  console.log(`[MusicJobStore] Created job ${jobId}`);

  return job;
}

/**
 * Get a job by ID
 * @param {string} jobId
 * @returns {MusicJobData | undefined}
 */
export function getMusicJob(jobId) {
  return jobs.get(jobId);
}

/**
 * Update job with partial data
 * @param {string} jobId
 * @param {Partial<MusicJobData>} updates
 * @returns {void}
 */
export function updateMusicJob(jobId, updates) {
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
 * @param {string} jobId
 * @returns {void}
 */
export function incrementMusicJobRetryCount(jobId) {
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
 * @returns {void}
 */
export function cleanupOldMusicJobs() {
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
