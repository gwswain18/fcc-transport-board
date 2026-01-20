import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';
import { getHeartbeatTimeoutMs, getBreakAlertMinutes, getAlertSettings } from './configService.js';
import { logStatusChange } from './auditService.js';

const CHECK_INTERVAL_MS = 30000; // 30 seconds

let intervalId: NodeJS.Timeout | null = null;

export const startHeartbeatService = () => {
  console.log('Starting heartbeat service...');

  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(async () => {
    try {
      await checkHeartbeats();
      await checkBreakDurations();
    } catch (error) {
      console.error('Heartbeat service error:', error);
    }
  }, CHECK_INTERVAL_MS);
};

export const stopHeartbeatService = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

export const recordHeartbeat = async (
  userId: number,
  socketId?: string
): Promise<void> => {
  await query(
    `INSERT INTO user_heartbeats (user_id, last_heartbeat, socket_id)
     VALUES ($1, CURRENT_TIMESTAMP, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       last_heartbeat = CURRENT_TIMESTAMP,
       socket_id = COALESCE($2, user_heartbeats.socket_id)`,
    [userId, socketId || null]
  );
};

export const removeHeartbeat = async (userId: number): Promise<void> => {
  await query('DELETE FROM user_heartbeats WHERE user_id = $1', [userId]);
};

export const getLastHeartbeat = async (
  userId: number
): Promise<{ last_heartbeat: string; socket_id?: string } | null> => {
  const result = await query(
    'SELECT last_heartbeat, socket_id FROM user_heartbeats WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
};

const checkHeartbeats = async () => {
  const io = getIO();
  if (!io) return;

  const timeoutMs = await getHeartbeatTimeoutMs();
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();

  // Find users with stale heartbeats who are not already offline
  const result = await query(
    `SELECT uh.user_id, uh.last_heartbeat, ts.status
     FROM user_heartbeats uh
     JOIN transporter_status ts ON uh.user_id = ts.user_id
     JOIN users u ON uh.user_id = u.id
     WHERE uh.last_heartbeat < $1
     AND ts.status NOT IN ('offline')
     AND u.role = 'transporter'`,
    [cutoffTime]
  );

  for (const row of result.rows) {
    const oldStatus = row.status;

    // Mark user as offline
    await query(
      `UPDATE transporter_status SET status = 'offline', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [row.user_id]
    );

    // Log the status change
    await logStatusChange(
      row.user_id,
      'transporter_status',
      row.user_id,
      oldStatus,
      'offline',
      'heartbeat_timeout'
    );

    // Get user details for notification
    const userResult = await query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [row.user_id]
    );
    const user = userResult.rows[0];

    // Emit offline event if alerts are enabled
    const alertSettings = await getAlertSettings();
    if (alertSettings.master_enabled && alertSettings.alerts.offline_alert) {
      io.emit('transporter_offline', {
        user_id: row.user_id,
        last_heartbeat: row.last_heartbeat,
        first_name: user?.first_name,
        last_name: user?.last_name,
      });
    }

    // Also emit status change
    const statusResult = await query(
      `SELECT ts.*, u.first_name, u.last_name, u.email, u.role
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       WHERE ts.user_id = $1`,
      [row.user_id]
    );
    if (statusResult.rows[0]) {
      io.emit('transporter_status_changed', statusResult.rows[0]);
    }

    console.log(`User ${row.user_id} marked offline due to heartbeat timeout`);
  }
};

const checkBreakDurations = async () => {
  const io = getIO();
  if (!io) return;

  // Check alert settings first
  const alertSettings = await getAlertSettings();
  if (!alertSettings.master_enabled || !alertSettings.alerts.break_alert) {
    return;
  }

  const breakAlertMinutes = await getBreakAlertMinutes();
  const cutoffTime = new Date(
    Date.now() - breakAlertMinutes * 60 * 1000
  ).toISOString();

  // Find users on break for too long
  const result = await query(
    `SELECT ts.user_id, ts.on_break_since, u.first_name, u.last_name
     FROM transporter_status ts
     JOIN users u ON ts.user_id = u.id
     WHERE ts.status = 'on_break'
     AND ts.on_break_since IS NOT NULL
     AND ts.on_break_since < $1`,
    [cutoffTime]
  );

  for (const row of result.rows) {
    const breakStart = new Date(row.on_break_since);
    const minutesOnBreak = Math.floor((Date.now() - breakStart.getTime()) / 60000);

    io.emit('break_alert', {
      user_id: row.user_id,
      minutes_on_break: minutesOnBreak,
      first_name: row.first_name,
      last_name: row.last_name,
    });

    console.log(
      `Break alert: User ${row.user_id} (${row.first_name} ${row.last_name}) on break for ${minutesOnBreak} minutes`
    );
  }
};

export const isUserOnline = async (userId: number): Promise<boolean> => {
  const timeoutMs = await getHeartbeatTimeoutMs();
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();

  const result = await query(
    'SELECT 1 FROM user_heartbeats WHERE user_id = $1 AND last_heartbeat >= $2',
    [userId, cutoffTime]
  );

  return result.rows.length > 0;
};

export const getOnlineUsers = async (): Promise<number[]> => {
  const timeoutMs = await getHeartbeatTimeoutMs();
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();

  const result = await query(
    'SELECT user_id FROM user_heartbeats WHERE last_heartbeat >= $1',
    [cutoffTime]
  );

  return result.rows.map((row) => row.user_id);
};
