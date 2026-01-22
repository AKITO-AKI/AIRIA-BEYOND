import express from 'express';
import { generateMusic } from '../controllers/music.js';
import { getMusicJob } from '../musicJobStore.js';

const router = express.Router();

router.post('/generate', generateMusic);

router.get('/:id', (req, res) => {
  try {
    const job = getMusicJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Music job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
