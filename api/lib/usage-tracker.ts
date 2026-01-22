// Usage tracking for API cost monitoring
interface UsageEvent {
  provider: string;
  cost: number;
  timestamp: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export function trackUsage(
  provider: string, 
  cost: number, 
  operation?: string,
  metadata?: Record<string, any>
) {
  const event: UsageEvent = {
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
