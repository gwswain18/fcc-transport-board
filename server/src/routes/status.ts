import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { canViewReports } from '../middleware/roleAuth.js';
import {
  getAllStatuses,
  updateOwnStatus,
  overrideStatus,
  handleHeartbeat,
} from '../controllers/statusController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all transporter statuses
router.get('/', getAllStatuses);

// Update own status
router.put('/', updateOwnStatus);

// Heartbeat
router.post('/heartbeat', handleHeartbeat);

// Override transporter status (supervisor+ only)
router.put('/:userId/override', canViewReports, overrideStatus);

export default router;
