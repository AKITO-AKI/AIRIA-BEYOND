import express from 'express';
import { getJobStatus } from '../controllers/job.js';

const router = express.Router();

router.get('/:id', getJobStatus);

export default router;
