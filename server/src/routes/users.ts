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
  getPendingUsers,
  getPendingCount,
  approveUser,
  rejectUser,
} from '../controllers/userController.js';
import { getUserDelays } from '../controllers/delayController.js';
import { requireApproved } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get transporters (dispatcher+)
router.get('/transporters', requireApproved, canDispatch, getTransporters);

// Pending user management (manager only)
router.get('/pending', canManageUsers, getPendingUsers);
router.get('/pending/count', canManageUsers, getPendingCount);
router.put('/:id/approve', canManageUsers, approveUser);
router.put('/:id/reject', canManageUsers, rejectUser);

// User management (manager only)
router.get('/', canManageUsers, getAllUsers);
router.get('/:id', canManageUsers, getUserById);
router.post('/', canManageUsers, createUser);
router.put('/:id', canManageUsers, updateUser);
router.delete('/:id', canManageUsers, deleteUser);
router.put('/:id/reset-password', canManageUsers, resetPassword);
router.get('/:id/delays', canManageUsers, getUserDelays);

export default router;
