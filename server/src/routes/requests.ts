import { Router } from 'express';
import {
  getRequests,
  createRequest,
  updateRequest,
  cancelRequest,
  claimRequest,
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

export default router;
