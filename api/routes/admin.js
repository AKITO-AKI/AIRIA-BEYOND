import express from 'express';
import { getUsage, getJobs } from '../controllers/admin.js';

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: Invalid admin token' });
  }
  
  next();
};

router.get('/usage', authMiddleware, getUsage);

router.get('/jobs', authMiddleware, getJobs);

router.delete('/jobs', authMiddleware, getJobs);

export default router;
