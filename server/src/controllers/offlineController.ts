import { Request, Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import logger from '../utils/logger.js';

interface OfflineAction {
  action_type: string;
  payload: Record<string, unknown>;
  created_offline_at: string;
}

interface OfflineSyncRequest {
  actions: OfflineAction[];
}

interface OfflineSyncResponse {
  processed: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

// Process offline action queue
export const syncOfflineActions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { actions } = req.body as OfflineSyncRequest;

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'No actions to process' });
    }

    const response: OfflineSyncResponse = {
      processed: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      try {
        // Store the action in the queue
        await query(
          `INSERT INTO offline_action_queue (user_id, action_type, payload, created_offline_at, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [userId, action.action_type, JSON.stringify(action.payload), action.created_offline_at]
        );

        // Process the action based on type
        await processOfflineAction(userId, action.action_type, action.payload);

        // Mark as processed
        await query(
          `UPDATE offline_action_queue
           SET status = 'processed', processed_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND action_type = $2 AND created_offline_at = $3`,
          [userId, action.action_type, action.created_offline_at]
        );

        response.processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Mark as failed
        await query(
          `UPDATE offline_action_queue
           SET status = 'failed'
           WHERE user_id = $1 AND action_type = $2 AND created_offline_at = $3`,
          [userId, action.action_type, action.created_offline_at]
        );

        response.failed++;
        response.errors.push({ index: i, error: errorMessage });
      }
    }

    res.json(response);
  } catch (error) {
    logger.error('Sync offline actions error:', error);
    res.status(500).json({ error: 'Failed to sync offline actions' });
  }
};

// Process individual offline action
const processOfflineAction = async (
  userId: number,
  actionType: string,
  payload: Record<string, unknown>
): Promise<void> => {
  switch (actionType) {
    case 'status_update':
      await processStatusUpdate(userId, payload);
      break;

    case 'request_accept':
      await processRequestAccept(userId, payload);
      break;

    case 'request_status_change':
      await processRequestStatusChange(userId, payload);
      break;

    case 'heartbeat':
      // Just record it was received, heartbeat will be updated normally
      break;

    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
};

const processStatusUpdate = async (
  userId: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const { status, explanation } = payload;

  await query(
    `UPDATE transporter_status
     SET status = $1, status_explanation = $2, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $3`,
    [status, explanation || null, userId]
  );
};

const processRequestAccept = async (
  userId: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const { request_id } = payload;

  // Verify request is assigned to this user
  const result = await query(
    'SELECT status FROM transport_requests WHERE id = $1 AND assigned_to = $2',
    [request_id, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Request not found or not assigned to you');
  }

  if (result.rows[0].status !== 'assigned') {
    throw new Error('Request is not in assigned status');
  }

  await query(
    `UPDATE transport_requests
     SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [request_id]
  );

  await query(
    `UPDATE transporter_status SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [userId]
  );
};

const processRequestStatusChange = async (
  userId: number,
  payload: Record<string, unknown>
): Promise<void> => {
  const { request_id, new_status } = payload;

  // Validate status before interpolating into SQL
  const validStatuses = ['accepted', 'en_route', 'with_patient', 'complete', 'cancelled'];
  if (!validStatuses.includes(new_status as string)) {
    throw new Error(`Invalid status: ${new_status}`);
  }

  // Map status to timestamp field
  const timestampField = getTimestampField(new_status as string);

  // Update request
  await query(
    `UPDATE transport_requests
     SET status = $1, ${timestampField} = CURRENT_TIMESTAMP
     WHERE id = $2 AND assigned_to = $3`,
    [new_status, request_id, userId]
  );

  // Update transporter status if not completing
  if (new_status !== 'complete') {
    await query(
      `UPDATE transporter_status SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [new_status, userId]
    );
  } else {
    await query(
      `UPDATE transporter_status SET status = 'available', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );
  }
};

const getTimestampField = (status: string): string => {
  switch (status) {
    case 'accepted':
      return 'accepted_at';
    case 'en_route':
      return 'en_route_at';
    case 'with_patient':
      return 'with_patient_at';
    case 'complete':
      return 'completed_at';
    case 'cancelled':
      return 'cancelled_at';
    default:
      return 'updated_at';
  }
};

// Get pending offline actions for a user
export const getPendingActions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT * FROM offline_action_queue
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY created_offline_at ASC`,
      [userId]
    );

    res.json({ actions: result.rows });
  } catch (error) {
    logger.error('Get pending actions error:', error);
    res.status(500).json({ error: 'Failed to get pending actions' });
  }
};
