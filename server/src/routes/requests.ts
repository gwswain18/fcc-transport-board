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
import { authenticate } from '../middleware/auth.js';
import { canDispatch } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);

router.get('/', getRequests);
router.post('/', canDispatch, createRequest);
router.put('/:id', updateRequest);
router.put('/:id/cancel', canDispatch, cancelRequest);
router.put('/:id/claim', claimRequest);
router.post('/:id/auto-assign', canDispatch, autoAssign);
router.put('/:id/assign-pct', canDispatch, assignToPCT);
router.get('/:id/history', getRequestHistory);
router.post('/:id/delays', canDispatch, addDelays);
router.get('/:id/delays', getDelays);

export default router;
