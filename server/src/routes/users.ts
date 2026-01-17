import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  updateUser,
  resetPassword,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { canManageUsers } from '../middleware/roleAuth.js';

const router = Router();

router.use(authenticate);
router.use(canManageUsers);

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/reset-password', resetPassword);

export default router;
