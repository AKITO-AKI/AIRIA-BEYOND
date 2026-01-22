import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    services: {
      replicate: { 
        available: !!process.env.REPLICATE_API_TOKEN,
        configured: !!process.env.REPLICATE_API_TOKEN
      },
      openai: { 
        available: !!process.env.OPENAI_API_KEY,
        configured: !!process.env.OPENAI_API_KEY
      },
    },
  };
  
  res.status(200).json(health);
}
