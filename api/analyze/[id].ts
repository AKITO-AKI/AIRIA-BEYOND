/**
 * GET /api/analyze/[id]
 * 
 * Get status of an analysis job
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAnalysisJob } from '../analysisJobStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid job ID' });
  }

  const job = getAnalysisJob(id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.status(200).json(job);
}
