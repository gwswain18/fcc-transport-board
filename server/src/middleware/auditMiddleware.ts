import { Request, Response, NextFunction } from 'express';
import { createAuditLog } from '../services/auditService.js';
import { AuthenticatedRequest } from '../types/index.js';
import logger from '../utils/logger.js';

// Get client IP address from request
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// Middleware to automatically log certain actions
export const auditMiddleware = (entityType: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json to capture response
    res.json = (body: unknown) => {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id;
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'];

        // Extract entity ID from params or response
        const entityId = req.params.id
          ? parseInt(req.params.id, 10)
          : (body as { id?: number })?.id;

        createAuditLog({
          userId,
          action,
          entityType,
          entityId,
          newValues: req.body,
          ipAddress,
          userAgent,
        }).catch((err) => logger.error('Audit middleware error:', err));
      }

      return originalJson(body);
    };

    next();
  };
};

// Helper to extract IP and user agent for manual audit calls
export const getAuditContext = (req: AuthenticatedRequest) => ({
  ipAddress: getClientIp(req),
  userAgent: req.headers['user-agent'],
  userId: req.user?.id,
});
