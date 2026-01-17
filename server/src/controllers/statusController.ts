import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest, TransporterStatus } from '../types/index.js';
import { getIO } from '../socket/index.js';

export const getAllStatuses = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT ts.*,
              u.first_name, u.last_name, u.email,
              tr.id as current_job_id,
              tr.origin_floor, tr.room_number, tr.status as job_status
       FROM transporter_status ts
       JOIN users u ON ts.user_id = u.id
       LEFT JOIN transport_requests tr ON tr.assigned_to = ts.user_id
         AND tr.status NOT IN ('complete', 'cancelled', 'pending')
       WHERE u.is_active = true
       ORDER BY u.last_name, u.first_name`
    );

    const statuses = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
      },
      current_job: row.current_job_id
        ? {
            id: row.current_job_id,
            origin_floor: row.origin_floor,
            room_number: row.room_number,
            status: row.job_status,
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

    const { status } = req.body;

    const validStatuses: TransporterStatus[] = [
      'available',
      'on_break',
      'off_unit',
      'offline',
    ];

    // Only allow setting these statuses directly - others are set by job actions
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: 'Invalid status. Can only set: available, on_break, off_unit, offline',
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

    const result = await query(
      `UPDATE transporter_status
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING *`,
      [status, req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Transporter status not found' });
      return;
    }

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
