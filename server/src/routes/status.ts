import { Router } from 'express';
import { getAllStatuses, updateOwnStatus } from '../controllers/statusController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getAllStatuses);
router.put('/', updateOwnStatus);

export default router;
