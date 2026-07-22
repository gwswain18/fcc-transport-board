import { Response } from 'express';
import { query } from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import { AuthenticatedRequest, UserRole, Floor } from '../types/index.js';
import { logCreate, logUpdate, logDelete } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import { isValidEmail, isValidPhoneNumber, validatePasswordStrength } from '../utils/validation.js';
import { getOnlineUsers, removeHeartbeat } from '../services/heartbeatService.js';
import { getIO, emitToUser, broadcastDispatcherChanged, broadcastSecretaryChanged } from '../socket/index.js';
import logger from '../utils/logger.js';

const validFloors: Floor[] = ['FCC1', 'FCC4', 'FCC5', 'FCC6', '1WC', 'HRP', 'L&D', 'OTF'];

export const getAllUsers = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active,
              primary_floor, phone_number, include_in_analytics, is_temp_account,
              auth_provider, approval_status,
              created_at, updated_at
       FROM users
       WHERE approval_status = 'approved'
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

    const validRoles: UserRole[] = ['transporter', 'secretary', 'dispatcher', 'supervisor', 'manager'];
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

    // Enforce the same password policy as reset/change (was missing here, so
    // admin-created accounts could get weak PHI-access passwords)
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.errors.join('. ') });
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

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const validation = validatePasswordStrength(password);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors.join('. ') });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passwordHash = await hashPassword(password);

    // password_changed_at invalidates the user's existing sessions
    await query(
      `UPDATE users
       SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP,
           failed_login_attempts = 0, lockout_until = NULL
       WHERE id = $2`,
      [passwordHash, id]
    );

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
              auth_provider, approval_status,
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

// Get pending users
export const getPendingUsers = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active,
              primary_floor, phone_number, auth_provider, approval_status,
              created_at, updated_at
       FROM users
       WHERE approval_status = 'pending'
       ORDER BY created_at ASC`
    );

    res.json({ users: result.rows });
  } catch (error) {
    logger.error('Get pending users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get count of pending users
export const getPendingCount = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM users WHERE approval_status = 'pending'`
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    logger.error('Get pending count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve a pending user
export const approveUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, primary_floor } = req.body;

    if (!role) {
      res.status(400).json({ error: 'Role is required for approval' });
      return;
    }

    const validRoles: UserRole[] = ['transporter', 'secretary', 'dispatcher', 'supervisor', 'manager'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    if (role === 'transporter' && !primary_floor) {
      res.status(400).json({ error: 'Primary floor is required for transporters' });
      return;
    }

    if (primary_floor && !validFloors.includes(primary_floor)) {
      res.status(400).json({ error: 'Invalid primary floor' });
      return;
    }

    const existing = await query(
      'SELECT id, approval_status FROM users WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (existing.rows[0].approval_status !== 'pending') {
      res.status(400).json({ error: 'User is not pending approval' });
      return;
    }

    const result = await query(
      `UPDATE users
       SET approval_status = 'approved', role = $1, primary_floor = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, first_name, last_name, role, is_active,
                 primary_floor, phone_number, auth_provider, approval_status,
                 created_at, updated_at`,
      [role, primary_floor || null, id]
    );

    // Create transporter status record if role is transporter
    if (role === 'transporter') {
      await query(
        'INSERT INTO transporter_status (user_id, status) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
        [id, 'offline']
      );
    }

    const { ipAddress } = getAuditContext(req);
    await logUpdate(
      req.user!.id,
      'user',
      parseInt(id as string),
      { approval_status: 'pending' },
      { approval_status: 'approved', role },
      ipAddress
    );

    res.json({ user: result.rows[0], message: 'User approved successfully' });
  } catch (error) {
    logger.error('Approve user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject a pending user
export const rejectUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT id, approval_status FROM users WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (existing.rows[0].approval_status !== 'pending') {
      res.status(400).json({ error: 'User is not pending approval' });
      return;
    }

    await query(
      `UPDATE users SET approval_status = 'rejected', is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    const { ipAddress } = getAuditContext(req);
    await logUpdate(
      req.user!.id,
      'user',
      parseInt(id as string),
      { approval_status: 'pending' },
      { approval_status: 'rejected', is_active: false },
      ipAddress
    );

    res.json({ message: 'User rejected' });
  } catch (error) {
    logger.error('Reject user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all currently active users: anyone with a fresh heartbeat (online) PLUS
// transporters with an open shift whose heartbeat lapsed or whose socket
// dropped (phone screen off) — they are still logged in and on shift, so they
// must not vanish from the list. is_online distinguishes the two.
export const getActiveUsers = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const onlineUserIds = await getOnlineUsers();

    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_temp_account,
              COALESCE(uh.created_at, sl.shift_start) as login_time,
              (u.id = ANY($1)) as is_online,
              a_s.session_first_name, a_s.session_last_name, a_s.phone_extension
       FROM users u
       LEFT JOIN user_heartbeats uh ON u.id = uh.user_id
       LEFT JOIN LATERAL (
         SELECT shift_start FROM shift_logs
         WHERE user_id = u.id AND shift_end IS NULL
         ORDER BY shift_start DESC LIMIT 1
       ) sl ON true
       LEFT JOIN active_secretaries a_s ON u.id = a_s.user_id AND a_s.ended_at IS NULL
       WHERE u.is_active = true
         AND (u.id = ANY($1) OR (u.role = 'transporter' AND sl.shift_start IS NOT NULL))
       ORDER BY u.role, u.last_name, u.first_name`,
      [onlineUserIds]
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      first_name: row.session_first_name || row.first_name,
      last_name: row.session_last_name || row.last_name,
      role: row.role,
      is_temp_account: row.is_temp_account,
      login_time: row.login_time,
      is_online: row.is_online,
      phone_extension: row.phone_extension,
    }));

    res.json({ users });
  } catch (error) {
    logger.error('Get active users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// End a user's session (manager action)
export const endUserSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    // Invalidate all outstanding JWTs immediately (durable revocation) and set
    // a lockout that outlasts the token lifetime as a second layer
    await query(
      `UPDATE users
       SET sessions_invalidated_at = NOW(),
           lockout_until = NOW() + INTERVAL '1 hour'
       WHERE id = $1`,
      [userId]
    );

    // Remove heartbeat
    await removeHeartbeat(userId);

    // End dispatcher session
    await query(
      `UPDATE active_dispatchers SET ended_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    // End secretary session
    await query(
      `UPDATE active_secretaries SET ended_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND ended_at IS NULL`,
      [userId]
    );

    // End transporter shift
    await query(
      `UPDATE shift_logs SET shift_end = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND shift_end IS NULL`,
      [userId]
    );

    // Set transporter status to offline
    await query(
      `UPDATE transporter_status SET status = 'offline', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    // Emit force_logout to the user via socket
    emitToUser(userId, 'force_logout', { message: 'Your session has been ended by a manager.' });

    // Broadcast updated dispatcher/secretary lists (role-filtered)
    await broadcastDispatcherChanged();
    await broadcastSecretaryChanged();

    res.json({ message: 'User session ended' });
  } catch (error) {
    logger.error('End user session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
