import { query } from '../config/database.js';
import { getIO, broadcastDispatcherChanged, broadcastSecretaryChanged } from '../socket/index.js';
import { getAlertSettings, getAlertTiming } from './configService.js';
import { logStatusChange } from './auditService.js';
import logger from '../utils/logger.js';

const CHECK_INTERVAL_MS = 30000; // 30 seconds

// auto_logout_time is interpreted in this timezone, not the server's local
// clock (Render runs in UTC)
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/New_York';

const getLocalNow = (): { dateStr: string; seconds: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    seconds:
      parseInt(get('hour'), 10) * 3600 +
      parseInt(get('minute'), 10) * 60 +
      parseInt(get('second'), 10),
  };
};

let intervalId: NodeJS.Timeout | null = null;
let heartbeatCheckCount = 0;
let lastAutoLogoutDate: string | null = null;
let lastRetentionCleanupDate: string | null = null;

export const startHeartbeatService = async () => {
  logger.info('Starting heartbeat service...');

  // Log alert settings and timing on startup
  try {
    const alertSettings = await getAlertSettings();
    const timing = await getAlertTiming();
    logger.info(`[Heartbeat] Alert settings: master_enabled=${alertSettings.master_enabled}, offline_alert=${alertSettings.alerts.offline_alert}, break_alert=${alertSettings.alerts.break_alert}`);
    logger.info(`[Heartbeat] Timing: offline_alert_minutes=${timing.offline_alert_minutes}, break_alert_minutes=${timing.break_alert_minutes}`);
  } catch (error) {
    logger.error('[Heartbeat] Failed to load initial settings:', error);
  }

  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(async () => {
    try {
      await checkHeartbeats();
      await checkBreakDurations();
      await checkAutoLogout();
      await cleanupOldAuditLogs();
    } catch (error) {
      logger.error('Heartbeat service error:', error);
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
    `INSERT INTO user_heartbeats (user_id, last_heartbeat, socket_id, created_at)
     VALUES ($1, CURRENT_TIMESTAMP, $2, CURRENT_TIMESTAMP)
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

  heartbeatCheckCount++;

  const timing = await getAlertTiming();
  const timeoutMs = timing.offline_alert_minutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();

  // Periodic diagnostic (every 10th check = ~5 minutes)
  if (heartbeatCheckCount % 10 === 0) {
    const totalHeartbeats = await query('SELECT COUNT(*) as count FROM user_heartbeats');
    const onlineCount = await query(
      'SELECT COUNT(*) as count FROM user_heartbeats WHERE last_heartbeat >= $1',
      [cutoffTime]
    );
    logger.info(`[Heartbeat] Diagnostic (check #${heartbeatCheckCount}): total_heartbeat_records=${totalHeartbeats.rows[0].count}, online=${onlineCount.rows[0].count}, offline_threshold=${timing.offline_alert_minutes}min`);
  }

  // Find users with stale heartbeats who are not already offline (JOIN user data to avoid N+1)
  const result = await query(
    `SELECT uh.user_id, uh.last_heartbeat, ts.status,
            u.first_name, u.last_name
     FROM user_heartbeats uh
     JOIN transporter_status ts ON uh.user_id = ts.user_id
     JOIN users u ON uh.user_id = u.id
     WHERE uh.last_heartbeat < $1
     AND ts.status NOT IN ('offline')
     AND u.role = 'transporter'`,
    [cutoffTime]
  );

  if (result.rows.length > 0) {
    logger.info(`[Heartbeat] Found ${result.rows.length} stale heartbeat(s) (cutoff: ${cutoffTime})`);
  }

  for (const row of result.rows) {
    const oldStatus = row.status;

    // Mark user as offline and record went_offline_at
    await query(
      `UPDATE transporter_status SET status = 'offline', went_offline_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [row.user_id]
    );

    // Create offline_periods record if user has active shift
    const shiftResult = await query(
      `SELECT id FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL ORDER BY shift_start DESC LIMIT 1`,
      [row.user_id]
    );
    const shiftId = shiftResult.rows[0]?.id || null;
    await query(
      `INSERT INTO offline_periods (user_id, shift_id, offline_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) WHERE online_at IS NULL DO NOTHING`,
      [row.user_id, shiftId]
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

    // Emit offline event if alerts are enabled
    const alertSettings = await getAlertSettings();
    if (alertSettings.master_enabled && alertSettings.alerts.offline_alert) {
      io.emit('transporter_offline', {
        user_id: row.user_id,
        last_heartbeat: row.last_heartbeat,
        first_name: row.first_name,
        last_name: row.last_name,
      });
      logger.info(`[Heartbeat] Emitted transporter_offline for user ${row.user_id}`);
    } else {
      logger.info(`[Heartbeat] Offline alert skipped for user ${row.user_id} (master_enabled=${alertSettings.master_enabled}, offline_alert=${alertSettings.alerts.offline_alert})`);
    }

    // Re-fetch status after UPDATE for the emit (need the updated record)
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

    logger.info(`User ${row.user_id} marked offline due to heartbeat timeout`);
  }
};

const checkBreakDurations = async () => {
  const io = getIO();
  if (!io) return;

  // Check alert settings first
  const alertSettings = await getAlertSettings();
  if (!alertSettings.master_enabled || !alertSettings.alerts.break_alert) {
    logger.info(`[BreakCheck] Skipped (master_enabled=${alertSettings.master_enabled}, break_alert=${alertSettings.alerts.break_alert})`);
    return;
  }

  const timing = await getAlertTiming();
  const cutoffTime = new Date(
    Date.now() - timing.break_alert_minutes * 60 * 1000
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

  // Periodic diagnostic for break check
  if (heartbeatCheckCount % 10 === 0) {
    const onBreakCount = await query(
      `SELECT COUNT(*) as count FROM transporter_status WHERE status = 'on_break'`
    );
    logger.info(`[BreakCheck] Diagnostic: total_on_break=${onBreakCount.rows[0].count}, exceeding_threshold=${result.rows.length}, threshold=${timing.break_alert_minutes}min`);
  }

  if (result.rows.length > 0) {
    logger.info(`[BreakCheck] Found ${result.rows.length} user(s) on break exceeding ${timing.break_alert_minutes} min threshold`);
  }

  for (const row of result.rows) {
    const breakStart = new Date(row.on_break_since);
    const minutesOnBreak = Math.floor((Date.now() - breakStart.getTime()) / 60000);

    io.emit('break_alert', {
      user_id: row.user_id,
      minutes_on_break: minutesOnBreak,
      first_name: row.first_name,
      last_name: row.last_name,
    });

    logger.info(
      `Break alert: User ${row.user_id} (${row.first_name} ${row.last_name}) on break for ${minutesOnBreak} minutes`
    );
  }
};

const checkAutoLogout = async () => {
  const io = getIO();
  if (!io) return;

  const alertSettings = await getAlertSettings();
  if (!alertSettings.auto_logout_enabled || !alertSettings.auto_logout_time) {
    return;
  }

  const { dateStr, seconds: currentSeconds } = getLocalNow();

  // Don't run more than once per day
  if (lastAutoLogoutDate === dateStr) return;

  const [targetHour, targetMinute] = alertSettings.auto_logout_time.split(':').map(Number);
  const targetSeconds = targetHour * 3600 + targetMinute * 60;

  // Check if we're within 30 seconds of the target time
  if (Math.abs(currentSeconds - targetSeconds) <= 30) {
    lastAutoLogoutDate = dateStr;
    logger.info(`[AutoLogout] Auto-logout triggered at ${alertSettings.auto_logout_time} (${APP_TIMEZONE})`);

    const result = await performFullLogout();

    logger.info(
      `[AutoLogout] ${result.dispatchers_ended} dispatcher sessions ended, ${result.secretaries_ended} secretary sessions ended, ${result.transporters_offlined} transporters set offline`
    );
  }
};

export const performFullLogout = async (): Promise<{ dispatchers_ended: number; secretaries_ended: number; transporters_offlined: number }> => {
  const io = getIO();

  // Durably revoke every outstanding JWT — all roles including supervisors and
  // managers — so "force logout all" actually logs everyone out rather than
  // letting tokens live to their 12h expiry
  await query(`UPDATE users SET sessions_invalidated_at = NOW()`);

  // End all active dispatcher sessions
  const dispatcherResult = await query(
    `UPDATE active_dispatchers SET ended_at = CURRENT_TIMESTAMP
     WHERE ended_at IS NULL
     RETURNING id`
  );

  // Emit updated (empty) dispatcher list
  await broadcastDispatcherChanged();

  // End all active secretary sessions
  const secretaryResult = await query(
    `UPDATE active_secretaries SET ended_at = CURRENT_TIMESTAMP
     WHERE ended_at IS NULL
     RETURNING id`
  );

  // Emit updated (empty) secretary list
  await broadcastSecretaryChanged();

  // End all active transporter shifts
  await query(
    `UPDATE shift_logs SET shift_end = CURRENT_TIMESTAMP WHERE shift_end IS NULL`
  );

  // Close open offline periods
  await query(
    `UPDATE offline_periods
     SET online_at = CURRENT_TIMESTAMP,
         duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - offline_at))::int
     WHERE online_at IS NULL`
  );

  // Set all transporters to offline
  const affectedTransporters = await query(
    `UPDATE transporter_status SET status = 'offline', updated_at = CURRENT_TIMESTAMP
     WHERE status != 'offline'
     RETURNING user_id`
  );

  // Emit status change for each affected transporter
  if (io) {
    for (const row of affectedTransporters.rows) {
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
    }
  }

  // Remove all heartbeat records
  await query('DELETE FROM user_heartbeats');

  // Send every connected client — all roles including supervisors and managers —
  // back to the login screen; their revoked tokens can't re-authenticate
  if (io) {
    io.emit('force_logout', { message: 'You have been logged out.' });
  }

  logger.info(`[ForceLogout] ${dispatcherResult.rows.length} dispatcher sessions ended, ${secretaryResult.rows.length} secretary sessions ended, ${affectedTransporters.rows.length} transporters set offline`);

  return {
    dispatchers_ended: dispatcherResult.rows.length,
    secretaries_ended: secretaryResult.rows.length,
    transporters_offlined: affectedTransporters.rows.length,
  };
};

export const isUserOnline = async (userId: number): Promise<boolean> => {
  const timing = await getAlertTiming();
  const timeoutMs = timing.offline_alert_minutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();

  const result = await query(
    'SELECT 1 FROM user_heartbeats WHERE user_id = $1 AND last_heartbeat >= $2',
    [userId, cutoffTime]
  );

  return result.rows.length > 0;
};

export const getOnlineUsers = async (): Promise<number[]> => {
  const timing = await getAlertTiming();
  const timeoutMs = timing.offline_alert_minutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();

  const result = await query(
    'SELECT user_id FROM user_heartbeats WHERE last_heartbeat >= $1',
    [cutoffTime]
  );

  return result.rows.map((row) => row.user_id);
};

const cleanupOldAuditLogs = async () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastRetentionCleanupDate === todayStr) return;
  lastRetentionCleanupDate = todayStr;

  try {
    // HIPAA requires audit/access records be retained per policy (commonly
    // 6 years). Configurable via AUDIT_RETENTION_DAYS; defaults to ~6 years.
    const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '2192', 10);
    const result = await query(
      `DELETE FROM audit_logs WHERE timestamp < NOW() - ($1 || ' days')::interval`,
      [retentionDays]
    );
    const deleted = result.rowCount ?? 0;
    if (deleted > 0) {
      logger.info(`[Retention] Deleted ${deleted} audit log(s) older than ${retentionDays} days`);
    }
  } catch (error) {
    logger.error('[Retention] Failed to clean up audit logs:', error);
  }
};
