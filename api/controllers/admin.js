/**
 * Admin endpoints
 * - GET /api/admin/usage - Get usage statistics
 * - GET /api/admin/jobs - List all jobs
 * - DELETE /api/admin/jobs - Clear all jobs
 */

import { getAllJobs, clearAllJobs } from '../jobStore.js';

/**
 * Get usage statistics handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getUsage(req, res) {
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

/**
 * Get all jobs or clear all jobs handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getJobs(req, res) {
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
