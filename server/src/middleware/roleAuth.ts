import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types/index.js';

// Role hierarchy: manager > supervisor > dispatcher > transporter
const roleHierarchy: Record<UserRole, number> = {
  transporter: 1,
  dispatcher: 2,
  supervisor: 3,
  manager: 4,
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireMinimumRole = (minimumRole: UserRole) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userLevel = roleHierarchy[req.user.role];
    const requiredLevel = roleHierarchy[minimumRole];

    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// Check if user can perform transporter actions (all roles can)
export const canActAsTransporter = requireMinimumRole('transporter');

// Check if user can dispatch (dispatcher and above)
export const canDispatch = requireMinimumRole('dispatcher');

// Check if user can view reports (supervisor and above)
export const canViewReports = requireMinimumRole('supervisor');

// Check if user can manage users (manager only)
export const canManageUsers = requireRole('manager');
