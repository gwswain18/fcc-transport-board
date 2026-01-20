import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { canViewReports } from '../middleware/roleAuth.js';
import {
  startShift,
  endShift,
  updateExtension,
  getCurrentShift,
  getShiftHistory,
} from '../controllers/shiftController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Transporter shift operations
router.post('/start', startShift);
router.put('/end', endShift);
router.put('/extension', updateExtension);
router.get('/current', getCurrentShift);

// Shift history (supervisor+)
router.get('/history', canViewReports, getShiftHistory);

export default router;
