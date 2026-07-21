import { query } from '../config/database.js';

// Persistent server-to-user notifications (migration 045). Rows stay pending
// until the user acknowledges them, so a transporter who was offline when a
// job was reassigned away from them still sees the notice on next connect.

export interface UserNotification {
  id: number;
  user_id: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
}

export const createNotification = async (
  userId: number,
  type: string,
  payload: Record<string, unknown>
): Promise<UserNotification> => {
  const result = await query(
    `INSERT INTO user_notifications (user_id, type, payload)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, type, JSON.stringify(payload)]
  );
  return result.rows[0];
};

export const getPendingNotifications = async (userId: number): Promise<UserNotification[]> => {
  const result = await query(
    `SELECT * FROM user_notifications
     WHERE user_id = $1 AND acknowledged_at IS NULL
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows;
};

export const markDelivered = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return;
  await query(
    `UPDATE user_notifications SET delivered_at = CURRENT_TIMESTAMP
     WHERE id = ANY($1) AND delivered_at IS NULL`,
    [ids]
  );
};

// Ownership enforced in the WHERE clause; returns false if not found / not
// owned / already acknowledged
export const acknowledgeNotification = async (id: number, userId: number): Promise<boolean> => {
  const result = await query(
    `UPDATE user_notifications SET acknowledged_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND acknowledged_at IS NULL`,
    [id, userId]
  );
  return (result.rowCount ?? 0) > 0;
};

// Users who already missed this request — excluded from re-selection so a
// reassigned job never bounces back to someone who ignored it
export const getMissedUserIdsForRequest = async (requestId: number): Promise<number[]> => {
  const result = await query(
    `SELECT DISTINCT user_id FROM user_notifications
     WHERE type = 'missed_job' AND (payload->>'request_id')::int = $1`,
    [requestId]
  );
  return result.rows.map((row: { user_id: number }) => row.user_id);
};
