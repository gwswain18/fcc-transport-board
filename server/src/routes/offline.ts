import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  syncOfflineActions,
  getPendingActions,
} from '../controllers/offlineController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Sync offline actions
router.post('/sync', syncOfflineActions);
router.get('/pending', getPendingActions);

export default router;
