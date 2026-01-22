/**
 * GET /api/music/[id]
 * 
 * Get music generation job status
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getMusicJob } from '../musicJobStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get job ID from URL
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Get job from store
    const job = getMusicJob(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Return job data
    return res.status(200).json(job);
  } catch (error) {
    console.error('Error getting music job status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
