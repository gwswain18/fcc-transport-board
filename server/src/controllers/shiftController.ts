import { Request, Response } from 'express';
import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';
import { logShiftStart, logShiftEnd, createAuditLog } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import { AuthenticatedRequest, Floor } from '../types/index.js';
import logger from '../utils/logger.js';

interface StartShiftInput {
  extension?: string;
  floor_assignment?: Floor;
}

// Start a new shift
export const startShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { extension, floor_assignment } = req.body as StartShiftInput;

    // Check if user already has an active shift
    const existingShift = await query(
      'SELECT id FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL',
      [userId]
    );

    if (existingShift.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active shift' });
    }

    // Create new shift
    const result = await query(
      `INSERT INTO shift_logs (user_id, shift_start, extension, floor_assignment)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3)
       RETURNING *`,
      [userId, extension || null, floor_assignment || null]
    );

    const shift = result.rows[0];

    // Update user status to available
    await query(
      `INSERT INTO transporter_status (user_id, status, updated_at)
       VALUES ($1, 'available', CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         status = 'available',
         updated_at = CURRENT_TIMESTAMP`,
      [userId]
    );

    // Log the shift start
    const { ipAddress } = getAuditContext(req);
    await logShiftStart(userId, shift.id, { extension, floor_assignment }, ipAddress);

    // Emit socket events
    const io = getIO();
    if (io) {
      io.emit('shift_started', shift);

      // Emit status change
      const statusResult = await query(
        `SELECT ts.*, u.first_name, u.last_name, u.email, u.role, u.primary_floor, u.phone_number
         FROM transporter_status ts
         JOIN users u ON ts.user_id = u.id
         WHERE ts.user_id = $1`,
        [userId]
      );
      if (statusResult.rows[0]) {
        io.emit('transporter_status_changed', statusResult.rows[0]);
      }
    }

    res.json({ shift, message: 'Shift started successfully' });
  } catch (error) {
    logger.error('Start shift error:', error);
    res.status(500).json({ error: 'Failed to start shift' });
  }
};

// End the current shift
export const endShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Find active shift
    const existingShift = await query(
      'SELECT * FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL',
      [userId]
    );

    if (existingShift.rows.length === 0) {
      return res.status(400).json({ error: 'No active shift found' });
    }

    // End the shift
    const result = await query(
      `UPDATE shift_logs SET shift_end = CURRENT_TIMESTAMP, end_reason = 'user'
       WHERE id = $1
       RETURNING *`,
      [existingShift.rows[0].id]
    );

    const shift = result.rows[0];

    // Close any open offline_periods
    await query(
      `UPDATE offline_periods
       SET online_at = CURRENT_TIMESTAMP,
           duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - offline_at))::int
       WHERE user_id = $1 AND online_at IS NULL`,
      [userId]
    );

    // Update user status to offline
    await query(
      `UPDATE transporter_status SET status = 'offline', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    // Log the shift end
    const { ipAddress } = getAuditContext(req);
    await logShiftEnd(userId, shift.id, {
      shift_start: shift.shift_start,
      shift_end: shift.shift_end,
    }, ipAddress);

    // Emit socket events
    const io = getIO();
    if (io) {
      io.emit('shift_ended', shift);

      // Emit status change
      const statusResult = await query(
        `SELECT ts.*, u.first_name, u.last_name, u.email, u.role
         FROM transporter_status ts
         JOIN users u ON ts.user_id = u.id
         WHERE ts.user_id = $1`,
        [userId]
      );
      if (statusResult.rows[0]) {
        io.emit('transporter_status_changed', statusResult.rows[0]);
      }
    }

    res.json({ shift, message: 'Shift ended successfully' });
  } catch (error) {
    logger.error('End shift error:', error);
    res.status(500).json({ error: 'Failed to end shift' });
  }
};

// Force end another user's shift (primary dispatcher / supervisor / manager)
export const forceEndShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestingUser = req.user!;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Authorization: dispatchers must be the primary dispatcher
    if (requestingUser.role === 'dispatcher') {
      const primaryCheck = await query(
        `SELECT id FROM active_dispatchers
         WHERE user_id = $1 AND is_primary = true AND ended_at IS NULL`,
        [requestingUser.id]
      );
      if (primaryCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Only the primary dispatcher can end shifts' });
      }
    }
    // supervisors and managers are always allowed (canDispatch middleware already checked role)

    // Find target user's active shift
    const existingShift = await query(
      'SELECT * FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL',
      [targetUserId]
    );

    if (existingShift.rows.length === 0) {
      return res.status(400).json({ error: 'No active shift found for this user' });
    }

    // End the shift
    const result = await query(
      `UPDATE shift_logs SET shift_end = CURRENT_TIMESTAMP, end_reason = 'supervisor'
       WHERE id = $1
       RETURNING *`,
      [existingShift.rows[0].id]
    );

    const shift = result.rows[0];

    // Close any open offline_periods
    await query(
      `UPDATE offline_periods
       SET online_at = CURRENT_TIMESTAMP,
           duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - offline_at))::int
       WHERE user_id = $1 AND online_at IS NULL`,
      [targetUserId]
    );

    // Update user status to offline
    await query(
      `UPDATE transporter_status SET status = 'offline', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [targetUserId]
    );

    // Log the shift end
    const { ipAddress } = getAuditContext(req);
    await logShiftEnd(targetUserId, shift.id, {
      shift_start: shift.shift_start,
      shift_end: shift.shift_end,
      ended_by: requestingUser.id,
    }, ipAddress);

    // Emit socket events
    const io = getIO();
    if (io) {
      io.emit('shift_ended', shift);

      const statusResult = await query(
        `SELECT ts.*, u.first_name, u.last_name, u.email, u.role
         FROM transporter_status ts
         JOIN users u ON ts.user_id = u.id
         WHERE ts.user_id = $1`,
        [targetUserId]
      );
      if (statusResult.rows[0]) {
        io.emit('transporter_status_changed', statusResult.rows[0]);
      }
    }

    res.json({ shift, message: 'Shift ended successfully' });
  } catch (error) {
    logger.error('Force end shift error:', error);
    res.status(500).json({ error: 'Failed to end shift' });
  }
};

// Update extension for current shift
export const updateExtension = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { extension } = req.body;

    if (!extension) {
      return res.status(400).json({ error: 'Extension is required' });
    }

    // Update shift extension
    const result = await query(
      `UPDATE shift_logs SET extension = $1
       WHERE user_id = $2 AND shift_end IS NULL
       RETURNING *`,
      [extension, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No active shift found' });
    }

    // Emit socket event
    const io = getIO();
    if (io) {
      io.emit('extension_updated', { user_id: userId, extension });
    }

    res.json({ shift: result.rows[0], message: 'Extension updated' });
  } catch (error) {
    logger.error('Update extension error:', error);
    res.status(500).json({ error: 'Failed to update extension' });
  }
};

// Get current shift
export const getCurrentShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT sl.*, u.first_name, u.last_name
       FROM shift_logs sl
       JOIN users u ON sl.user_id = u.id
       WHERE sl.user_id = $1 AND sl.shift_end IS NULL`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ shift: null });
    }

    res.json({ shift: result.rows[0] });
  } catch (error) {
    logger.error('Get current shift error:', error);
    res.status(500).json({ error: 'Failed to get current shift' });
  }
};

// Get shift history (for reports)
export const getShiftHistory = async (req: Request, res: Response) => {
  try {
    const { user_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (user_id) {
      conditions.push(`sl.user_id = $${paramIndex++}`);
      params.push(parseInt(user_id as string, 10));
    }

    if (start_date) {
      conditions.push(`sl.shift_start >= $${paramIndex++}`);
      params.push(start_date);
    }

    if (end_date) {
      conditions.push(`sl.shift_start <= $${paramIndex++}`);
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT sl.*, u.first_name, u.last_name, u.email
       FROM shift_logs sl
       JOIN users u ON sl.user_id = u.id
       ${whereClause}
       ORDER BY sl.shift_start DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit as string, 10), parseInt(offset as string, 10)]
    );

    res.json({ shifts: result.rows });
  } catch (error) {
    logger.error('Get shift history error:', error);
    res.status(500).json({ error: 'Failed to get shift history' });
  }
};

// Manager correction of a shift's recorded times (forgotten logouts, missed
// clock-ins). Every edit is audit-logged with old/new values, stamps
// edited_by/edited_at, and marks end_reason 'manager_edit' when the end
// changes — the Shift Logs tab surfaces all of this so corrected data stays
// distinguishable from raw data.
export const updateShiftLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { shift_start, shift_end } = req.body as { shift_start?: string; shift_end?: string };

    if (shift_start === undefined && shift_end === undefined) {
      return res.status(400).json({ error: 'Provide shift_start and/or shift_end' });
    }

    const existing = await query('SELECT * FROM shift_logs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    const before = existing.rows[0];

    const newStart = shift_start !== undefined ? new Date(shift_start) : new Date(before.shift_start);
    const newEnd = shift_end !== undefined ? new Date(shift_end) : (before.shift_end ? new Date(before.shift_end) : null);

    if (isNaN(newStart.getTime()) || (newEnd !== null && isNaN(newEnd.getTime()))) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (newEnd !== null && newEnd <= newStart) {
      return res.status(400).json({ error: 'Shift end must be after shift start' });
    }
    const now = Date.now();
    if (newStart.getTime() > now || (newEnd !== null && newEnd.getTime() > now)) {
      return res.status(400).json({ error: 'Shift times cannot be in the future' });
    }

    const result = await query(
      `UPDATE shift_logs
       SET shift_start = $1,
           shift_end = $2,
           end_reason = CASE WHEN $2::timestamptz IS DISTINCT FROM shift_end THEN 'manager_edit' ELSE end_reason END,
           edited_by = $3,
           edited_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [newStart.toISOString(), newEnd ? newEnd.toISOString() : null, req.user!.id, id]
    );

    const { ipAddress, userAgent } = getAuditContext(req);
    await createAuditLog({
      userId: req.user!.id,
      action: 'update',
      entityType: 'shift_log',
      entityId: parseInt(id, 10),
      oldValues: { shift_start: before.shift_start, shift_end: before.shift_end, end_reason: before.end_reason },
      newValues: { shift_start: result.rows[0].shift_start, shift_end: result.rows[0].shift_end, end_reason: result.rows[0].end_reason },
      ipAddress,
      userAgent,
    });

    res.json({ shift: result.rows[0], message: 'Shift updated' });
  } catch (error) {
    logger.error('Update shift log error:', error);
    res.status(500).json({ error: 'Failed to update shift' });
  }
};
