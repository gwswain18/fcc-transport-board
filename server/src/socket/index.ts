import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { recordHeartbeat, removeHeartbeat } from '../services/heartbeatService.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

let io: Server | null = null;

// Track socket -> user mapping
const socketUserMap = new Map<string, number>();

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 120000,
    pingInterval: 30000,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    cookie: {
      name: 'io',
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyToken(token);
      (socket as Socket & { userId?: number }).userId = payload.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = (socket as Socket & { userId?: number }).userId;
    logger.info(`Client connected: ${socket.id} (user: ${userId})`);

    if (userId) {
      socketUserMap.set(socket.id, userId);

      // Record initial heartbeat with socket ID
      await recordHeartbeat(userId, socket.id);

      // Send initial dispatcher list to newly connected client
      try {
        const dispatcherResult = await query(
          `SELECT ad.*, u.first_name, u.last_name, u.email, u.phone_number
           FROM active_dispatchers ad
           JOIN users u ON ad.user_id = u.id
           WHERE ad.ended_at IS NULL
           ORDER BY ad.is_primary DESC, ad.started_at ASC`
        );

        const dispatchers = dispatcherResult.rows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          is_primary: row.is_primary,
          on_break: row.on_break,
          break_start: row.break_start,
          replaced_by: row.replaced_by,
          relief_info: row.relief_info,
          contact_info: row.contact_info,
          started_at: row.started_at,
          ended_at: row.ended_at,
          user: {
            id: row.user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            phone_number: row.phone_number,
          },
        }));

        socket.emit('dispatcher_changed', { dispatchers });
      } catch (error) {
        logger.error('Error sending initial dispatcher data:', error);
      }

      // Update user status to available if they're a transporter with an active shift
      const shiftResult = await query(
        `SELECT sl.id FROM shift_logs sl
         JOIN users u ON sl.user_id = u.id
         WHERE sl.user_id = $1 AND sl.shift_end IS NULL AND u.role = 'transporter'`,
        [userId]
      );

      if (shiftResult.rows.length > 0) {
        // Check if not currently in a job
        const jobResult = await query(
          `SELECT id FROM transport_requests
           WHERE assigned_to = $1 AND status NOT IN ('complete', 'cancelled', 'pending')`,
          [userId]
        );

        if (jobResult.rows.length === 0) {
          await query(
            `UPDATE transporter_status SET status = 'available', went_offline_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND status = 'offline'`,
            [userId]
          );
        }

        // Close any open offline_periods records
        await query(
          `UPDATE offline_periods
           SET online_at = CURRENT_TIMESTAMP,
               duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - offline_at))::int
           WHERE user_id = $1 AND online_at IS NULL`,
          [userId]
        );
      }
    }

    socket.on('disconnect', async () => {
      logger.info(`Client disconnected: ${socket.id}`);
      const disconnectedUserId = socketUserMap.get(socket.id);

      if (disconnectedUserId) {
        socketUserMap.delete(socket.id);

        // Check if this was the user's last connection
        let hasOtherConnections = false;
        for (const [, uid] of socketUserMap) {
          if (uid === disconnectedUserId) {
            hasOtherConnections = true;
            break;
          }
        }

        if (!hasOtherConnections) {
          // User has no more active connections
          await removeHeartbeat(disconnectedUserId);

          // Mark transporter as offline if they have no active jobs
          const jobResult = await query(
            `SELECT id FROM transport_requests
             WHERE assigned_to = $1 AND status NOT IN ('complete', 'cancelled', 'pending')`,
            [disconnectedUserId]
          );

          if (jobResult.rows.length === 0) {
            await query(
              `UPDATE transporter_status SET status = 'offline', went_offline_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $1`,
              [disconnectedUserId]
            );

            // Create offline_periods record
            const shiftResult2 = await query(
              `SELECT id FROM shift_logs WHERE user_id = $1 AND shift_end IS NULL ORDER BY shift_start DESC LIMIT 1`,
              [disconnectedUserId]
            );
            const shiftId = shiftResult2.rows[0]?.id || null;
            await query(
              `INSERT INTO offline_periods (user_id, shift_id, offline_at) VALUES ($1, $2, CURRENT_TIMESTAMP)`,
              [disconnectedUserId, shiftId]
            );

            // Emit status change
            const statusResult = await query(
              `SELECT ts.*, u.first_name, u.last_name, u.email
               FROM transporter_status ts
               JOIN users u ON ts.user_id = u.id
               WHERE ts.user_id = $1`,
              [disconnectedUserId]
            );

            if (statusResult.rows[0]) {
              io?.emit('transporter_status_changed', {
                ...statusResult.rows[0],
                user: {
                  id: disconnectedUserId,
                  first_name: statusResult.rows[0].first_name,
                  last_name: statusResult.rows[0].last_name,
                  email: statusResult.rows[0].email,
                },
              });
            }
          }
        }
      }
    });

    // Heartbeat from client
    socket.on('heartbeat', async () => {
      if (userId) {
        await recordHeartbeat(userId, socket.id);
      }
    });

    // Join role-specific rooms
    socket.on('join_room', (room: string) => {
      socket.join(room);
      logger.info(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave_room', (room: string) => {
      socket.leave(room);
      logger.info(`Socket ${socket.id} left room: ${room}`);
    });

    // Cycle time alert dismissed
    socket.on('cycle_alert_dismissed', async (data: { request_id: number; explanation?: string }) => {
      logger.info(`Cycle alert dismissed for request ${data.request_id}: ${data.explanation || 'no explanation'}`);
    });

    // Break alert dismissed
    socket.on('break_alert_dismissed', async (data: { user_id: number; explanation?: string }) => {
      logger.info(`Break alert dismissed for user ${data.user_id}: ${data.explanation || 'no explanation'}`);
    });

    // Offline alert dismissed
    socket.on('offline_alert_dismissed', async (data: { user_id: number; explanation?: string }) => {
      logger.info(`Offline alert dismissed for user ${data.user_id}: ${data.explanation || 'no explanation'}`);
    });

    // Timeout alert dismissed
    socket.on('timeout_alert_dismissed', async (data: { request_id: number; explanation?: string }) => {
      logger.info(`Timeout alert dismissed for request ${data.request_id}: ${data.explanation || 'no explanation'}`);
    });

    // Help request resolved by dispatcher
    socket.on('help_resolved', async (data: { help_request_id: number }) => {
      if (userId && data.help_request_id) {
        try {
          await query(
            `UPDATE help_requests SET resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
             WHERE id = $2 AND resolved_at IS NULL`,
            [userId, data.help_request_id]
          );
          // Broadcast to all clients so everyone removes the alert
          io?.emit('help_resolved', { help_request_id: data.help_request_id });
          logger.info(`Help request ${data.help_request_id} resolved by user ${userId}`);
        } catch (error) {
          logger.error('Error resolving help request:', error);
        }
      }
    });

    // Transporter requests help
    socket.on('help_requested', async (data: { request_id?: number; message?: string }) => {
      if (userId) {
        try {
          // Get transporter name and job info
          const userResult = await query(
            'SELECT first_name, last_name FROM users WHERE id = $1',
            [userId]
          );
          const userName = userResult.rows[0];

          let jobInfo: { origin_floor?: string; room_number?: string } = {};
          if (data.request_id) {
            const jobResult = await query(
              'SELECT origin_floor, room_number FROM transport_requests WHERE id = $1',
              [data.request_id]
            );
            if (jobResult.rows[0]) {
              jobInfo = jobResult.rows[0];
            }
          }

          // Persist help request
          const insertResult = await query(
            `INSERT INTO help_requests (user_id, request_id, message)
             VALUES ($1, $2, $3) RETURNING id, created_at`,
            [userId, data.request_id || null, data.message || null]
          );

          io?.emit('help_requested', {
            id: insertResult.rows[0].id,
            user_id: userId,
            request_id: data.request_id,
            message: data.message,
            first_name: userName?.first_name,
            last_name: userName?.last_name,
            origin_floor: jobInfo.origin_floor,
            room_number: jobInfo.room_number,
            created_at: insertResult.rows[0].created_at,
          });
          logger.info(`Help requested by user ${userId} (${userName?.first_name} ${userName?.last_name}): ${data.message}`);
        } catch (error) {
          logger.error('Error processing help request:', error);
          // Still emit basic event on error
          io?.emit('help_requested', {
            user_id: userId,
            request_id: data.request_id,
            message: data.message,
          });
        }
      }
    });
  });

  logger.info('Socket.io initialized');
  return io;
};

export const getIO = (): Server | null => io;

// Helper to get socket by user ID
export const getSocketByUserId = (userId: number): string | null => {
  for (const [socketId, uid] of socketUserMap) {
    if (uid === userId) {
      return socketId;
    }
  }
  return null;
};

// Helper to emit to a specific user
export const emitToUser = (userId: number, event: string, data: unknown): boolean => {
  const socketId = getSocketByUserId(userId);
  if (socketId && io) {
    io.to(socketId).emit(event, data);
    return true;
  }
  return false;
};
