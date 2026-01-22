import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authorization
  const authToken = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.ADMIN_TOKEN}`;
  
  if (!process.env.ADMIN_TOKEN || authToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Return usage statistics
  // In production, this would query actual usage data from logs or database
  const usageReport = {
    period: 'last_24h',
    totalRequests: 0,
    services: {
      replicate: {
        requests: 0,
        estimatedCost: 0,
        available: !!process.env.REPLICATE_API_TOKEN
      },
      openai: {
        requests: 0,
        estimatedCost: 0,
        available: !!process.env.OPENAI_API_KEY
      }
    },
    timestamp: new Date().toISOString()
  };
  
  return res.status(200).json(usageReport);
}
