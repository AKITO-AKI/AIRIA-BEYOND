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

// Per-IP rate limiting (N requests per minute)
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
export function checkRateLimit(identifier) {
  const now = Date.now();
  const entry = rateLimits.get(identifier);
  
  if (!entry || entry.resetAt < now) {
    // New window
    rateLimits.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
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
export function getRateLimitInfo(identifier) {
  const entry = rateLimits.get(identifier);
  if (!entry) {
    return {
      requestsUsed: 0,
      requestsRemaining: RATE_LIMIT_MAX_REQUESTS,
      resetAt: Date.now() + RATE_LIMIT_WINDOW_MS,
    };
  }
  
  return {
    requestsUsed: entry.count,
    requestsRemaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count),
    resetAt: entry.resetAt,
  };
}
