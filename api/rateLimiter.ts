/**
 * Rate Limiter - Simple in-memory rate limiting and concurrency guard
 * 
 * Protects against:
 * - Excessive requests per IP/session
 * - Concurrent image generation spam
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface ConcurrencyEntry {
  activeJobs: number;
}

// Per-IP rate limiting (N requests per minute)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per minute

// Concurrency limiting
const MAX_CONCURRENT_JOBS = 3; // Max 3 concurrent jobs per IP

// In-memory stores
const rateLimits = new Map<string, RateLimitEntry>();
const concurrency = new Map<string, ConcurrencyEntry>();

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
 * @param identifier IP address or session ID
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(identifier: string): boolean {
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
 * @param identifier IP address or session ID
 * @returns true if allowed, false if too many concurrent jobs
 */
export function checkConcurrency(identifier: string): boolean {
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
 */
export function releaseJob(identifier: string): void {
  const entry = concurrency.get(identifier);
  if (entry && entry.activeJobs > 0) {
    entry.activeJobs--;
  }
}

/**
 * Get rate limit info for debugging
 */
export function getRateLimitInfo(identifier: string): {
  requestsUsed: number;
  requestsRemaining: number;
  resetAt: number;
} {
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
