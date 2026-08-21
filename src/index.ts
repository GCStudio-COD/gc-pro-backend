import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import departmentRoutes from './routes/departments';
import timeLogRoutes from './routes/timeLog';
import attendanceRoutes from './routes/attendance';
import leaveRoutes from './routes/leaves';
import notificationRoutes from './routes/notifications';
import meetingRoutes from './routes/meetings';
import plakyRoutes from './routes/plaky';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Public routes
app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.url);
  next();
});
app.use('/api/auth', authRoutes);

// Protected routes (handled inside each file)
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/time-logs', timeLogRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/plaky', plakyRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'gc-project-backend is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

setInterval(() => {
  // Keep process alive
}, 1000 * 60 * 60);
