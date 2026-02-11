import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { acknowledgeDelay } from '../services/cycleTimeService.js';
import { getIO } from '../socket/index.js';
import logger from '../utils/logger.js';

export const addDelays = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { reasons, custom_note, phase } = req.body;

    if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
      res.status(400).json({ error: 'At least one delay reason is required' });
      return;
    }

    // Verify request exists
    const requestResult = await query(
      'SELECT id FROM transport_requests WHERE id = $1',
      [id]
    );
    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    // Insert each delay reason
    const inserted = [];
    for (const reason of reasons) {
      const result = await query(
        `INSERT INTO request_delays (request_id, user_id, reason, custom_note, phase)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, req.user.id, reason, custom_note || null, phase || null]
      );
      inserted.push(result.rows[0]);
    }

    // Also update the legacy delay_reason field on transport_requests for backwards compatibility
    const combinedReason = custom_note
      ? `${reasons.join(', ')}; ${custom_note}`
      : reasons.join(', ');
    await query(
      'UPDATE transport_requests SET delay_reason = $1 WHERE id = $2',
      [combinedReason, id]
    );

    // Acknowledge the delay for cycle time alert suppression
    const requestId = parseInt(id, 10);
    if (phase) {
      acknowledgeDelay(requestId, phase);
    }

    // Emit delay_note_added so clients can clear the cycle time alert
    const io = getIO();
    if (io) {
      io.emit('delay_note_added', { request_id: requestId, phase });
    }

    res.status(201).json({ delays: inserted, message: 'Delays recorded' });
  } catch (error) {
    logger.error('Add delays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDelays = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT rd.*, u.first_name, u.last_name
       FROM request_delays rd
       LEFT JOIN users u ON rd.user_id = u.id
       WHERE rd.request_id = $1
       ORDER BY rd.created_at ASC`,
      [id]
    );

    res.json({ delays: result.rows });
  } catch (error) {
    logger.error('Get delays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserDelays = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT reason, COUNT(*) as count
       FROM request_delays
       WHERE user_id = $1
       GROUP BY reason
       ORDER BY count DESC`,
      [id]
    );

    res.json({ delays: result.rows });
  } catch (error) {
    logger.error('Get user delays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
