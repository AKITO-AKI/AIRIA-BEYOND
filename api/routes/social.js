import express from 'express';
import {
	commentPostHandler,
	createPostHandler,
	deletePostHandler,
	followToggleHandler,
	getMyPosts,
	getPosts,
	likePostHandler,
	updatePostHandler,
} from '../controllers/social.js';
import { attachAuthUser, requireAuth } from '../lib/auth.js';

const router = express.Router();

router.get('/posts', attachAuthUser, getPosts);
router.get('/me/posts', requireAuth, getMyPosts);
router.post('/posts', requireAuth, createPostHandler);
router.patch('/posts/:id', requireAuth, updatePostHandler);
router.delete('/posts/:id', requireAuth, deletePostHandler);
router.post('/posts/:id/like', requireAuth, likePostHandler);
router.post('/posts/:id/comments', requireAuth, commentPostHandler);
router.post('/users/:id/follow', requireAuth, followToggleHandler);

export default router;
