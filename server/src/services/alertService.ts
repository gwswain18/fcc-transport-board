import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';

const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const STAT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const ACCEPTANCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
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

export const startAlertService = () => {
  console.log('Starting alert service...');

  setInterval(async () => {
    try {
      await checkForAlerts();
    } catch (error) {
      console.error('Alert service error:', error);
    }
  }, CHECK_INTERVAL_MS);
};

const checkForAlerts = async () => {
  const io = getIO();
  if (!io) return;

  const now = new Date();

  // Check pending requests that have timed out
  const pendingResult = await query(
    `SELECT id, origin_floor, room_number, priority, status, created_at, assigned_at
     FROM transport_requests
     WHERE status = 'pending'
     AND created_at < $1`,
    [new Date(now.getTime() - PENDING_TIMEOUT_MS).toISOString()]
  );

  for (const request of pendingResult.rows as AlertRequest[]) {
    const timeoutMs = request.priority === 'stat' ? STAT_TIMEOUT_MS : PENDING_TIMEOUT_MS;
    const createdAt = new Date(request.created_at);

    if (now.getTime() - createdAt.getTime() > timeoutMs) {
      io.emit('alert_triggered', {
        request_id: request.id,
        type: request.priority === 'stat' ? 'stat_timeout' : 'pending_timeout',
        request,
      });
    }
  }

  // Check STAT requests specifically
  const statResult = await query(
    `SELECT id, origin_floor, room_number, priority, status, created_at, assigned_at
     FROM transport_requests
     WHERE status = 'pending'
     AND priority = 'stat'
     AND created_at < $1`,
    [new Date(now.getTime() - STAT_TIMEOUT_MS).toISOString()]
  );

  for (const request of statResult.rows as AlertRequest[]) {
    io.emit('alert_triggered', {
      request_id: request.id,
      type: 'stat_timeout',
      request,
    });
  }

  // Check assigned requests not yet accepted
  const assignedResult = await query(
    `SELECT id, origin_floor, room_number, priority, status, created_at, assigned_at
     FROM transport_requests
     WHERE status = 'assigned'
     AND assigned_at < $1`,
    [new Date(now.getTime() - ACCEPTANCE_TIMEOUT_MS).toISOString()]
  );

  for (const request of assignedResult.rows as AlertRequest[]) {
    io.emit('alert_triggered', {
      request_id: request.id,
      type: 'acceptance_timeout',
      request,
    });
  }
};
