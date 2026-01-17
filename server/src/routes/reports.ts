import { Router } from 'express';
import {
  getSummary,
  getByTransporter,
  getJobsByHour,
  getJobsByFloor,
  exportData,
} from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { canViewReports } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);
router.use(canViewReports);

router.get('/summary', getSummary);
router.get('/by-transporter', getByTransporter);
router.get('/by-hour', getJobsByHour);
router.get('/by-floor', getJobsByFloor);
router.get('/export', exportData);

export default router;
