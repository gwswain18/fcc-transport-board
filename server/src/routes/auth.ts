import { Router } from 'express';
import {
  login,
  logout,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  recoverUsername,
  heartbeat,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/recover-username', recoverUsername);

// Protected routes
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);
router.post('/heartbeat', authenticate, heartbeat);

export default router;
