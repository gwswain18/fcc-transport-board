import { query } from '../config/database.js';
import logger from '../utils/logger.js';

// Define AuditAction locally to avoid shared types import issues
type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'password_change'
  | 'password_reset'
  | 'shift_start'
  | 'shift_end'
  | 'override';

interface AuditLogEntry {
  userId?: number;
  action: AuditAction | string;
  entityType: string;
  entityId?: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.userId || null,
        entry.action,
        entry.entityType,
        entry.entityId || null,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
      ]
    );
  } catch (error) {
    logger.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
};

export const logLogin = async (
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'login',
    entityType: 'session',
    ipAddress,
    userAgent,
  });
};

export const logLogout = async (
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'logout',
    entityType: 'session',
    ipAddress,
    userAgent,
  });
};

export const logStatusChange = async (
  userId: number,
  entityType: string,
  entityId: number,
  oldStatus: string,
  newStatus: string,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'status_change',
    entityType,
    entityId,
    oldValues: { status: oldStatus },
    newValues: { status: newStatus },
    ipAddress,
  });
};

export const logCreate = async (
  userId: number,
  entityType: string,
  entityId: number,
  values: Record<string, unknown>,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'create',
    entityType,
    entityId,
    newValues: values,
    ipAddress,
  });
};

export const logUpdate = async (
  userId: number,
  entityType: string,
  entityId: number,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'update',
    entityType,
    entityId,
    oldValues,
    newValues,
    ipAddress,
  });
};

export const logDelete = async (
  userId: number,
  entityType: string,
  entityId: number,
  oldValues: Record<string, unknown>,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'delete',
    entityType,
    entityId,
    oldValues,
    ipAddress,
  });
};

export const logPasswordChange = async (
  userId: number,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'password_change',
    entityType: 'user',
    entityId: userId,
    ipAddress,
  });
};

export const logPasswordReset = async (
  userId: number,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'password_reset',
    entityType: 'user',
    entityId: userId,
    ipAddress,
  });
};

export const logShiftStart = async (
  userId: number,
  shiftId: number,
  details: Record<string, unknown>,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'shift_start',
    entityType: 'shift',
    entityId: shiftId,
    newValues: details,
    ipAddress,
  });
};

export const logShiftEnd = async (
  userId: number,
  shiftId: number,
  details: Record<string, unknown>,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'shift_end',
    entityType: 'shift',
    entityId: shiftId,
    newValues: details,
    ipAddress,
  });
};

export const logReassignment = async (
  userId: number,
  entityId: number,
  oldAssigneeId: number,
  newAssigneeId: number,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId,
    action: 'reassignment',
    entityType: 'transport_request',
    entityId,
    oldValues: { assigned_to: oldAssigneeId },
    newValues: { assigned_to: newAssigneeId },
    ipAddress,
  });
};

export const logStatusOverride = async (
  overriderId: number,
  targetUserId: number,
  oldStatus: string,
  newStatus: string,
  reason: string,
  ipAddress?: string
): Promise<void> => {
  await createAuditLog({
    userId: overriderId,
    action: 'override',
    entityType: 'transporter_status',
    entityId: targetUserId,
    oldValues: { status: oldStatus },
    newValues: { status: newStatus, reason, overridden_by: overriderId },
    ipAddress,
  });
};

export const getAuditLogs = async (filters: {
  userId?: number;
  entityType?: string;
  entityId?: number;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`al.user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }
  if (filters.entityType) {
    conditions.push(`al.entity_type = $${paramIndex++}`);
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    conditions.push(`al.entity_id = $${paramIndex++}`);
    params.push(filters.entityId);
  }
  if (filters.action) {
    conditions.push(`al.action = $${paramIndex++}`);
    params.push(filters.action);
  }
  if (filters.startDate) {
    conditions.push(`al.timestamp >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`al.timestamp <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const result = await query(
    `SELECT al.*, u.first_name, u.last_name, u.email
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}
     ORDER BY al.timestamp DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return result.rows;
};
