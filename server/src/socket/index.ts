import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { recordHeartbeat, removeHeartbeat } from '../services/heartbeatService.js';
import { query } from '../config/database.js';

let io: Server | null = null;

// Track socket -> user mapping
const socketUserMap = new Map<string, number>();

export const initializeSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
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
    console.log(`Client connected: ${socket.id} (user: ${userId})`);

    if (userId) {
      socketUserMap.set(socket.id, userId);

      // Record initial heartbeat with socket ID
      await recordHeartbeat(userId, socket.id);

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
            `UPDATE transporter_status SET status = 'available', updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND status = 'offline'`,
            [userId]
          );
        }
      }
    }

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);
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
              `UPDATE transporter_status SET status = 'offline', updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $1`,
              [disconnectedUserId]
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
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    socket.on('leave_room', (room: string) => {
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    });

    // Cycle time alert dismissed
    socket.on('cycle_alert_dismissed', async (data: { request_id: number; explanation?: string }) => {
      console.log(`Cycle alert dismissed for request ${data.request_id}: ${data.explanation || 'no explanation'}`);
    });

    // Break alert dismissed
    socket.on('break_alert_dismissed', async (data: { user_id: number; explanation?: string }) => {
      console.log(`Break alert dismissed for user ${data.user_id}: ${data.explanation || 'no explanation'}`);
    });

    // Offline alert dismissed
    socket.on('offline_alert_dismissed', async (data: { user_id: number; explanation?: string }) => {
      console.log(`Offline alert dismissed for user ${data.user_id}: ${data.explanation || 'no explanation'}`);
    });

    // Timeout alert dismissed
    socket.on('timeout_alert_dismissed', async (data: { request_id: number; explanation?: string }) => {
      console.log(`Timeout alert dismissed for request ${data.request_id}: ${data.explanation || 'no explanation'}`);
    });

    // Transporter requests help
    socket.on('help_requested', async (data: { request_id?: number; message?: string }) => {
      if (userId) {
        io?.emit('help_requested', {
          user_id: userId,
          request_id: data.request_id,
          message: data.message,
        });
        console.log(`Help requested by user ${userId}: ${data.message}`);
      }
    });
  });

  console.log('Socket.io initialized');
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
