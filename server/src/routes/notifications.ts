import { Router } from 'express';
import { Response } from 'express';
import { authenticate, requireApproved } from '../middleware/auth.js';
import {
  getPendingNotifications,
  acknowledgeNotification,
} from '../services/notificationService.js';
import { AuthenticatedRequest } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

router.use(authenticate);
router.use(requireApproved);

// Own pending (unacknowledged) notifications
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await getPendingNotifications(req.user!.id);
    res.json({ notifications });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Acknowledge one of your own notifications
router.put('/:id/ack', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const acknowledged = await acknowledgeNotification(id, req.user!.id);
    if (!acknowledged) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification acknowledged' });
  } catch (error) {
    logger.error('Acknowledge notification error:', error);
    res.status(500).json({ error: 'Failed to acknowledge notification' });
  }
});

export default router;
