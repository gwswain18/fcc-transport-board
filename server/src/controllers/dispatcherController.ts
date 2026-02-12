import { Request, Response } from 'express';
import { query } from '../config/database.js';
import { getIO } from '../socket/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import logger from '../utils/logger.js';

// Helper to transform flat dispatcher rows to nested structure
const transformDispatcherRows = (rows: any[]) => {
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    is_primary: row.is_primary,
    on_break: row.on_break,
    break_start: row.break_start,
    replaced_by: row.replaced_by,
    relief_info: row.relief_info,
    contact_info: row.contact_info,
    started_at: row.started_at,
    ended_at: row.ended_at,
    user: {
      id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone_number: row.phone_number,
    },
  }));
};

// Get active dispatchers
export const getActiveDispatchers = async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT ad.*, u.first_name, u.last_name, u.email, u.phone_number
       FROM active_dispatchers ad
       JOIN users u ON ad.user_id = u.id
       WHERE ad.ended_at IS NULL
       ORDER BY ad.is_primary DESC, ad.started_at ASC`
    );

    const dispatchers = transformDispatcherRows(result.rows);
    res.json({ dispatchers });
  } catch (error) {
    logger.error('Get active dispatchers error:', error);
    res.status(500).json({ error: 'Failed to get active dispatchers' });
  }
};

// Set self as primary dispatcher
export const setPrimaryDispatcher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { contact_info } = req.body;

    // Demote any existing primary dispatcher to assistant (don't end their session)
    await query(
      `UPDATE active_dispatchers SET is_primary = false, replaced_by = $1
       WHERE is_primary = true AND ended_at IS NULL AND user_id != $1`,
      [userId]
    );

    // Check if this user already has an active non-primary role
    const existingResult = await query(
      `SELECT id FROM active_dispatchers
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      // Update to primary
      await query(
        `UPDATE active_dispatchers
         SET is_primary = true, contact_info = COALESCE($2, contact_info)
         WHERE id = $1`,
        [existingResult.rows[0].id, contact_info]
      );
    } else {
      // Create new primary role
      await query(
        `INSERT INTO active_dispatchers (user_id, is_primary, contact_info)
         VALUES ($1, true, $2)`,
        [userId, contact_info || null]
      );
    }

    // Emit dispatcher change event
    await emitDispatcherChange();

    res.json({ message: 'Set as primary dispatcher' });
  } catch (error) {
    logger.error('Set primary dispatcher error:', error);
    res.status(500).json({ error: 'Failed to set primary dispatcher' });
  }
};

// Register as assistant dispatcher
export const registerAsDispatcher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { contact_info } = req.body;

    // Check if already registered
    const existingResult = await query(
      `SELECT id FROM active_dispatchers
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already registered as dispatcher' });
    }

    // Create assistant dispatcher role
    await query(
      `INSERT INTO active_dispatchers (user_id, is_primary, contact_info)
       VALUES ($1, false, $2)`,
      [userId, contact_info || null]
    );

    await emitDispatcherChange();

    res.json({ message: 'Registered as assistant dispatcher' });
  } catch (error) {
    logger.error('Register as dispatcher error:', error);
    res.status(500).json({ error: 'Failed to register as dispatcher' });
  }
};

// Go on break (with replacement selection or free text)
export const takeBreak = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { replacement_user_id, relief_info } = req.body;

    // Find current dispatcher role
    const currentResult = await query(
      `SELECT * FROM active_dispatchers
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(400).json({ error: 'Not currently an active dispatcher' });
    }

    const wasPrimary = currentResult.rows[0].is_primary;

    // Mark as on break (don't end the session)
    await query(
      `UPDATE active_dispatchers
       SET on_break = true, break_start = CURRENT_TIMESTAMP, replaced_by = $2, relief_info = $3
       WHERE id = $1`,
      [currentResult.rows[0].id, replacement_user_id || null, relief_info || null]
    );

    // If was primary, ensure someone takes over the primary role
    if (wasPrimary) {
      if (replacement_user_id) {
        // Validate replacement is an active user with dispatcher/supervisor/manager role
        const validUser = await query(
          `SELECT id FROM users
           WHERE id = $1 AND is_active = true AND role IN ('dispatcher', 'supervisor', 'manager')`,
          [replacement_user_id]
        );
        if (validUser.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid replacement user' });
        }

        // Check if replacement is already a dispatcher
        const replacementResult = await query(
          `SELECT id FROM active_dispatchers
           WHERE user_id = $1 AND ended_at IS NULL`,
          [replacement_user_id]
        );

        if (replacementResult.rows.length > 0) {
          await query(
            `UPDATE active_dispatchers SET is_primary = true WHERE id = $1`,
            [replacementResult.rows[0].id]
          );
        } else {
          await query(
            `INSERT INTO active_dispatchers (user_id, is_primary)
             VALUES ($1, true)`,
            [replacement_user_id]
          );
        }
      } else {
        // No replacement specified — auto-promote the oldest active non-break assistant
        await query(
          `UPDATE active_dispatchers SET is_primary = true
           WHERE id = (
             SELECT id FROM active_dispatchers
             WHERE ended_at IS NULL AND on_break = false AND is_primary = false
             ORDER BY started_at ASC
             LIMIT 1
           )`
        );
      }
    }

    await emitDispatcherChange();

    res.json({ message: 'On break' });
  } catch (error) {
    logger.error('Take break error:', error);
    res.status(500).json({ error: 'Failed to take break' });
  }
};

// Return from break
export const returnFromBreak = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { as_primary } = req.body;

    // Check if user has an existing session (on break)
    const existingResult = await query(
      `SELECT id, on_break FROM active_dispatchers
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.on_break) {
        // Clear break status and optionally set as primary
        if (as_primary) {
          // End current primary's role
          await query(
            `UPDATE active_dispatchers SET is_primary = false
             WHERE is_primary = true AND ended_at IS NULL AND user_id != $1`,
            [userId]
          );
        }

        await query(
          `UPDATE active_dispatchers
           SET on_break = false, break_start = NULL, relief_info = NULL, replaced_by = NULL, is_primary = $2
           WHERE id = $1`,
          [existing.id, as_primary || false]
        );

        await emitDispatcherChange();
        return res.json({ message: 'Returned from break' });
      }
      return res.status(400).json({ error: 'Already an active dispatcher' });
    }

    // No existing session - create new one
    if (as_primary) {
      // End current primary
      await query(
        `UPDATE active_dispatchers SET is_primary = false
         WHERE is_primary = true AND ended_at IS NULL`
      );
    }

    // Create new dispatcher role
    await query(
      `INSERT INTO active_dispatchers (user_id, is_primary)
       VALUES ($1, $2)`,
      [userId, as_primary || false]
    );

    await emitDispatcherChange();

    res.json({ message: 'Returned from break' });
  } catch (error) {
    logger.error('Return from break error:', error);
    res.status(500).json({ error: 'Failed to return from break' });
  }
};

// End dispatcher session
export const endDispatcherSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check if departing dispatcher is the primary
    const departingResult = await query(
      `SELECT id, is_primary FROM active_dispatchers
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    const wasPrimary = departingResult.rows.length > 0 && departingResult.rows[0].is_primary;

    await query(
      `UPDATE active_dispatchers SET ended_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    // If was primary, auto-promote the oldest active non-break assistant
    if (wasPrimary) {
      await query(
        `UPDATE active_dispatchers SET is_primary = true
         WHERE id = (
           SELECT id FROM active_dispatchers
           WHERE ended_at IS NULL AND on_break = false AND is_primary = false
           ORDER BY started_at ASC
           LIMIT 1
         )`
      );
    }

    await emitDispatcherChange();

    res.json({ message: 'Dispatcher session ended' });
  } catch (error) {
    logger.error('End dispatcher session error:', error);
    res.status(500).json({ error: 'Failed to end dispatcher session' });
  }
};

// Helper to emit dispatcher change event
const emitDispatcherChange = async () => {
  const io = getIO();
  if (!io) return;

  const result = await query(
    `SELECT ad.*, u.first_name, u.last_name, u.email, u.phone_number
     FROM active_dispatchers ad
     JOIN users u ON ad.user_id = u.id
     WHERE ad.ended_at IS NULL
     ORDER BY ad.is_primary DESC, ad.started_at ASC`
  );

  const dispatchers = transformDispatcherRows(result.rows);
  io.emit('dispatcher_changed', { dispatchers });
};

// Get available dispatchers (for replacement selection)
export const getAvailableDispatchers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number,
              ad.id as dispatcher_id, ad.is_primary,
              COALESCE(ad.on_break, false) as on_break
       FROM users u
       LEFT JOIN active_dispatchers ad ON u.id = ad.user_id AND ad.ended_at IS NULL
       WHERE u.role IN ('dispatcher', 'supervisor', 'manager')
         AND u.is_active = true
         AND u.id != $1
       ORDER BY u.first_name, u.last_name`,
      [currentUserId]
    );

    res.json({ dispatchers: result.rows });
  } catch (error) {
    logger.error('Get available dispatchers error:', error);
    res.status(500).json({ error: 'Failed to get available dispatchers' });
  }
};
