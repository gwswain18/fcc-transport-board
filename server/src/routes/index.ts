import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import statusRoutes from './status.js';
import requestRoutes from './requests.js';
import reportRoutes from './reports.js';
import shiftRoutes from './shifts.js';
import dispatcherRoutes from './dispatchers.js';
import configRoutes from './config.js';
import offlineRoutes from './offline.js';
import { query } from '../config/database.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/status', statusRoutes);
router.use('/requests', requestRoutes);
router.use('/reports', reportRoutes);
router.use('/shifts', shiftRoutes);
router.use('/dispatchers', dispatcherRoutes);
router.use('/config', configRoutes);
router.use('/offline', offlineRoutes);

// Health check with database connectivity
router.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'disconnected', timestamp: new Date().toISOString() });
  }
});

export default router;
