import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import logger from '../utils/logger.js';

export const getRequestHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get the request with creator/assignee info
    const requestResult = await query(
      `SELECT tr.*,
              creator.first_name as creator_first_name,
              creator.last_name as creator_last_name,
              assignee.first_name as assignee_first_name,
              assignee.last_name as assignee_last_name
       FROM transport_requests tr
       LEFT JOIN users creator ON tr.created_by = creator.id
       LEFT JOIN users assignee ON tr.assigned_to = assignee.id
       WHERE tr.id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    const row = requestResult.rows[0];
    const request = {
      ...row,
      creator: {
        id: row.created_by,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
      },
      assignee: row.assigned_to
        ? {
            id: row.assigned_to,
            first_name: row.assignee_first_name,
            last_name: row.assignee_last_name,
          }
        : null,
    };

    // Get status history
    const statusHistoryResult = await query(
      `SELECT sh.*, u.first_name, u.last_name
       FROM status_history sh
       LEFT JOIN users u ON sh.user_id = u.id
       WHERE sh.request_id = $1
       ORDER BY sh.changed_at ASC`,
      [id]
    );

    // Get audit logs for this request
    const auditLogsResult = await query(
      `SELECT al.*, u.first_name, u.last_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = 'transport_request' AND al.entity_id = $1
       ORDER BY al.timestamp ASC`,
      [id]
    );

    // Get delays
    const delaysResult = await query(
      `SELECT rd.*, u.first_name, u.last_name
       FROM request_delays rd
       LEFT JOIN users u ON rd.user_id = u.id
       WHERE rd.request_id = $1
       ORDER BY rd.created_at ASC`,
      [id]
    );

    res.json({
      request,
      status_history: statusHistoryResult.rows.map((sh) => ({
        ...sh,
        user: sh.first_name ? { first_name: sh.first_name, last_name: sh.last_name } : null,
      })),
      audit_logs: auditLogsResult.rows.map((al) => ({
        ...al,
        user: al.first_name ? { first_name: al.first_name, last_name: al.last_name } : null,
      })),
      delays: delaysResult.rows.map((d) => ({
        ...d,
        user: d.first_name ? { first_name: d.first_name, last_name: d.last_name } : null,
      })),
    });
  } catch (error) {
    logger.error('Get request history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
