import express from 'express';
import { analyzeSession } from '../controllers/analyze.js';
import { getAnalysisJob } from '../analysisJobStore.js';

const router = express.Router();

router.post('/', analyzeSession);

router.get('/:id', (req, res) => {
  try {
    const job = getAnalysisJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Analysis job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
