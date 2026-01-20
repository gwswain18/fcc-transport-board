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

export default router;
