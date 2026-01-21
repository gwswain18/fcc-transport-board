import { Request, Response } from 'express';
import { query } from '../config/database.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logLogin, logLogout, logPasswordChange, logPasswordReset } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import {
  sendPasswordResetEmail,
  sendUsernameRecoveryEmail,
  verifyResetToken,
  markTokenUsed,
} from '../services/emailService.js';
import { validatePasswordStrength } from '../utils/validation.js';
import logger from '../utils/logger.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active,
              primary_floor, phone_number, include_in_analytics, is_temp_account,
              created_at, updated_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(401).json({ error: 'Account is deactivated' });
      return;
    }

    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user);

    // Log the login
    const { ipAddress, userAgent } = getAuditContext(req as AuthenticatedRequest);
    await logLogin(user.id, ipAddress, userAgent);

    // Set httpOnly cookie - sameSite: 'none' and partitioned required for cross-origin
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    });

    // Check if user has an active shift (for transporters)
    let activeShift = null;
    if (user.role === 'transporter') {
      const shiftResult = await query(
        'SELECT * FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL',
        [user.id]
      );
      activeShift = shiftResult.rows[0] || null;
    }

    // Return user without password
    const { password_hash: _, ...safeUser } = user;
    res.json({
      user: safeUser,
      activeShift,
      message: 'Login successful',
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user) {
      const { ipAddress, userAgent } = getAuditContext(authReq);
      await logLogout(authReq.user.id, ipAddress, userAgent);
    }

    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  }
};

export const me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get fresh user data including new fields
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active,
              primary_floor, phone_number, include_in_analytics, is_temp_account,
              created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check active shift for transporters
    let activeShift = null;
    if (result.rows[0].role === 'transporter') {
      const shiftResult = await query(
        'SELECT * FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL',
        [req.user.id]
      );
      activeShift = shiftResult.rows[0] || null;
    }

    res.json({ user: result.rows[0], activeShift });
  } catch (error) {
    logger.error('Me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Change own password
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      res.status(400).json({ error: 'Current and new password are required' });
      return;
    }

    // Validate new password strength
    const validation = validatePasswordStrength(new_password);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors.join('. ') });
      return;
    }

    // Verify current password
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const isValidPassword = await comparePassword(
      current_password,
      userResult.rows[0].password_hash
    );

    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash and update password
    const newHash = await hashPassword(new_password);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newHash,
      req.user.id,
    ]);

    // Log the change
    const { ipAddress } = getAuditContext(req);
    await logPasswordChange(req.user.id, ipAddress);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Request password reset
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Find user by email
    const result = await query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);

    if (result.rows.length > 0) {
      // Send reset email (don't reveal if user exists)
      await sendPasswordResetEmail(result.rows[0].id);
    }

    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists with that email, a reset link has been sent' });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset password with token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { new_password } = req.body;

    if (!token || !new_password) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    // Validate password strength
    const validation = validatePasswordStrength(new_password);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors.join('. ') });
      return;
    }

    // Verify token
    const tokenResult = await verifyResetToken(token);
    if (!tokenResult.valid) {
      res.status(400).json({ error: tokenResult.error });
      return;
    }

    // Hash and update password
    const newHash = await hashPassword(new_password);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      newHash,
      tokenResult.userId,
    ]);

    // Mark token as used
    await markTokenUsed(token);

    // Log the reset
    await logPasswordReset(tokenResult.userId!);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Recover username
export const recoverUsername = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    await sendUsernameRecoveryEmail(email.toLowerCase());

    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists with that email, your username has been sent' });
  } catch (error) {
    logger.error('Recover username error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Heartbeat endpoint
export const heartbeat = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Import dynamically to avoid circular dependencies
    const { recordHeartbeat } = await import('../services/heartbeatService.js');
    await recordHeartbeat(req.user.id);

    res.json({ message: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
