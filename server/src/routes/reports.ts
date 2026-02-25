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
  getCycleTimeAverages,
  getActivityLog,
  getCompletedJobs,
  getShiftLogs,
} from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { canDispatch, canViewReports } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);

// Dispatcher-accessible (summary page)
router.get('/summary', canDispatch, getSummary);
router.get('/by-transporter', canDispatch, getByTransporter);

// Supervisor+ only (analytics)
router.get('/by-hour', canViewReports, getJobsByHour);
router.get('/by-floor', canViewReports, getJobsByFloor);
router.get('/by-day', canViewReports, getJobsByDay);
router.get('/staffing-by-floor', canViewReports, getStaffingByFloor);
router.get('/floor-analysis', canViewReports, getFloorAnalysis);
router.get('/time-metrics', canViewReports, getTimeMetrics);
router.get('/delays', canViewReports, getDelayReport);
router.get('/cycle-time-averages', canViewReports, getCycleTimeAverages);
router.get('/activity-log', canViewReports, getActivityLog);
router.get('/completed-jobs', canViewReports, getCompletedJobs);
router.get('/shift-logs', canViewReports, getShiftLogs);
router.get('/export', canViewReports, exportData);

export default router;
