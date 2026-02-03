import express from 'express';
import { commentPostHandler, createPostHandler, getPosts, likePostHandler } from '../controllers/social.js';

const router = express.Router();

router.get('/posts', getPosts);
router.post('/posts', createPostHandler);
router.post('/posts/:id/like', likePostHandler);
router.post('/posts/:id/comments', commentPostHandler);

export default router;
