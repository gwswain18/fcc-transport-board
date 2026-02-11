import { Response } from 'express';
import { query } from '../config/database.js';
import {
  AuthenticatedRequest,
  RequestStatus,
  Floor,
  Priority,
  AssignmentMethod,
} from '../types/index.js';
import { getIO } from '../socket/index.js';
import { validateFloorRoom } from '../utils/validation.js';
import { autoAssignRequest } from '../services/autoAssignService.js';
import { sendJobAssignmentSMS } from '../services/twilioService.js';
import { logCreate, logStatusChange } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';

const validFloors: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
const validPriorities: Priority[] = ['routine', 'stat'];

const getRequestWithRelations = async (requestId: number) => {
  const result = await query(
    `SELECT tr.*,
            creator.first_name as creator_first_name,
            creator.last_name as creator_last_name,
            assignee.first_name as assignee_first_name,
            assignee.last_name as assignee_last_name
     FROM transport_requests tr
     LEFT JOIN users creator ON tr.created_by = creator.id
     LEFT JOIN users assignee ON tr.assigned_to = assignee.id
     WHERE tr.id = $1`,
    [requestId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    creator: {
      id: row.created_by,
      first_name: row.creator_first_name,
      last_name: row.creator_last_name,
    },
    assignee: row.assigned_to
      ? {
          id: row.assigned_to,
          first_name: row.assignee_first_name,
          last_name: row.assignee_last_name,
        }
      : null,
  };
};

export const getRequests = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, floor, assigned_to, start_date, end_date, include_complete } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND tr.status = $${paramIndex++}`;
      params.push(status);
    } else if (!include_complete || include_complete === 'false') {
      whereClause += ` AND tr.status NOT IN ('complete', 'cancelled')`;
    }

    if (floor) {
      whereClause += ` AND tr.origin_floor = $${paramIndex++}`;
      params.push(floor);
    }

    if (assigned_to) {
      whereClause += ` AND tr.assigned_to = $${paramIndex++}`;
      params.push(assigned_to);
    }

    if (start_date) {
      whereClause += ` AND tr.created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND tr.created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    const result = await query(
      `SELECT tr.*,
              creator.first_name as creator_first_name,
              creator.last_name as creator_last_name,
              assignee.first_name as assignee_first_name,
              assignee.last_name as assignee_last_name,
              last_mod.first_name as last_modifier_first_name,
              last_mod.last_name as last_modifier_last_name,
              last_mod.id as last_modifier_id
       FROM transport_requests tr
       LEFT JOIN users creator ON tr.created_by = creator.id
       LEFT JOIN users assignee ON tr.assigned_to = assignee.id
       LEFT JOIN LATERAL (
         SELECT al.user_id
         FROM audit_logs al
         WHERE al.entity_type = 'transport_request'
           AND al.entity_id = tr.id
         ORDER BY al.timestamp DESC
         LIMIT 1
       ) last_audit ON true
       LEFT JOIN users last_mod ON last_audit.user_id = last_mod.id
       ${whereClause}
       ORDER BY
         CASE WHEN tr.priority = 'stat' THEN 0 ELSE 1 END,
         tr.created_at ASC`,
      params
    );

    const requests = result.rows.map((row) => ({
      ...row,
      creator: {
        id: row.created_by,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
      },
      assignee: row.assigned_to
        ? {
            id: row.assigned_to,
            first_name: row.assignee_first_name,
            last_name: row.assignee_last_name,
          }
        : null,
      last_modifier: row.last_modifier_id && row.last_modifier_id !== row.created_by
        ? {
            id: row.last_modifier_id,
            first_name: row.last_modifier_first_name,
            last_name: row.last_modifier_last_name,
          }
        : null,
    }));

    res.json({ requests });
  } catch (error) {
    logger.error('Get requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const {
      origin_floor,
      room_number,
      destination = 'Atrium',
      priority = 'routine',
      notes,
      assigned_to,
      auto_assign = false,
    } = req.body;

    if (!origin_floor || !room_number) {
      res.status(400).json({ error: 'Origin floor and room number are required' });
      return;
    }

    if (!validFloors.includes(origin_floor)) {
      res.status(400).json({ error: 'Invalid origin floor' });
      return;
    }

    if (!validPriorities.includes(priority)) {
      res.status(400).json({ error: 'Invalid priority' });
      return;
    }

    // Floor/room validation
    const validation = validateFloorRoom(origin_floor, room_number);
    if (!validation.is_valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    let initialStatus: RequestStatus = 'pending';
    let assignmentMethod: AssignmentMethod = 'manual';
    let finalAssignedTo = assigned_to;

    if (assigned_to) {
      initialStatus = 'assigned';
      assignmentMethod = 'manual';
    }

    const result = await query(
      `INSERT INTO transport_requests
       (origin_floor, room_number, destination, priority, notes, status,
        created_by, assigned_to, assigned_at, assignment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        origin_floor,
        room_number,
        destination,
        priority,
        notes || null,
        initialStatus,
        req.user.id,
        finalAssignedTo || null,
        finalAssignedTo ? new Date().toISOString() : null,
        assignmentMethod,
      ]
    );

    const requestId = result.rows[0].id;

    // Record status history
    await query(
      `INSERT INTO status_history (request_id, user_id, from_status, to_status)
       VALUES ($1, $2, NULL, $3)`,
      [requestId, req.user.id, initialStatus]
    );

    // Update transporter status if assigned
    if (finalAssignedTo) {
      await query(
        `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [finalAssignedTo]
      );

      // Send SMS notification
      await sendJobAssignmentSMS(
        finalAssignedTo,
        requestId,
        origin_floor,
        room_number,
        priority
      );
    }

    // Log the creation
    const { ipAddress } = getAuditContext(req);
    await logCreate(req.user.id, 'transport_request', requestId, {
      origin_floor,
      room_number,
      priority,
      assigned_to: finalAssignedTo,
    }, ipAddress);

    let request = await getRequestWithRelations(requestId);

    // Handle auto-assign after creation if requested
    if (auto_assign && !finalAssignedTo) {
      const autoAssignResult = await autoAssignRequest(requestId);
      if (autoAssignResult.success) {
        request = await getRequestWithRelations(requestId);

        // Send SMS to auto-assigned transporter
        await sendJobAssignmentSMS(
          autoAssignResult.assignedTo!,
          requestId,
          origin_floor,
          room_number,
          priority
        );
      }
    }

    // Emit socket events
    const io = getIO();
    if (io) {
      io.emit('request_created', request);
      if (request?.assigned_to) {
        io.emit('request_assigned', request);
      }
    }

    res.status(201).json({ request, message: 'Transport request created' });
  } catch (error) {
    logger.error('Create request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { status, assigned_to, delay_reason } = req.body;

    const existing = await query('SELECT * FROM transport_requests WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const currentRequest = existing.rows[0];
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Handle status change
    if (status && status !== currentRequest.status) {
      const validTransitions: Record<RequestStatus, RequestStatus[]> = {
        pending: ['assigned', 'cancelled', 'transferred_to_pct'],
        assigned: ['accepted', 'pending', 'cancelled', 'transferred_to_pct'],
        accepted: ['en_route', 'assigned', 'cancelled', 'transferred_to_pct'],
        en_route: ['with_patient', 'cancelled', 'transferred_to_pct'],
        with_patient: ['complete', 'cancelled', 'transferred_to_pct'],
        complete: [],
        cancelled: [],
        transferred_to_pct: [],
      };

      if (!validTransitions[currentRequest.status as RequestStatus]?.includes(status)) {
        res.status(400).json({
          error: `Invalid status transition from ${currentRequest.status} to ${status}`,
        });
        return;
      }

      updates.push(`status = $${paramIndex++}`);
      params.push(status);

      // Set timestamp based on status
      const timestampFields: Record<string, string> = {
        assigned: 'assigned_at',
        accepted: 'accepted_at',
        en_route: 'en_route_at',
        with_patient: 'with_patient_at',
        complete: 'completed_at',
        cancelled: 'cancelled_at',
      };
      const timestampField = timestampFields[status];

      if (timestampField) {
        updates.push(`${timestampField} = $${paramIndex++}`);
        params.push(new Date().toISOString());
      }

      // Record status history
      await query(
        `INSERT INTO status_history (request_id, user_id, from_status, to_status)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user.id, currentRequest.status, status]
      );

      // Log the status change
      const { ipAddress } = getAuditContext(req);
      await logStatusChange(
        req.user.id,
        'transport_request',
        parseInt(id),
        currentRequest.status,
        status,
        ipAddress
      );

      // Update transporter status based on request status
      const transporterId = assigned_to || currentRequest.assigned_to;
      if (transporterId) {
        let transporterStatus = 'available';
        if (status === 'assigned') transporterStatus = 'assigned';
        else if (status === 'accepted') transporterStatus = 'accepted';
        else if (status === 'en_route') transporterStatus = 'en_route';
        else if (status === 'with_patient') transporterStatus = 'with_patient';

        await query(
          `UPDATE transporter_status SET status = $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [transporterStatus, transporterId]
        );

        const io = getIO();
        if (io) {
          const statusResult = await query(
            `SELECT ts.*, u.first_name, u.last_name, u.primary_floor
             FROM transporter_status ts
             JOIN users u ON ts.user_id = u.id
             WHERE ts.user_id = $1`,
            [transporterId]
          );
          if (statusResult.rows.length > 0) {
            io.emit('transporter_status_changed', {
              ...statusResult.rows[0],
              user: {
                id: transporterId,
                first_name: statusResult.rows[0].first_name,
                last_name: statusResult.rows[0].last_name,
                primary_floor: statusResult.rows[0].primary_floor,
              },
            });
          }
        }
      }
    }

    // Handle delay_reason update
    if (delay_reason !== undefined) {
      updates.push(`delay_reason = $${paramIndex++}`);
      params.push(delay_reason);
    }

    // Handle assignment change
    if (assigned_to !== undefined && assigned_to !== currentRequest.assigned_to) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(assigned_to || null);
      updates.push(`assignment_method = $${paramIndex++}`);
      params.push('manual');

      if (assigned_to && !currentRequest.assigned_to) {
        updates.push(`status = $${paramIndex++}`);
        params.push('assigned');
        updates.push(`assigned_at = $${paramIndex++}`);
        params.push(new Date().toISOString());

        await query(
          `INSERT INTO status_history (request_id, user_id, from_status, to_status)
           VALUES ($1, $2, $3, $4)`,
          [id, req.user.id, currentRequest.status, 'assigned']
        );

        // Update new transporter status
        await query(
          `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [assigned_to]
        );

        // Send SMS notification
        await sendJobAssignmentSMS(
          assigned_to,
          parseInt(id),
          currentRequest.origin_floor,
          currentRequest.room_number,
          currentRequest.priority
        );
      }

      // Reset old transporter status if reassigning
      if (currentRequest.assigned_to) {
        await query(
          `UPDATE transporter_status SET status = 'available', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [currentRequest.assigned_to]
        );
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid updates provided' });
      return;
    }

    params.push(id);
    await query(
      `UPDATE transport_requests SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    const updatedRequest = await getRequestWithRelations(parseInt(id));

    // Emit socket event
    const io = getIO();
    if (io) {
      if (status) {
        io.emit('request_status_changed', updatedRequest);
      }
      if (assigned_to !== undefined) {
        io.emit('request_assigned', updatedRequest);
      }
    }

    res.json({ request: updatedRequest, message: 'Request updated' });
  } catch (error) {
    logger.error('Update request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const cancelRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const existing = await query('SELECT * FROM transport_requests WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const currentRequest = existing.rows[0];

    if (['complete', 'cancelled'].includes(currentRequest.status)) {
      res.status(400).json({ error: 'Cannot cancel a completed or already cancelled request' });
      return;
    }

    await query(
      `UPDATE transport_requests
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await query(
      `INSERT INTO status_history (request_id, user_id, from_status, to_status)
       VALUES ($1, $2, $3, 'cancelled')`,
      [id, req.user.id, currentRequest.status]
    );

    // Reset transporter status if assigned
    if (currentRequest.assigned_to) {
      await query(
        `UPDATE transporter_status SET status = 'available', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [currentRequest.assigned_to]
      );
    }

    const cancelledRequest = await getRequestWithRelations(parseInt(id));

    const io = getIO();
    if (io) {
      io.emit('request_cancelled', cancelledRequest);
    }

    res.json({ request: cancelledRequest, message: 'Request cancelled' });
  } catch (error) {
    logger.error('Cancel request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const claimRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const existing = await query('SELECT * FROM transport_requests WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const currentRequest = existing.rows[0];

    if (currentRequest.status !== 'pending') {
      res.status(400).json({ error: 'Can only claim pending requests' });
      return;
    }

    // Check if transporter already has an active job
    const activeJob = await query(
      `SELECT id FROM transport_requests
       WHERE assigned_to = $1 AND status NOT IN ('complete', 'cancelled', 'pending')`,
      [req.user.id]
    );

    if (activeJob.rows.length > 0) {
      res.status(400).json({ error: 'You already have an active job' });
      return;
    }

    await query(
      `UPDATE transport_requests
       SET status = 'assigned', assigned_to = $1, assigned_at = CURRENT_TIMESTAMP,
           assignment_method = 'claim'
       WHERE id = $2`,
      [req.user.id, id]
    );

    await query(
      `INSERT INTO status_history (request_id, user_id, from_status, to_status)
       VALUES ($1, $2, 'pending', 'assigned')`,
      [id, req.user.id]
    );

    await query(
      `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [req.user.id]
    );

    const claimedRequest = await getRequestWithRelations(parseInt(id));

    const io = getIO();
    if (io) {
      io.emit('request_assigned', claimedRequest);
    }

    res.json({ request: claimedRequest, message: 'Request claimed' });
  } catch (error) {
    logger.error('Claim request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Auto-assign a pending request
export const autoAssign = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const result = await autoAssignRequest(parseInt(id));

    if (!result.success) {
      res.status(400).json({ error: result.reason });
      return;
    }

    const request = await getRequestWithRelations(parseInt(id));

    // Send SMS notification
    if (result.assignedTo && request) {
      await sendJobAssignmentSMS(
        result.assignedTo,
        parseInt(id),
        request.origin_floor,
        request.room_number,
        request.priority
      );
    }

    res.json({
      request,
      assigned_to: result.assignedTo,
      reason: result.reason,
      message: 'Request auto-assigned',
    });
  } catch (error) {
    logger.error('Auto-assign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Assign request to PCT (Patient Care Technician)
export const assignToPCT = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const existing = await query('SELECT * FROM transport_requests WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const currentRequest = existing.rows[0];

    if (['complete', 'cancelled', 'transferred_to_pct'].includes(currentRequest.status)) {
      res.status(400).json({ error: 'Cannot transfer this request to PCT' });
      return;
    }

    // Get PCT auto-close time from config
    const configResult = await query(
      `SELECT value FROM system_config WHERE key = 'pct_auto_close_minutes'`
    );
    const autoCloseMinutes = configResult.rows.length > 0
      ? parseInt(configResult.rows[0].value, 10)
      : 15;

    const autoCloseAt = new Date();
    autoCloseAt.setMinutes(autoCloseAt.getMinutes() + autoCloseMinutes);

    await query(
      `UPDATE transport_requests
       SET status = 'transferred_to_pct',
           pct_assigned_at = CURRENT_TIMESTAMP,
           pct_auto_close_at = $1,
           assigned_to = NULL
       WHERE id = $2`,
      [autoCloseAt.toISOString(), id]
    );

    await query(
      `INSERT INTO status_history (request_id, user_id, from_status, to_status)
       VALUES ($1, $2, $3, 'transferred_to_pct')`,
      [id, req.user.id, currentRequest.status]
    );

    // Reset transporter status if was assigned
    if (currentRequest.assigned_to) {
      await query(
        `UPDATE transporter_status SET status = 'available', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [currentRequest.assigned_to]
      );
    }

    const updatedRequest = await getRequestWithRelations(parseInt(id));

    const io = getIO();
    if (io) {
      io.emit('request_status_changed', updatedRequest);
    }

    res.json({ request: updatedRequest, message: 'Request transferred to PCT' });
  } catch (error) {
    logger.error('Assign to PCT error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
