/**
 * @typedef {Object} UsageEvent
 * @property {string} provider
 * @property {number} cost
 * @property {string} timestamp
 * @property {string} [operation]
 * @property {Record<string, any>} [metadata]
 */

/**
 * Usage tracking for API cost monitoring
 * @param {string} provider
 * @param {number} cost
 * @param {string} [operation]
 * @param {Record<string, any>} [metadata]
 * @returns {UsageEvent}
 */
export function trackUsage(
  provider, 
  cost, 
  operation,
  metadata
) {
  const event = {
    provider,
    cost,
    timestamp: new Date().toISOString(),
    operation,
    metadata
  };
  
  console.log('[API Usage]', JSON.stringify(event));
  
  // In production, this could be extended to:
  // - Send to analytics service
  // - Store in database
  // - Aggregate for billing
  
  return event;
}
