import { Response } from 'express';
import { query } from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import { AuthenticatedRequest, UserRole } from '../types/index.js';

export const getAllUsers = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
       FROM users
       ORDER BY last_name, first_name`
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password, first_name, last_name, role } = req.body;

    if (!email || !password || !first_name || !last_name || !role) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const validRoles: UserRole[] = ['transporter', 'dispatcher', 'supervisor', 'manager'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
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
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, first_name, last_name, role]
    );

    const user = result.rows[0];

    // Create transporter status record if role is transporter
    if (role === 'transporter') {
      await query(
        'INSERT INTO transporter_status (user_id, status) VALUES ($1, $2)',
        [user.id, 'offline']
      );
    }

    res.status(201).json({ user, message: 'User created successfully' });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, first_name, last_name, role, is_active } = req.body;

    const existing = await query('SELECT * FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const currentUser = existing.rows[0];

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== currentUser.email) {
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), id]
      );

      if (emailCheck.rows.length > 0) {
        res.status(409).json({ error: 'Email already exists' });
        return;
      }
    }

    const result = await query(
      `UPDATE users
       SET email = COALESCE($1, email),
           first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           role = COALESCE($4, role),
           is_active = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at`,
      [
        email?.toLowerCase(),
        first_name,
        last_name,
        role,
        is_active,
        id,
      ]
    );

    // Handle transporter status record when role changes
    const newRole = role || currentUser.role;
    if (newRole === 'transporter' && currentUser.role !== 'transporter') {
      // Add transporter status
      await query(
        'INSERT INTO transporter_status (user_id, status) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [id, 'offline']
      );
    } else if (newRole !== 'transporter' && currentUser.role === 'transporter') {
      // Remove transporter status
      await query('DELETE FROM transporter_status WHERE user_id = $1', [id]);
    }

    res.json({ user: result.rows[0], message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
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
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
