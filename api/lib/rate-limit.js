/**
 * Rate Limiter - Simple in-memory rate limiting and concurrency guard
 * 
 * Protects against:
 * - Excessive requests per IP/session
 * - Concurrent image generation spam
 */

/**
 * @typedef {Object} RateLimitEntry
 * @property {number} count
 * @property {number} resetAt
 */

/**
 * @typedef {Object} ConcurrencyEntry
 * @property {number} activeJobs
 */

// Per-key rate limiting (N requests per minute)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per minute

// Concurrency limiting
const MAX_CONCURRENT_JOBS = 3; // Max 3 concurrent jobs per IP

// In-memory stores
/** @type {Map<string, RateLimitEntry>} */
const rateLimits = new Map();
/** @type {Map<string, ConcurrencyEntry>} */
const concurrency = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (entry.resetAt < now) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if request is rate limited
 * @param {string} identifier - IP address or session ID
 * @returns {boolean} true if allowed, false if rate limited
 */
export function checkRateLimit(identifier, opts = undefined) {
  const now = Date.now();
  const windowMs = Number(opts?.windowMs ?? RATE_LIMIT_WINDOW_MS) || RATE_LIMIT_WINDOW_MS;
  const maxRequests = Number(opts?.maxRequests ?? RATE_LIMIT_MAX_REQUESTS) || RATE_LIMIT_MAX_REQUESTS;

  const key = `${String(identifier || '')}|${windowMs}|${maxRequests}`;
  const entry = rateLimits.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimits.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Check if request exceeds concurrency limit
 * @param {string} identifier - IP address or session ID
 * @returns {boolean} true if allowed, false if too many concurrent jobs
 */
export function checkConcurrency(identifier) {
  const entry = concurrency.get(identifier);
  
  if (!entry) {
    concurrency.set(identifier, { activeJobs: 1 });
    return true;
  }
  
  if (entry.activeJobs >= MAX_CONCURRENT_JOBS) {
    return false;
  }
  
  entry.activeJobs++;
  return true;
}

/**
 * Decrement active job count when a job completes
 * @param {string} identifier - IP address or session ID
 */
export function releaseJob(identifier) {
  const entry = concurrency.get(identifier);
  if (entry && entry.activeJobs > 0) {
    entry.activeJobs--;
  }
}

/**
 * Get rate limit info for debugging
 * @param {string} identifier - IP address or session ID
 * @returns {{requestsUsed: number, requestsRemaining: number, resetAt: number}}
 */
export function getRateLimitInfo(identifier, opts = undefined) {
  const windowMs = Number(opts?.windowMs ?? RATE_LIMIT_WINDOW_MS) || RATE_LIMIT_WINDOW_MS;
  const maxRequests = Number(opts?.maxRequests ?? RATE_LIMIT_MAX_REQUESTS) || RATE_LIMIT_MAX_REQUESTS;
  const key = `${String(identifier || '')}|${windowMs}|${maxRequests}`;
  const entry = rateLimits.get(key);
  if (!entry) {
    return {
      requestsUsed: 0,
      requestsRemaining: maxRequests,
      resetAt: Date.now() + windowMs,
    };
  }
  
  return {
    requestsUsed: entry.count,
    requestsRemaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}
