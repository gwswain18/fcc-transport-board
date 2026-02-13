import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import routes from './routes/index.js';
import { initializeSocket } from './socket/index.js';
import { startAlertService } from './services/alertService.js';
import { startHeartbeatService } from './services/heartbeatService.js';
import { startCycleTimeService } from './services/cycleTimeService.js';
import { startAutoAssignService } from './services/autoAssignService.js';
import { initializeTwilio } from './services/twilioService.js';
import { initializeEmail } from './services/emailService.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Trust proxy for Render (required for rate limiting and getting real client IP)
app.set('trust proxy', 1);

// Initialize Socket.io
initializeSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,                    // 300 requests per window per IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful crash handlers
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start services
  startAlertService();
  startHeartbeatService();
  startCycleTimeService();
  startAutoAssignService();

  // Initialize notification services (optional)
  await initializeTwilio();
  await initializeEmail();

  logger.info('All services started');
});

export default app;
