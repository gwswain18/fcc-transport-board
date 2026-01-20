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

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
