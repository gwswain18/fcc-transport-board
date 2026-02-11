import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';
import { getAlertSettings, getAlertTiming } from './configService.js';
import logger from '../utils/logger.js';

const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

interface AlertRequest {
  id: number;
  origin_floor: string;
  room_number: string;
  priority: string;
  status: string;
  created_at: string;
  assigned_at: string | null;
}

export const startAlertService = async () => {
  logger.info('Starting alert service...');

  // Log initial alert settings on startup
  try {
    const alertSettings = await getAlertSettings();
    const timing = await getAlertTiming();
    logger.info(`[AlertService] Alert settings: master_enabled=${alertSettings.master_enabled}`);
    logger.info(`[AlertService] Individual alerts: pending_timeout=${alertSettings.alerts.pending_timeout}, stat_timeout=${alertSettings.alerts.stat_timeout}, acceptance_timeout=${alertSettings.alerts.acceptance_timeout}`);
    logger.info(`[AlertService] Timing: pending=${timing.pending_timeout_minutes}min, stat=${timing.stat_timeout_minutes}min, acceptance=${timing.acceptance_timeout_minutes}min`);
  } catch (error) {
    logger.error('[AlertService] Failed to load initial settings:', error);
  }

  setInterval(async () => {
    try {
      await checkForAlerts();
    } catch (error) {
      logger.error('Alert service error:', error);
    }
  }, CHECK_INTERVAL_MS);
};

const checkForAlerts = async () => {
  const io = getIO();
  if (!io) return;

  // Check alert settings
  const alertSettings = await getAlertSettings();
  if (!alertSettings.master_enabled) {
    logger.info('[AlertService] All alerts disabled (master_enabled=false)');
    return;
  }

  const timing = await getAlertTiming();
  const now = new Date();

  const pendingTimeoutMs = timing.pending_timeout_minutes * 60 * 1000;
  const statTimeoutMs = timing.stat_timeout_minutes * 60 * 1000;
  const acceptanceTimeoutMs = timing.acceptance_timeout_minutes * 60 * 1000;

  // Check pending requests that have timed out
  if (alertSettings.alerts.pending_timeout) {
    const pendingResult = await query(
      `SELECT id, origin_floor, room_number, priority, status, created_at, assigned_at
       FROM transport_requests
       WHERE status = 'pending'
       AND priority != 'stat'
       AND created_at < $1`,
      [new Date(now.getTime() - pendingTimeoutMs).toISOString()]
    );

    for (const request of pendingResult.rows as AlertRequest[]) {
      const createdAt = new Date(request.created_at);

      if (now.getTime() - createdAt.getTime() > pendingTimeoutMs) {
        io.emit('alert_triggered', {
          request_id: request.id,
          type: 'pending_timeout',
          request,
        });
        logger.info(`[AlertService] Emitted pending_timeout for request ${request.id}`);
      }
    }
  }

  // Check STAT requests specifically
  if (alertSettings.alerts.stat_timeout) {
    const statResult = await query(
      `SELECT id, origin_floor, room_number, priority, status, created_at, assigned_at
       FROM transport_requests
       WHERE status = 'pending'
       AND priority = 'stat'
       AND created_at < $1`,
      [new Date(now.getTime() - statTimeoutMs).toISOString()]
    );

    for (const request of statResult.rows as AlertRequest[]) {
      io.emit('alert_triggered', {
        request_id: request.id,
        type: 'stat_timeout',
        request,
      });
      logger.info(`[AlertService] Emitted stat_timeout for request ${request.id}`);
    }
  }

  // Check assigned requests not yet accepted
  if (alertSettings.alerts.acceptance_timeout) {
    const assignedResult = await query(
      `SELECT id, origin_floor, room_number, priority, status, created_at, assigned_at
       FROM transport_requests
       WHERE status = 'assigned'
       AND assigned_at < $1`,
      [new Date(now.getTime() - acceptanceTimeoutMs).toISOString()]
    );

    for (const request of assignedResult.rows as AlertRequest[]) {
      io.emit('alert_triggered', {
        request_id: request.id,
        type: 'acceptance_timeout',
        request,
      });
      logger.info(`[AlertService] Emitted acceptance_timeout for request ${request.id}`);
    }
  }
};
