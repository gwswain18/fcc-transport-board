import express from 'express';
import { authenticate, requireApproved } from '../middleware/auth.js';
import { canManageUsers, canViewReports } from '../middleware/roleAuth.js';
import {
  getConfigValue,
  setConfigValue,
  getAllConfigValues,
  deleteConfigValue,
  getNotesEnabledValue,
  getConfigAuditHistory,
} from '../controllers/configController.js';

const router = express.Router();

// All routes require authentication and approval
router.use(authenticate);
router.use(requireApproved);

// Alert settings readable by all authenticated users (needed for UI)
router.get('/alert_settings', (req, res) => {
  (req.params as Record<string, string>).key = 'alert_settings';
  getConfigValue(req, res);
});

// Notes-enabled flag readable by all authenticated users (create / delay forms)
router.get('/notes_enabled', getNotesEnabledValue);

// Settings change history (manager only) — registered before /:key
router.get('/audit/history', canManageUsers, getConfigAuditHistory);

// Get config (supervisor+)
router.get('/', canViewReports, getAllConfigValues);
router.get('/:key', canViewReports, getConfigValue);

// Modify config (manager only)
router.put('/:key', canManageUsers, setConfigValue);
router.delete('/:key', canManageUsers, deleteConfigValue);

export default router;
