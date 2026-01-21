import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.post('/recover-username', authLimiter, recoverUsername);

// Protected routes
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);
router.post('/heartbeat', authenticate, heartbeat);

export default router;
