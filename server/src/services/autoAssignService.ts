import { PoolClient } from 'pg';
import { query, withTransaction } from '../config/database.js';
import { getIO, emitToUser } from '../socket/index.js';
import { getAutoReassignSettings, getAutoAssignFloorFirst } from './configService.js';
import { logStatusChange, createAuditLog } from './auditService.js';
import {
  createNotification,
  getMissedUserIdsForRequest,
  markDelivered,
} from './notificationService.js';
import { sendJobAssignmentSMS } from './twilioService.js';
import { Floor, TransportRequest } from '../types/index.js';
import logger from '../utils/logger.js';

// Run a query on the transaction client when inside one, else on the pool
const runQuery = (client?: PoolClient) => (text: string, params?: unknown[]) =>
  client ? client.query(text, params) : query(text, params);

const CHECK_INTERVAL_MS = 30000; // 30 seconds

let intervalId: NodeJS.Timeout | null = null;

export const startAutoAssignService = () => {
  logger.info('Starting auto-assign service...');

  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(async () => {
    try {
      await checkAutoAssignTimeouts();
    } catch (error) {
      logger.error('Auto-assign service error:', error);
    }
  }, CHECK_INTERVAL_MS);
};

export const stopAutoAssignService = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

// Auto-assign a request to the best available transporter
export const autoAssignRequest = async (
  requestId: number,
  assignedBy?: number
): Promise<{ success: boolean; assignedTo?: number; reason: string }> => {
  const outcome = await withTransaction<{
    success: boolean;
    assignedTo?: number;
    reason: string;
  }>(async (client) => {
    // Lock the request row so concurrent claims/auto-assigns serialize on it
    const requestResult = await client.query(
      'SELECT * FROM transport_requests WHERE id = $1 AND status = $2 FOR UPDATE',
      [requestId, 'pending']
    );

    if (requestResult.rows.length === 0) {
      return { success: false, reason: 'Request not found or not pending' };
    }

    const request = requestResult.rows[0] as TransportRequest;

    // A selected transporter can be grabbed by a concurrent claim between the
    // read and the reservation, so retry with that transporter excluded.
    const excluded: number[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const transporter = excluded.length
        ? await findBestTransporterExcluding(request.origin_floor, excluded, client)
        : await findBestTransporter(request.origin_floor, client);

      if (!transporter) {
        return { success: false, reason: 'No available transporters' };
      }

      // Atomically reserve the transporter; rowCount 0 means someone else got them
      const reserved = await client.query(
        `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'available'`,
        [transporter.user_id]
      );

      if (reserved.rowCount === 0) {
        excluded.push(transporter.user_id);
        continue;
      }

      await client.query(
        `UPDATE transport_requests
         SET assigned_to = $1, status = 'assigned', assigned_at = CURRENT_TIMESTAMP,
             assignment_method = 'auto', assigned_by = $3, assignee_floor = $4
         WHERE id = $2 AND status = 'pending'`,
        [transporter.user_id, requestId, assignedBy || null, transporter.active_floor]
      );

      return { success: true, assignedTo: transporter.user_id, reason: transporter.reason };
    }

    return { success: false, reason: 'No available transporters' };
  });

  if (!outcome.success || !outcome.assignedTo) {
    return outcome;
  }

  const assignedTo = outcome.assignedTo;

  // Emit events
  const io = getIO();
  if (io) {
    const updatedRequest = await getRequestWithRelations(requestId);
    io.emit('request_assigned', updatedRequest);

    const statusResult = await query(
      `SELECT ts.*, u.first_name, u.last_name, u.email, u.role
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       WHERE ts.user_id = $1`,
      [assignedTo]
    );
    if (statusResult.rows[0]) {
      io.emit('transporter_status_changed', statusResult.rows[0]);
    }
  }

  return outcome;
};

// The floor a transporter is covering right now: their open shift's
// floor_assignment (chosen at shift start), falling back to the static
// profile primary_floor. Used to stamp transport_requests.assignee_floor at
// every assignment point so reports can compare pickup floor vs covered floor.
export const getActiveFloorForUser = async (
  userId: number,
  client?: PoolClient
): Promise<Floor | null> => {
  const result = await runQuery(client)(
    `SELECT COALESCE(sl.floor_assignment, u.primary_floor) AS active_floor
     FROM users u
     LEFT JOIN LATERAL (
       SELECT floor_assignment FROM shift_logs
       WHERE user_id = u.id AND shift_end IS NULL
       ORDER BY shift_start DESC LIMIT 1
     ) sl ON true
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0]?.active_floor ?? null;
};

// Find best transporter using tie-breaker rules. Floor preference is the
// manager-controlled auto_assign_floor_first toggle: when on, the transporter
// covering the request's floor today wins; when off, workload balance alone
// decides. active_floor comes back so callers can stamp assignee_floor.
export const findBestTransporter = async (
  originFloor: Floor,
  client?: PoolClient
): Promise<{ user_id: number; active_floor: Floor | null; reason: string } | null> =>
  findBestTransporterExcluding(originFloor, [], client);

// Check for assigned requests that have timed out without acceptance.
// Covers all assignment methods (auto, manual, claim); gated by the
// manager-controlled auto_reassign_enabled setting.
const checkAutoAssignTimeouts = async () => {
  const io = getIO();
  if (!io) return;

  const { enabled, timeoutMinutes } = await getAutoReassignSettings();
  if (!enabled) return;

  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60000).toISOString();

  // Find assigned requests that haven't been accepted in time
  const result = await query(
    `SELECT id, assigned_to, origin_floor, room_number, destination, priority, assignment_method
     FROM transport_requests
     WHERE status = 'assigned'
     AND assigned_at < $1`,
    [cutoffTime]
  );

  for (const request of result.rows) {
    const oldAssignee = request.assigned_to;

    // Transporters who already missed this request never get it bounced back
    const priorMissers = await getMissedUserIdsForRequest(request.id);

    // Reassign atomically: re-verify under lock so a transporter who accepted
    // between the scan and now keeps their job
    const reassignment = await withTransaction<{ newAssignee: number | null } | null>(async (client) => {
      const current = await client.query(
        `SELECT id, origin_floor FROM transport_requests
         WHERE id = $1 AND status = 'assigned' AND assigned_to = $3
           AND assigned_at < $2
         FOR UPDATE`,
        [request.id, cutoffTime, oldAssignee]
      );
      if (current.rows.length === 0) return null;

      // Free the old assignee unless they've since moved to another status
      await client.query(
        `UPDATE transporter_status SET status = 'available', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'assigned'`,
        [oldAssignee]
      );

      // Reset request to pending temporarily
      await client.query(
        `UPDATE transport_requests
         SET status = 'pending', assigned_to = NULL, assigned_at = NULL,
             assignee_floor = NULL
         WHERE id = $1`,
        [request.id]
      );

      // Try another transporter, excluding the one who timed out and anyone
      // who missed this request before
      const excluded = Array.from(new Set([oldAssignee, ...priorMissers]));
      for (let attempt = 0; attempt < 3; attempt++) {
        const newTransporter = await findBestTransporterExcluding(
          request.origin_floor,
          excluded,
          client
        );
        if (!newTransporter) break;

        const reserved = await client.query(
          `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND status = 'available'`,
          [newTransporter.user_id]
        );
        if (reserved.rowCount === 0) {
          excluded.push(newTransporter.user_id);
          continue;
        }

        await client.query(
          `UPDATE transport_requests
           SET assigned_to = $1, status = 'assigned', assigned_at = CURRENT_TIMESTAMP,
               assignment_method = 'auto', assignee_floor = $3
           WHERE id = $2`,
          [newTransporter.user_id, request.id, newTransporter.active_floor]
        );
        return { newAssignee: newTransporter.user_id };
      }

      // No available transporter, leave as pending
      return { newAssignee: null };
    });

    // Request was claimed/progressed before we could reassign — nothing to do
    if (!reassignment) continue;

    // Log the timeout
    await logStatusChange(
      oldAssignee,
      'transport_request',
      request.id,
      'assigned',
      'pending',
      'auto_assign_timeout'
    );

    // PHI-safe summary (floor/room/destination/priority only — never notes)
    const jobSummary = `${request.origin_floor} Room ${request.room_number} → ${request.destination}${request.priority === 'stat' ? ' (STAT)' : ''}`;

    let newAssigneeName: string | null = null;
    if (reassignment.newAssignee) {
      const nameResult = await query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [reassignment.newAssignee]
      );
      if (nameResult.rows[0]) {
        newAssigneeName = `${nameResult.rows[0].first_name} ${nameResult.rows[0].last_name}`;
      }
    }

    // Audit the reassignment (system-initiated, so no userId)
    await createAuditLog({
      action: 'reassignment',
      entityType: 'transport_request',
      entityId: request.id,
      oldValues: {
        assigned_to: oldAssignee,
        assignment_method: request.assignment_method,
        reason: 'acceptance_timeout',
      },
      newValues: { assigned_to: reassignment.newAssignee },
    });

    // Durable missed-job notice for the transporter who didn't respond;
    // delivered now if they're connected, otherwise on next connect
    const notification = await createNotification(oldAssignee, 'missed_job', {
      request_id: request.id,
      job_summary: jobSummary,
      assignment_method: request.assignment_method,
      timed_out_after_minutes: timeoutMinutes,
      new_assignee_name: newAssigneeName,
      occurred_at: new Date().toISOString(),
    });
    if (emitToUser(oldAssignee, 'missed_job_notification', { notification })) {
      await markDelivered([notification.id]);
    }

    io.emit('auto_assign_timeout', {
      request_id: request.id,
      old_assignee: oldAssignee,
      new_assignee: reassignment.newAssignee,
      assignment_method: request.assignment_method,
      job_summary: jobSummary,
    });

    // Notify the new assignee through the normal assignment channels
    if (reassignment.newAssignee) {
      const updatedRequest = await getRequestWithRelations(request.id);
      if (updatedRequest) {
        io.emit('request_assigned', updatedRequest);
      }
      sendJobAssignmentSMS(
        reassignment.newAssignee,
        request.id,
        request.origin_floor,
        request.room_number,
        request.priority
      ).catch((error) => logger.error('Reassignment SMS error:', error));

      const newStatusResult = await query(
        `SELECT ts.*, u.first_name, u.last_name, u.email, u.role
         FROM transporter_status ts
         JOIN users u ON ts.user_id = u.id
         WHERE ts.user_id = $1`,
        [reassignment.newAssignee]
      );
      if (newStatusResult.rows[0]) {
        io.emit('transporter_status_changed', newStatusResult.rows[0]);
      }
    }

    // Emit status change for old assignee
    const statusResult = await query(
      `SELECT ts.*, u.first_name, u.last_name, u.email, u.role
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       WHERE ts.user_id = $1`,
      [oldAssignee]
    );
    if (statusResult.rows[0]) {
      io.emit('transporter_status_changed', statusResult.rows[0]);
    }
  }
};

// Find best transporter excluding certain users
const findBestTransporterExcluding = async (
  originFloor: Floor,
  excludeUserIds: number[],
  client?: PoolClient
): Promise<{ user_id: number; active_floor: Floor | null; reason: string } | null> => {
  const floorFirst = await getAutoAssignFloorFirst();

  const result = await runQuery(client)(
    `WITH transporter_jobs AS (
       SELECT
         ts.user_id,
         COALESCE(sl.floor_assignment, u.primary_floor) AS active_floor,
         COUNT(tr.id) as total_jobs,
         MAX(tr.completed_at) as last_completed_at
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT floor_assignment FROM shift_logs
         WHERE user_id = ts.user_id AND shift_end IS NULL
         ORDER BY shift_start DESC LIMIT 1
       ) sl ON true
       LEFT JOIN transport_requests tr ON ts.user_id = tr.assigned_to
         AND tr.status = 'complete'
         AND tr.completed_at >= CURRENT_DATE
       WHERE ts.status = 'available'
       AND u.is_active = true
       AND u.role = 'transporter'
       AND ts.user_id != ALL($2)
       GROUP BY ts.user_id, sl.floor_assignment, u.primary_floor
     )
     SELECT user_id, active_floor, COALESCE(total_jobs, 0) as jobs_today, last_completed_at
     FROM transporter_jobs
     ORDER BY
       -- Tie-breaker 1 (only in floor-first mode): prefer the transporter
       -- covering this floor today
       CASE WHEN $3::boolean AND active_floor = $1 THEN 0 ELSE 1 END,
       -- Tie-breaker 2: Fewer jobs completed today
       COALESCE(total_jobs, 0) ASC,
       -- Tie-breaker 3: Longest time since last job (NULL = never, highest priority)
       COALESCE(last_completed_at, '1970-01-01'::timestamp) ASC
     LIMIT 1`,
    [originFloor, excludeUserIds, floorFirst]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const selected = result.rows[0];
  let reason = 'Selected based on availability';

  if (floorFirst && selected.active_floor === originFloor) {
    reason = `Covering ${originFloor} today`;
  } else if (selected.jobs_today === 0) {
    reason = 'No jobs completed today';
  } else {
    reason = `Fewest jobs today (${selected.jobs_today})`;
  }

  return { user_id: selected.user_id, active_floor: selected.active_floor, reason };
};

// Helper to get request with relations
const getRequestWithRelations = async (requestId: number) => {
  const result = await query(
    `SELECT
       tr.*,
       creator.id as creator_id, creator.first_name as creator_first_name,
       creator.last_name as creator_last_name, creator.email as creator_email,
       assignee.id as assignee_id, assignee.first_name as assignee_first_name,
       assignee.last_name as assignee_last_name, assignee.email as assignee_email
     FROM transport_requests tr
     LEFT JOIN users creator ON tr.created_by = creator.id
     LEFT JOIN users assignee ON tr.assigned_to = assignee.id
     WHERE tr.id = $1`,
    [requestId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    origin_floor: row.origin_floor,
    room_number: row.room_number,
    destination: row.destination,
    priority: row.priority,
    notes: row.notes,
    status: row.status,
    assignment_method: row.assignment_method,
    created_by: row.created_by,
    assigned_to: row.assigned_to,
    assignee_floor: row.assignee_floor,
    created_at: row.created_at,
    assigned_at: row.assigned_at,
    accepted_at: row.accepted_at,
    en_route_at: row.en_route_at,
    with_patient_at: row.with_patient_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    creator: row.creator_id
      ? {
          id: row.creator_id,
          first_name: row.creator_first_name,
          last_name: row.creator_last_name,
          email: row.creator_email,
        }
      : null,
    assignee: row.assignee_id
      ? {
          id: row.assignee_id,
          first_name: row.assignee_first_name,
          last_name: row.assignee_last_name,
          email: row.assignee_email,
        }
      : null,
  };
};
