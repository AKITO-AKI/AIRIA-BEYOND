import express from 'express';
import { commentPostHandler, createPostHandler, followToggleHandler, getPosts, likePostHandler } from '../controllers/social.js';
import { attachAuthUser, requireAuth } from '../lib/auth.js';

const router = express.Router();

router.get('/posts', attachAuthUser, getPosts);
router.post('/posts', requireAuth, createPostHandler);
router.post('/posts/:id/like', requireAuth, likePostHandler);
router.post('/posts/:id/comments', requireAuth, commentPostHandler);
router.post('/users/:id/follow', requireAuth, followToggleHandler);

export default router;
