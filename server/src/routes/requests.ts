import { Router } from 'express';
import {
  getRequests,
  createRequest,
  updateRequest,
  cancelRequest,
  claimRequest,
  autoAssign,
  assignToPCT,
  setAnalyticsExclusion,
} from '../controllers/requestController.js';
import { getRequestHistory } from '../controllers/requestHistoryController.js';
import { addDelays, getDelays } from '../controllers/delayController.js';
import { authenticate, requireApproved } from '../middleware/auth.js';
import { canDispatch, canCreateRequest, canManageUsers } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);
router.use(requireApproved);

router.get('/', getRequests);
router.post('/', canCreateRequest, createRequest);
router.put('/:id', updateRequest);
router.put('/:id/cancel', canDispatch, cancelRequest);
router.put('/:id/claim', claimRequest);
// canCreateRequest (secretary+): secretaries may auto-assign, matching the
// auto_assign flag already available to them at creation; transporters may not
router.post('/:id/auto-assign', canCreateRequest, autoAssign);
router.put('/:id/assign-pct', canDispatch, assignToPCT);
// Manager toggle: exclude/re-include a job in analytics (audit-logged)
router.put('/:id/analytics-exclusion', canManageUsers, setAnalyticsExclusion);
router.get('/:id/history', getRequestHistory);
router.post('/:id/delays', addDelays);
router.get('/:id/delays', getDelays);

export default router;
