import { Response } from 'express';
import { query } from '../config/database.js';
import {
  AuthenticatedRequest,
  RequestStatus,
  Floor,
  Priority,
  SpecialNeed,
} from '../types/index.js';
import { getIO } from '../socket/index.js';

const validFloors: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];
const validPriorities: Priority[] = ['routine', 'stat'];
const validSpecialNeeds: SpecialNeed[] = ['wheelchair', 'o2', 'iv_pump', 'other'];

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
              assignee.last_name as assignee_last_name
       FROM transport_requests tr
       LEFT JOIN users creator ON tr.created_by = creator.id
       LEFT JOIN users assignee ON tr.assigned_to = assignee.id
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
    }));

    res.json({ requests });
  } catch (error) {
    console.error('Get requests error:', error);
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
      patient_initials,
      destination = 'Atrium',
      priority = 'routine',
      special_needs = [],
      special_needs_notes,
      notes,
      assigned_to,
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

    if (patient_initials && patient_initials.length > 3) {
      res.status(400).json({ error: 'Patient initials must be 3 characters or less' });
      return;
    }

    // Validate special needs
    for (const need of special_needs) {
      if (!validSpecialNeeds.includes(need)) {
        res.status(400).json({ error: `Invalid special need: ${need}` });
        return;
      }
    }

    const initialStatus: RequestStatus = assigned_to ? 'assigned' : 'pending';

    const result = await query(
      `INSERT INTO transport_requests
       (origin_floor, room_number, patient_initials, destination, priority,
        special_needs, special_needs_notes, notes, status, created_by,
        assigned_to, assigned_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        origin_floor,
        room_number,
        patient_initials || null,
        destination,
        priority,
        JSON.stringify(special_needs),
        special_needs_notes || null,
        notes || null,
        initialStatus,
        req.user.id,
        assigned_to || null,
        assigned_to ? new Date().toISOString() : null,
      ]
    );

    // Record status history
    await query(
      `INSERT INTO status_history (request_id, user_id, from_status, to_status)
       VALUES ($1, $2, NULL, $3)`,
      [result.rows[0].id, req.user.id, initialStatus]
    );

    // Update transporter status if assigned
    if (assigned_to) {
      await query(
        `UPDATE transporter_status SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [assigned_to]
      );
    }

    const request = await getRequestWithRelations(result.rows[0].id);

    // Emit socket events
    const io = getIO();
    if (io) {
      io.emit('request_created', request);
      if (assigned_to) {
        io.emit('request_assigned', request);
      }
    }

    res.status(201).json({ request, message: 'Transport request created' });
  } catch (error) {
    console.error('Create request error:', error);
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
    const { status, assigned_to } = req.body;

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
        pending: ['assigned', 'cancelled'],
        assigned: ['accepted', 'pending', 'cancelled'],
        accepted: ['en_route', 'assigned', 'cancelled'],
        en_route: ['with_patient', 'cancelled'],
        with_patient: ['complete', 'cancelled'],
        complete: [],
        cancelled: [],
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
            `SELECT ts.*, u.first_name, u.last_name
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
              },
            });
          }
        }
      }
    }

    // Handle assignment change
    if (assigned_to !== undefined && assigned_to !== currentRequest.assigned_to) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(assigned_to || null);

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
    console.error('Update request error:', error);
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
    console.error('Cancel request error:', error);
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
       SET status = 'assigned', assigned_to = $1, assigned_at = CURRENT_TIMESTAMP
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
    console.error('Claim request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
