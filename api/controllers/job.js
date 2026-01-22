/**
 * GET /api/job/:id
 * 
 * Get the status of a job by ID
 */

import { getJob } from '../jobStore.js';

/**
 * Get job status handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getJobStatus(req, res) {
  // Only accept GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract job ID from params (Express style) or query (fallback)
    const id = req.params.id || req.query.id;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    // Get job from store
    const job = getJob(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Return job data
    return res.status(200).json(job);
  } catch (error) {
    console.error('Job status error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
