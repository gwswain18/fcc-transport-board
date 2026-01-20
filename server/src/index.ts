import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import routes from './routes/index.js';
import { initializeSocket } from './socket/index.js';
import { startAlertService } from './services/alertService.js';
import { startHeartbeatService } from './services/heartbeatService.js';
import { startCycleTimeService } from './services/cycleTimeService.js';
import { startAutoAssignService } from './services/autoAssignService.js';
import { initializeTwilio } from './services/twilioService.js';
import { initializeEmail } from './services/emailService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start services
  startAlertService();
  startHeartbeatService();
  startCycleTimeService();
  startAutoAssignService();

  // Initialize notification services (optional)
  await initializeTwilio();
  await initializeEmail();

  console.log('All services started');
});

export default app;
