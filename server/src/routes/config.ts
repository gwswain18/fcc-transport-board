import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { canManageUsers, canViewReports } from '../middleware/roleAuth.js';
import {
  getConfigValue,
  setConfigValue,
  getAllConfigValues,
  deleteConfigValue,
} from '../controllers/configController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get config (supervisor+)
router.get('/', canViewReports, getAllConfigValues);
router.get('/:key', canViewReports, getConfigValue);

// Modify config (manager only)
router.put('/:key', canManageUsers, setConfigValue);
router.delete('/:key', canManageUsers, deleteConfigValue);

export default router;
