import { Router } from 'express';
import {
  getSummary,
  getByTransporter,
  getJobsByHour,
  getJobsByFloor,
  getJobsByDay,
  exportData,
  getStaffingByFloor,
  getFloorAnalysis,
  getTimeMetrics,
  getDelayReport,
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
router.get('/by-day', getJobsByDay);
router.get('/staffing-by-floor', getStaffingByFloor);
router.get('/floor-analysis', getFloorAnalysis);
router.get('/time-metrics', getTimeMetrics);
router.get('/delays', getDelayReport);
router.get('/export', exportData);

export default router;
