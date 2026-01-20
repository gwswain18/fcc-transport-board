import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { canManageUsers, canDispatch } from '../middleware/roleAuth.js';
import {
  getAllUsers,
  createUser,
  updateUser,
  resetPassword,
  getTransporters,
  getUserById,
} from '../controllers/userController.js';

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
router.put('/:id/reset-password', canManageUsers, resetPassword);

export default router;
