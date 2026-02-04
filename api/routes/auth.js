import express from 'express';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  publicUserHandler,
  registerHandler,
  updateProfileHandler,
} from '../controllers/auth.js';

const router = express.Router();

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.get('/me', meHandler);
router.post('/logout', logoutHandler);
router.patch('/me', updateProfileHandler);
router.get('/users/:id', publicUserHandler);

export default router;
