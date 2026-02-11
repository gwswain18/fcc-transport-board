import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { canManageUsers, canDispatch } from '../middleware/roleAuth.js';
import {
  getAllUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
  getTransporters,
  getUserById,
} from '../controllers/userController.js';
import { getUserDelays } from '../controllers/delayController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get transporters (dispatcher+)
router.get('/transporters', canDispatch, getTransporters);

// User management (manager only)
router.get('/', canManageUsers, getAllUsers);
router.get('/:id', canManageUsers, getUserById);
router.post('/', canManageUsers, createUser);
router.put('/:id', canManageUsers, updateUser);
router.delete('/:id', canManageUsers, deleteUser);
router.put('/:id/reset-password', canManageUsers, resetPassword);
router.get('/:id/delays', canManageUsers, getUserDelays);

export default router;
