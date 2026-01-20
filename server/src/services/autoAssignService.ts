import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';
import { getAutoAssignTimeoutMs } from './configService.js';
import { logStatusChange } from './auditService.js';
import { Floor, TransportRequest } from '../types/index.js';

const CHECK_INTERVAL_MS = 30000; // 30 seconds

let intervalId: NodeJS.Timeout | null = null;

export const startAutoAssignService = () => {
  console.log('Starting auto-assign service...');

  if (intervalId) {
    clearInterval(intervalId);
  }

  intervalId = setInterval(async () => {
    try {
      await checkAutoAssignTimeouts();
    } catch (error) {
      console.error('Auto-assign service error:', error);
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
  requestId: number
): Promise<{ success: boolean; assignedTo?: number; reason: string }> => {
  // Get request details
  const requestResult = await query(
    'SELECT * FROM transport_requests WHERE id = $1 AND status = $2',
    [requestId, 'pending']
  );

  if (requestResult.rows.length === 0) {
    return { success: false, reason: 'Request not found or not pending' };
  }

  const request = requestResult.rows[0] as TransportRequest;

  // Find best available transporter using tie-breaker rules
  const transporter = await findBestTransporter(request.origin_floor);

  if (!transporter) {
    return { success: false, reason: 'No available transporters' };
  }

  // Assign the request
  await query(
    `UPDATE transport_requests
     SET assigned_to = $1, status = 'assigned', assigned_at = CURRENT_TIMESTAMP,
         assignment_method = 'auto'
     WHERE id = $2`,
    [transporter.user_id, requestId]
  );

  // Update transporter status
  await query(
    `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [transporter.user_id]
  );

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
      [transporter.user_id]
    );
    if (statusResult.rows[0]) {
      io.emit('transporter_status_changed', statusResult.rows[0]);
    }
  }

  return {
    success: true,
    assignedTo: transporter.user_id,
    reason: transporter.reason,
  };
};

// Find best transporter using tie-breaker rules
export const findBestTransporter = async (
  originFloor: Floor
): Promise<{ user_id: number; reason: string } | null> => {
  // Get all available transporters with their stats
  const result = await query(
    `WITH transporter_jobs AS (
       SELECT
         ts.user_id,
         u.first_name,
         u.last_name,
         u.primary_floor,
         COUNT(tr.id) as total_jobs,
         MAX(tr.completed_at) as last_completed_at
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       LEFT JOIN transport_requests tr ON ts.user_id = tr.assigned_to
         AND tr.status = 'complete'
         AND tr.completed_at >= CURRENT_DATE
       WHERE ts.status = 'available'
       AND u.is_active = true
       AND u.role = 'transporter'
       GROUP BY ts.user_id, u.first_name, u.last_name, u.primary_floor
     )
     SELECT
       user_id,
       first_name,
       last_name,
       primary_floor,
       COALESCE(total_jobs, 0) as jobs_today,
       last_completed_at
     FROM transporter_jobs
     ORDER BY
       -- Tie-breaker 1: Prefer transporter assigned to the floor
       CASE WHEN primary_floor = $1 THEN 0 ELSE 1 END,
       -- Tie-breaker 2: Fewer jobs completed today
       COALESCE(total_jobs, 0) ASC,
       -- Tie-breaker 3: Longest time since last job (NULL = never, highest priority)
       COALESCE(last_completed_at, '1970-01-01'::timestamp) ASC
     LIMIT 1`,
    [originFloor]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const selected = result.rows[0];
  let reason = 'Selected based on availability';

  if (selected.primary_floor === originFloor) {
    reason = `Assigned to ${originFloor} floor`;
  } else if (selected.jobs_today === 0) {
    reason = 'No jobs completed today';
  } else {
    reason = `Fewest jobs today (${selected.jobs_today})`;
  }

  return { user_id: selected.user_id, reason };
};

// Check for auto-assigned requests that have timed out without acceptance
const checkAutoAssignTimeouts = async () => {
  const io = getIO();
  if (!io) return;

  const timeoutMs = await getAutoAssignTimeoutMs();
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();

  // Find auto-assigned requests that haven't been accepted
  const result = await query(
    `SELECT id, assigned_to, origin_floor
     FROM transport_requests
     WHERE status = 'assigned'
     AND assignment_method = 'auto'
     AND assigned_at < $1`,
    [cutoffTime]
  );

  for (const request of result.rows) {
    const oldAssignee = request.assigned_to;

    // Try to reassign to a different transporter
    // First, mark the old assignee as available (they didn't respond)
    await query(
      `UPDATE transporter_status SET status = 'available', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [oldAssignee]
    );

    // Log the timeout
    await logStatusChange(
      oldAssignee,
      'transport_request',
      request.id,
      'assigned',
      'pending',
      'auto_assign_timeout'
    );

    // Reset request to pending temporarily
    await query(
      `UPDATE transport_requests
       SET status = 'pending', assigned_to = NULL, assigned_at = NULL
       WHERE id = $1`,
      [request.id]
    );

    // Try to find another transporter (excluding the one who timed out)
    const newTransporter = await findBestTransporterExcluding(
      request.origin_floor,
      [oldAssignee]
    );

    if (newTransporter) {
      // Assign to new transporter
      await query(
        `UPDATE transport_requests
         SET assigned_to = $1, status = 'assigned', assigned_at = CURRENT_TIMESTAMP,
             assignment_method = 'auto'
         WHERE id = $2`,
        [newTransporter.user_id, request.id]
      );

      await query(
        `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [newTransporter.user_id]
      );

      io.emit('auto_assign_timeout', {
        request_id: request.id,
        old_assignee: oldAssignee,
        new_assignee: newTransporter.user_id,
      });
    } else {
      // No available transporter, leave as pending
      io.emit('auto_assign_timeout', {
        request_id: request.id,
        old_assignee: oldAssignee,
        new_assignee: null,
      });
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
  excludeUserIds: number[]
): Promise<{ user_id: number; reason: string } | null> => {
  if (excludeUserIds.length === 0) {
    return findBestTransporter(originFloor);
  }

  const result = await query(
    `WITH transporter_jobs AS (
       SELECT
         ts.user_id,
         u.primary_floor,
         COUNT(tr.id) as total_jobs,
         MAX(tr.completed_at) as last_completed_at
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       LEFT JOIN transport_requests tr ON ts.user_id = tr.assigned_to
         AND tr.status = 'complete'
         AND tr.completed_at >= CURRENT_DATE
       WHERE ts.status = 'available'
       AND u.is_active = true
       AND u.role = 'transporter'
       AND ts.user_id != ALL($2)
       GROUP BY ts.user_id, u.primary_floor
     )
     SELECT user_id, primary_floor, COALESCE(total_jobs, 0) as jobs_today
     FROM transporter_jobs
     ORDER BY
       CASE WHEN primary_floor = $1 THEN 0 ELSE 1 END,
       COALESCE(total_jobs, 0) ASC,
       COALESCE(last_completed_at, '1970-01-01'::timestamp) ASC
     LIMIT 1`,
    [originFloor, excludeUserIds]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const selected = result.rows[0];
  const reason =
    selected.primary_floor === originFloor
      ? `Reassigned to ${originFloor} floor transporter`
      : 'Reassigned to next available';

  return { user_id: selected.user_id, reason };
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
