import { Response } from 'express';
import { query } from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import { AuthenticatedRequest, UserRole, Floor } from '../types/index.js';
import { logCreate, logUpdate, logDelete } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import { isValidEmail, isValidPhoneNumber } from '../utils/validation.js';
import logger from '../utils/logger.js';

const validFloors: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6'];

export const getAllUsers = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active,
              primary_floor, phone_number, include_in_analytics, is_temp_account,
              created_at, updated_at
       FROM users
       ORDER BY last_name, first_name`
    );

    res.json({ users: result.rows });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      role,
      primary_floor,
      phone_number,
      include_in_analytics = true,
    } = req.body;

    if (!email || !password || !first_name || !last_name || !role) {
      res.status(400).json({ error: 'Email, password, first name, last name, and role are required' });
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const validRoles: UserRole[] = ['transporter', 'dispatcher', 'supervisor', 'manager'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    // Validate primary_floor if provided
    if (primary_floor && !validFloors.includes(primary_floor)) {
      res.status(400).json({ error: 'Invalid primary floor' });
      return;
    }

    // primary_floor is required for transporters
    if (role === 'transporter' && !primary_floor) {
      res.status(400).json({ error: 'Primary floor is required for transporters' });
      return;
    }

    // Validate phone number if provided
    if (phone_number && !isValidPhoneNumber(phone_number)) {
      res.status(400).json({ error: 'Invalid phone number format' });
      return;
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role,
                          primary_floor, phone_number, include_in_analytics)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, first_name, last_name, role, is_active,
                 primary_floor, phone_number, include_in_analytics, is_temp_account,
                 created_at, updated_at`,
      [
        email.toLowerCase(),
        passwordHash,
        first_name,
        last_name,
        role,
        primary_floor || null,
        phone_number || null,
        include_in_analytics,
      ]
    );

    const user = result.rows[0];

    // Create transporter status record if role is transporter
    if (role === 'transporter') {
      await query(
        'INSERT INTO transporter_status (user_id, status) VALUES ($1, $2)',
        [user.id, 'offline']
      );
    }

    // Log the creation
    const { ipAddress } = getAuditContext(req);
    await logCreate(req.user!.id, 'user', user.id, {
      email: user.email,
      role: user.role,
      primary_floor: user.primary_floor,
    }, ipAddress);

    res.status(201).json({ user, message: 'User created successfully' });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      email,
      first_name,
      last_name,
      role,
      is_active,
      primary_floor,
      phone_number,
      include_in_analytics,
    } = req.body;

    const existing = await query('SELECT * FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const currentUser = existing.rows[0];

    // Validate email if being changed
    if (email && email.toLowerCase() !== currentUser.email) {
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), id]
      );

      if (emailCheck.rows.length > 0) {
        res.status(409).json({ error: 'Email already exists' });
        return;
      }
    }

    // Validate primary_floor if provided
    if (primary_floor !== undefined && primary_floor !== null && !validFloors.includes(primary_floor)) {
      res.status(400).json({ error: 'Invalid primary floor' });
      return;
    }

    // Validate phone number if provided
    if (phone_number && !isValidPhoneNumber(phone_number)) {
      res.status(400).json({ error: 'Invalid phone number format' });
      return;
    }

    // primary_floor required for transporters
    const newRole = role || currentUser.role;
    const newPrimaryFloor = primary_floor !== undefined ? primary_floor : currentUser.primary_floor;
    if (newRole === 'transporter' && !newPrimaryFloor) {
      res.status(400).json({ error: 'Primary floor is required for transporters' });
      return;
    }

    const result = await query(
      `UPDATE users
       SET email = COALESCE($1, email),
           first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           role = COALESCE($4, role),
           is_active = COALESCE($5, is_active),
           primary_floor = COALESCE($6, primary_floor),
           phone_number = COALESCE($7, phone_number),
           include_in_analytics = COALESCE($8, include_in_analytics)
       WHERE id = $9
       RETURNING id, email, first_name, last_name, role, is_active,
                 primary_floor, phone_number, include_in_analytics, is_temp_account,
                 created_at, updated_at`,
      [
        email?.toLowerCase(),
        first_name,
        last_name,
        role,
        is_active,
        primary_floor,
        phone_number,
        include_in_analytics,
        id,
      ]
    );

    // Handle transporter status record when role changes
    if (newRole === 'transporter' && currentUser.role !== 'transporter') {
      await query(
        'INSERT INTO transporter_status (user_id, status) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [id, 'offline']
      );
    } else if (newRole !== 'transporter' && currentUser.role === 'transporter') {
      await query('DELETE FROM transporter_status WHERE user_id = $1', [id]);
    }

    // Log the update
    const { ipAddress } = getAuditContext(req);
    await logUpdate(
      req.user!.id,
      'user',
      parseInt(id),
      { email: currentUser.email, role: currentUser.role, primary_floor: currentUser.primary_floor },
      { email: result.rows[0].email, role: result.rows[0].role, primary_floor: result.rows[0].primary_floor },
      ipAddress
    );

    res.json({ user: result.rows[0], message: 'User updated successfully' });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passwordHash = await hashPassword(password);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      id,
    ]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get transporters only (for assignment)
export const getTransporters = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.primary_floor, u.phone_number,
              ts.status, ts.updated_at as status_updated_at
       FROM users u
       LEFT JOIN transporter_status ts ON u.id = ts.user_id
       WHERE u.role = 'transporter' AND u.is_active = true
       ORDER BY u.last_name, u.first_name`
    );

    res.json({ transporters: result.rows });
  } catch (error) {
    logger.error('Get transporters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete user (soft or hard)
export const deleteUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const permanent = req.query.permanent === 'true';
    const userId = parseInt(id);

    // Prevent self-deletion
    if (userId === req.user.id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const existing = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetUser = existing.rows[0];
    const { ipAddress } = getAuditContext(req);

    if (permanent) {
      // Hard delete
      await query('DELETE FROM users WHERE id = $1', [userId]);
      await logDelete(req.user.id, 'user', userId, {
        email: targetUser.email,
        role: targetUser.role,
        type: 'permanent',
      }, ipAddress);
      res.json({ message: 'User permanently deleted' });
    } else {
      // Soft delete (deactivate)
      await query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
      await logDelete(req.user.id, 'user', userId, {
        email: targetUser.email,
        role: targetUser.role,
        type: 'deactivated',
      }, ipAddress);
      res.json({ message: 'User deactivated' });
    }
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user by ID
export const getUserById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active,
              primary_floor, phone_number, include_in_analytics, is_temp_account,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
