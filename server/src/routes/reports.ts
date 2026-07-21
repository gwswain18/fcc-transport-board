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
  getReassignments,
  getCycleTimeAverages,
  getActivityLog,
  getCompletedJobs,
  getShiftLogs,
} from '../controllers/reportController.js';
import rateLimit from 'express-rate-limit';
import { authenticate, requireApproved } from '../middleware/auth.js';
import { canDispatch, canViewReports } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);
router.use(requireApproved);

// Bulk PHI export is expensive and sensitive — cap it well below the global
// limiter so a compromised supervisor token can't repeatedly dump the dataset
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Too many export requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

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
router.get('/reassignments', canViewReports, getReassignments);
router.get('/cycle-time-averages', canViewReports, getCycleTimeAverages);
router.get('/activity-log', canViewReports, getActivityLog);
router.get('/completed-jobs', canViewReports, getCompletedJobs);
router.get('/shift-logs', canViewReports, getShiftLogs);
router.get('/export', exportLimiter, canViewReports, exportData);

export default router;
