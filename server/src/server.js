import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { setSocketIo } from './services/eventProcessor.js';
import { setSchedulerSocketIo, startScheduler } from './services/schedulerService.js';

const server = http.createServer(app);

// Socket.IO configuration for real-time dashboard updates
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Provide socket instance to services
setSocketIo(io);
setSchedulerSocketIo(io);

// Socket.io connection and room subscriptions
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('join:caregiver', (caregiverId) => {
    if (caregiverId) {
      socket.join(`caregiver:${caregiverId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined room caregiver:${caregiverId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Start Server
async function bootstrap() {
  await connectDB();

  startScheduler();

  server.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 MediMate Smart Medicine Box Backend Running!`);
    console.log(`🌐 Server Port: ${config.port}`);
    console.log(`📡 Environment: ${config.nodeEnv}`);
    console.log(`🩺 Health check: http://localhost:${config.port}/api/health`);
    console.log(`=======================================================`);
  });
}

bootstrap();
