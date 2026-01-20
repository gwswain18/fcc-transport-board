import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest, TransporterStatus } from '../types/index.js';
import { getIO } from '../socket/index.js';
import { logStatusChange, logStatusOverride } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import { recordHeartbeat } from '../services/heartbeatService.js';

export const getAllStatuses = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT ts.*,
              u.first_name, u.last_name, u.email, u.primary_floor, u.phone_number,
              tr.id as current_job_id,
              tr.origin_floor, tr.room_number, tr.status as job_status,
              tr.priority as job_priority,
              sl.extension, sl.floor_assignment
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       LEFT JOIN transport_requests tr ON tr.assigned_to = ts.user_id
         AND tr.status NOT IN ('complete', 'cancelled', 'pending')
       LEFT JOIN shift_logs sl ON sl.user_id = ts.user_id AND sl.shift_end IS NULL
       WHERE u.is_active = true
       ORDER BY u.last_name, u.first_name`
    );

    const statuses = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      status_explanation: row.status_explanation,
      on_break_since: row.on_break_since,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        primary_floor: row.primary_floor,
        phone_number: row.phone_number,
      },
      current_job: row.current_job_id
        ? {
            id: row.current_job_id,
            origin_floor: row.origin_floor,
            room_number: row.room_number,
            status: row.job_status,
            priority: row.job_priority,
          }
        : null,
      shift: row.extension
        ? {
            extension: row.extension,
            floor_assignment: row.floor_assignment,
          }
        : null,
    }));

    res.json({ statuses });
  } catch (error) {
    console.error('Get statuses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateOwnStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { status, explanation } = req.body;

    // Changed 'off_unit' to 'other' per feature request
    const validStatuses: TransporterStatus[] = [
      'available',
      'on_break',
      'other', // was 'off_unit'
      'offline',
    ];

    // Only allow setting these statuses directly - others are set by job actions
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: 'Invalid status. Can only set: available, on_break, other, offline',
      });
      return;
    }

    // Require explanation for 'other' status
    if (status === 'other' && !explanation) {
      res.status(400).json({
        error: 'Explanation is required when setting status to "Other"',
      });
      return;
    }

    // Check if user has an active job
    const activeJob = await query(
      `SELECT id FROM transport_requests
       WHERE assigned_to = $1
       AND status NOT IN ('complete', 'cancelled', 'pending')`,
      [req.user.id]
    );

    if (activeJob.rows.length > 0 && status !== 'available') {
      res.status(400).json({
        error: 'Cannot change status while having an active job',
      });
      return;
    }

    // Get current status for logging
    const currentResult = await query(
      'SELECT status FROM transporter_status WHERE user_id = $1',
      [req.user.id]
    );
    const oldStatus = currentResult.rows[0]?.status || 'offline';

    // Build update query
    const updateFields = [
      'status = $1',
      'updated_at = CURRENT_TIMESTAMP',
    ];
    if (status === 'other') {
      updateFields.push('status_explanation = $3');
    } else {
      updateFields.push('status_explanation = NULL');
    }

    // Track break start time
    if (status === 'on_break') {
      updateFields.push('on_break_since = CURRENT_TIMESTAMP');
    } else {
      updateFields.push('on_break_since = NULL');
    }

    const params =
      status === 'other'
        ? [status, req.user.id, explanation]
        : [status, req.user.id];

    const result = await query(
      `UPDATE transporter_status
       SET ${updateFields.join(', ')}
       WHERE user_id = $2
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Transporter status not found' });
      return;
    }

    // Log the status change
    const { ipAddress } = getAuditContext(req);
    await logStatusChange(req.user.id, 'transporter_status', req.user.id, oldStatus, status, ipAddress);

    // Record heartbeat
    await recordHeartbeat(req.user.id);

    const updatedStatus = {
      ...result.rows[0],
      user: {
        id: req.user.id,
        first_name: req.user.first_name,
        last_name: req.user.last_name,
      },
    };

    // Emit socket event
    const io = getIO();
    if (io) {
      io.emit('transporter_status_changed', updatedStatus);
    }

    res.json({ status: updatedStatus, message: 'Status updated' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Manager/Supervisor status override
export const overrideStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { userId } = req.params;
    const { new_status, reason } = req.body;

    if (!new_status || !reason) {
      res.status(400).json({ error: 'New status and reason are required' });
      return;
    }

    // Verify target user exists and is a transporter
    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (userResult.rows[0].role !== 'transporter') {
      res.status(400).json({ error: 'Can only override status for transporters' });
      return;
    }

    // Get current status
    const currentResult = await query(
      'SELECT status FROM transporter_status WHERE user_id = $1',
      [userId]
    );
    const oldStatus = currentResult.rows[0]?.status || 'offline';

    // Update status
    const result = await query(
      `UPDATE transporter_status
       SET status = $1, status_explanation = $2, updated_at = CURRENT_TIMESTAMP,
           on_break_since = CASE WHEN $1 = 'on_break' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE user_id = $3
       RETURNING *`,
      [new_status, `Override: ${reason}`, userId]
    );

    // Log the override
    const { ipAddress } = getAuditContext(req);
    await logStatusOverride(req.user.id, parseInt(userId), oldStatus, new_status, reason, ipAddress);

    // Emit socket event
    const io = getIO();
    if (io) {
      const statusWithUser = await query(
        `SELECT ts.*, u.first_name, u.last_name, u.email, u.primary_floor
         FROM transporter_status ts
         JOIN users u ON ts.user_id = u.id
         WHERE ts.user_id = $1`,
        [userId]
      );

      if (statusWithUser.rows[0]) {
        io.emit('transporter_status_changed', {
          ...statusWithUser.rows[0],
          user: {
            id: parseInt(userId),
            first_name: statusWithUser.rows[0].first_name,
            last_name: statusWithUser.rows[0].last_name,
            email: statusWithUser.rows[0].email,
            primary_floor: statusWithUser.rows[0].primary_floor,
          },
        });
      }
    }

    res.json({
      status: result.rows[0],
      message: `Status overridden to ${new_status}`,
    });
  } catch (error) {
    console.error('Override status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Heartbeat endpoint
export const handleHeartbeat = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    await recordHeartbeat(req.user.id);

    res.json({ message: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
