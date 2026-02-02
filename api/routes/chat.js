import express from 'express';
import { chatTurn } from '../controllers/chat.js';

const router = express.Router();

router.post('/', chatTurn);

export default router;
