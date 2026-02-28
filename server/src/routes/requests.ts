import { Router } from 'express';
import {
  getRequests,
  createRequest,
  updateRequest,
  cancelRequest,
  claimRequest,
  autoAssign,
  assignToPCT,
} from '../controllers/requestController.js';
import { getRequestHistory } from '../controllers/requestHistoryController.js';
import { addDelays, getDelays } from '../controllers/delayController.js';
import { authenticate, requireApproved } from '../middleware/auth.js';
import { canDispatch, canCreateRequest } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);
router.use(requireApproved);

router.get('/', getRequests);
router.post('/', canCreateRequest, createRequest);
router.put('/:id', updateRequest);
router.put('/:id/cancel', canDispatch, cancelRequest);
router.put('/:id/claim', claimRequest);
router.post('/:id/auto-assign', canDispatch, autoAssign);
router.put('/:id/assign-pct', canDispatch, assignToPCT);
router.get('/:id/history', getRequestHistory);
router.post('/:id/delays', addDelays);
router.get('/:id/delays', getDelays);

export default router;
