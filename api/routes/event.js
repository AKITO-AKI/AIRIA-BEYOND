import express from 'express';
import { refineGenerationEvent } from '../controllers/event.js';

const router = express.Router();

router.post('/refine', refineGenerationEvent);

export default router;
