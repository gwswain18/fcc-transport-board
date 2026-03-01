import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { query } from '../config/database.js';
import { AuthenticatedRequest, User } from '../types/index.js';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = verifyToken(token);

    const result = await query(
      'SELECT id, email, first_name, last_name, role, is_active, auth_provider, approval_status, lockout_until, created_at, updated_at FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const user: User = result.rows[0];

    if (!user.is_active) {
      res.status(401).json({ error: 'Account is deactivated' });
      return;
    }

    if ((user as any).lockout_until && new Date((user as any).lockout_until) > new Date()) {
      res.status(403).json({ error: 'Account is temporarily locked' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireApproved = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.approval_status !== 'approved') {
    res.status(403).json({ error: 'Account pending approval' });
    return;
  }

  next();
};
