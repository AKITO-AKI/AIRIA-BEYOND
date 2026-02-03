import express from 'express';
import { nameAlbumTitle } from '../controllers/album.js';

const router = express.Router();

router.post('/name', nameAlbumTitle);

export default router;
