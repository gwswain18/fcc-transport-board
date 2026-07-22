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
  registerSecretarySession,
  endSecretarySession,
  getActiveSecretaries,
} from '../controllers/authController.js';
import { oauthLogin, getAuthProviders } from '../controllers/oauthController.js';
import { getProfile, updateProfile, linkOAuthAccount } from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { canDispatch } from '../middleware/roleAuth.js';

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
router.post('/oauth', authLimiter, oauthLogin);
// Cheap cached read on every login-page load — must not share the 5/15min limiter
router.get('/providers', getAuthProviders);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.post('/recover-username', authLimiter, recoverUsername);

// Protected routes
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, authLimiter, changePassword);
router.post('/heartbeat', authenticate, heartbeat);
router.post('/secretary-session', authenticate, registerSecretarySession);
router.put('/secretary-session/:userId/end', authenticate, canDispatch, endSecretarySession);
router.get('/active-secretaries', authenticate, getActiveSecretaries);

// Profile routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/link-oauth', authenticate, linkOAuthAccount);

export default router;
