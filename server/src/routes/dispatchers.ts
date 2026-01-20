import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { canDispatch } from '../middleware/roleAuth.js';
import {
  getActiveDispatchers,
  setPrimaryDispatcher,
  registerAsDispatcher,
  takeBreak,
  returnFromBreak,
  endDispatcherSession,
  getAvailableDispatchers,
} from '../controllers/dispatcherController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get active dispatchers (all authenticated users can view)
router.get('/active', getActiveDispatchers);
router.get('/available', canDispatch, getAvailableDispatchers);

// Dispatcher management (dispatcher+ role)
router.post('/set-primary', canDispatch, setPrimaryDispatcher);
router.post('/register', canDispatch, registerAsDispatcher);
router.post('/take-break', canDispatch, takeBreak);
router.post('/return', canDispatch, returnFromBreak);
router.post('/end-session', canDispatch, endDispatcherSession);

export default router;
