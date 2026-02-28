import express from 'express';
import { authenticate, requireApproved } from '../middleware/auth.js';
import {
  syncOfflineActions,
  getPendingActions,
} from '../controllers/offlineController.js';

const router = express.Router();

// All routes require authentication and approval
router.use(authenticate);
router.use(requireApproved);

// Sync offline actions
router.post('/sync', syncOfflineActions);
router.get('/pending', getPendingActions);

export default router;
