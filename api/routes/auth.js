import express from 'express';
import {
  authConfigHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  oauthAppleHandler,
  oauthGoogleHandler,
  publicUserHandler,
  registerHandler,
  updateProfileHandler,
} from '../controllers/auth.js';

const router = express.Router();

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/oauth/google', oauthGoogleHandler);
router.post('/oauth/apple', oauthAppleHandler);
router.get('/config', authConfigHandler);
router.get('/me', meHandler);
router.post('/logout', logoutHandler);
router.patch('/me', updateProfileHandler);
router.get('/users/:id', publicUserHandler);

export default router;
