/**
 * POST /api/admin/jobs
 * 
 * Admin endpoint for job management
 * - GET: List all jobs
 * - DELETE: Clear all jobs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAllJobs, clearAllJobs } from '../jobStore';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method === 'GET') {
      // List all jobs
      const jobs = getAllJobs();
      return res.status(200).json({
        jobs,
        count: jobs.length,
      });
    }
    
    if (req.method === 'DELETE') {
      // Clear all jobs (for testing/development)
      clearAllJobs();
      return res.status(200).json({
        message: 'All jobs cleared',
      });
    }
    
    // Method not allowed
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Admin jobs error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
