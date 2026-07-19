import { Request, Response } from 'express';
import { query } from '../config/database.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { generateToken, getTokenCsrf } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logLogin, logLogout, logPasswordChange, logPasswordReset } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import {
  sendPasswordResetEmail,
  sendUsernameRecoveryEmail,
  consumeResetToken,
} from '../services/emailService.js';
import { validatePasswordStrength } from '../utils/validation.js';
import { TOKEN_COOKIE_OPTIONS, TOKEN_COOKIE_MAX_AGE_MS } from '../utils/cookies.js';
import logger from '../utils/logger.js';
import { getIO, broadcastDispatcherChanged, broadcastSecretaryChanged, emitToUser } from '../socket/index.js';
import { removeHeartbeat } from '../services/heartbeatService.js';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
// A valid cost-12 bcrypt hash used only to equalize login timing when no real
// hash is available (missing/OAuth-only/deactivated account). Not a credential.
const DUMMY_BCRYPT_HASH = '$2b$12$xCLK5myhGNjdn76Rd6E7N.7HEUx4rQX2IsSsPJXt3D1MKPVTsmrs.';

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
              auth_provider, provider_id, approval_status, lockout_until,
              failed_login_attempts, created_at, updated_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];

    // Uniform timing: always run one bcrypt comparison so a missing /
    // OAuth-only / deactivated account takes the same ~time as a wrong
    // password, preventing account enumeration via response latency. Compare
    // against the real hash when usable, else a fixed dummy hash.
    const comparableHash = user?.password_hash || DUMMY_BCRYPT_HASH;
    const passwordMatches = await comparePassword(password, comparableHash);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check lockout so a locked account can't be probed (generic to callers
    // is preferable, but the countdown is a deliberate UX affordance for staff)
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const remainingMs = new Date(user.lockout_until).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      res.status(403).json({ error: `Account is temporarily locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.` });
      return;
    }

    // Generic message for deactivated and OAuth-only accounts to prevent
    // account enumeration
    if (!user.is_active || !user.password_hash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValidPassword = passwordMatches;

    if (!isValidPassword) {
      // Count the failure; lock the account after too many consecutive misses
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        await query(
          `UPDATE users
           SET failed_login_attempts = 0,
               lockout_until = CURRENT_TIMESTAMP + ($2 || ' minutes')::interval
           WHERE id = $1`,
          [user.id, LOCKOUT_MINUTES]
        );
        logger.warn(`Account ${user.id} locked after ${attempts} failed login attempts`);
      } else {
        await query('UPDATE users SET failed_login_attempts = $2 WHERE id = $1', [
          user.id,
          attempts,
        ]);
      }
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Successful login resets the failure counter
    if (user.failed_login_attempts > 0) {
      await query('UPDATE users SET failed_login_attempts = 0 WHERE id = $1', [user.id]);
    }

    const token = generateToken(user);

    // Log the login
    const { ipAddress, userAgent } = getAuditContext(req as AuthenticatedRequest);
    await logLogin(user.id, ipAddress, userAgent);

    // Set httpOnly cookie - sameSite: 'none' and partitioned required for cross-origin
    res.cookie('token', token, { ...TOKEN_COOKIE_OPTIONS, maxAge: TOKEN_COOKIE_MAX_AGE_MS });

    // Check if user has an active shift (for transporters)
    let activeShift = null;
    if (user.role === 'transporter' && user.approval_status === 'approved') {
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
      csrfToken: getTokenCsrf(token),
      isSecretary: user.role === 'secretary',
      isPending: user.approval_status === 'pending',
      message: user.approval_status === 'pending' ? 'Account pending approval' : 'Login successful',
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

      // End any active dispatcher session for this user
      await query(
        `UPDATE active_dispatchers
         SET ended_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND ended_at IS NULL`,
        [authReq.user.id]
      );

      // End any active secretary session for this user
      await query(
        `UPDATE active_secretaries
         SET ended_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND ended_at IS NULL`,
        [authReq.user.id]
      );

      // Broadcast dispatcher + secretary changes via socket (role-filtered)
      await broadcastDispatcherChanged();
      await broadcastSecretaryChanged();

      // Remove heartbeat so user disappears from active users
      await removeHeartbeat(authReq.user.id);
    }

    res.clearCookie('token', TOKEN_COOKIE_OPTIONS);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.clearCookie('token', TOKEN_COOKIE_OPTIONS);
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
              auth_provider, approval_status,
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

    // Check secretary session
    let secretarySession = null;
    let needsSecretarySession = false;
    if (result.rows[0].role === 'secretary') {
      const sessionResult = await query(
        `SELECT session_first_name, session_last_name, phone_extension
         FROM active_secretaries
         WHERE user_id = $1 AND ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
        [req.user.id]
      );
      if (sessionResult.rows.length > 0) {
        secretarySession = sessionResult.rows[0];
      } else {
        needsSecretarySession = true;
      }
    }

    // Echo the CSRF token bound to the current session so the SPA can attach
    // it after a page reload (it can't read the httpOnly auth cookie).
    // Pre-CSRF tokens lack the claim — transparently upgrade them so existing
    // sessions keep working across this deploy without a forced re-login.
    let csrfToken: string | undefined;
    try {
      csrfToken = req.cookies?.token ? getTokenCsrf(req.cookies.token) : undefined;
    } catch {
      csrfToken = undefined;
    }
    if (!csrfToken) {
      const freshToken = generateToken(result.rows[0]);
      res.cookie('token', freshToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: TOKEN_COOKIE_MAX_AGE_MS });
      csrfToken = getTokenCsrf(freshToken);
    }

    res.json({ user: result.rows[0], activeShift, secretarySession, needsSecretarySession, csrfToken });
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
      'SELECT password_hash, auth_provider FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult.rows[0].password_hash) {
      res.status(400).json({ error: 'OAuth users cannot change password. Use your OAuth provider instead.' });
      return;
    }

    const isValidPassword = await comparePassword(
      current_password,
      userResult.rows[0].password_hash
    );

    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash and update password; stamping password_changed_at evicts any other
    // sessions holding tokens issued before the change
    const newHash = await hashPassword(new_password);
    await query(
      'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.user.id]
    );

    // Re-issue this session's token so the current user stays logged in
    const freshToken = generateToken(req.user);
    res.cookie('token', freshToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: TOKEN_COOKIE_MAX_AGE_MS });

    // Log the change
    const { ipAddress } = getAuditContext(req);
    await logPasswordChange(req.user.id, ipAddress);

    // Return the new CSRF token (the re-issued JWT has a fresh csrf claim)
    res.json({ message: 'Password changed successfully', csrfToken: getTokenCsrf(freshToken) });
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

    // Atomically consume the token (prevents double-use)
    const tokenResult = await consumeResetToken(token);
    if (!tokenResult.valid) {
      res.status(400).json({ error: tokenResult.error });
      return;
    }

    // Hash and update password; stamping password_changed_at invalidates
    // JWTs issued before the reset, and the lockout counters are cleared
    const newHash = await hashPassword(new_password);
    await query(
      `UPDATE users
       SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP,
           failed_login_attempts = 0, lockout_until = NULL
       WHERE id = $2`,
      [newHash, tokenResult.userId]
    );

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

// Register secretary session (per-session identity)
export const registerSecretarySession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.user.role !== 'secretary') {
      res.status(403).json({ error: 'Only secretary accounts can register a session' });
      return;
    }

    const { first_name, last_name, phone_extension } = req.body;

    if (!first_name || !last_name) {
      res.status(400).json({ error: 'First name and last name are required' });
      return;
    }

    // End any prior active session for this user
    await query(
      `UPDATE active_secretaries SET ended_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND ended_at IS NULL`,
      [req.user.id]
    );

    // Insert new session
    await query(
      `INSERT INTO active_secretaries (user_id, session_first_name, session_last_name, phone_extension)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, first_name, last_name, phone_extension || null]
    );

    // Broadcast secretary change via socket (role-filtered)
    await broadcastSecretaryChanged();

    res.json({ message: 'Secretary session registered' });
  } catch (error) {
    logger.error('Register secretary session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Force end a secretary's session (primary dispatcher / supervisor / manager)
export const endSecretarySession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestingUser = req.user!;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Authorization: dispatchers must be the primary dispatcher
    if (requestingUser.role === 'dispatcher') {
      const primaryCheck = await query(
        `SELECT id FROM active_dispatchers
         WHERE user_id = $1 AND is_primary = true AND ended_at IS NULL`,
        [requestingUser.id]
      );
      if (primaryCheck.rows.length === 0) {
        res.status(403).json({ error: 'Only the primary dispatcher can log out secretaries' });
        return;
      }
    }
    // supervisors and managers are always allowed (canDispatch middleware already checked role)

    const result = await query(
      `UPDATE active_secretaries SET ended_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND ended_at IS NULL
       RETURNING id`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'No active secretary session found for this user' });
      return;
    }

    // If the secretary is connected, send them back to the login screen
    emitToUser(targetUserId, 'force_logout', { message: 'Your session has been ended.' });

    await broadcastSecretaryChanged();

    res.json({ message: 'Secretary session ended' });
  } catch (error) {
    logger.error('End secretary session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get active secretaries
export const getActiveSecretaries = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT a_s.*, u.email
       FROM active_secretaries a_s
       JOIN users u ON a_s.user_id = u.id
       WHERE a_s.ended_at IS NULL
       ORDER BY a_s.started_at ASC`
    );

    res.json({ secretaries: result.rows });
  } catch (error) {
    logger.error('Get active secretaries error:', error);
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
