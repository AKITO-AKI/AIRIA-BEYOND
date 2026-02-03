import express from 'express';
import { getImageDiagnostics } from '../controllers/diagnostics.js';

const router = express.Router();

router.get('/image', getImageDiagnostics);

export default router;
