import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import departmentRoutes from './routes/departments';
import timeLogRoutes from './routes/timeLog';
import attendanceRoutes from './routes/attendance';
import leaveRoutes from './routes/leaves';
import notificationRoutes from './routes/notifications';
import meetingRoutes from './routes/meetings';

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
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/time-logs', timeLogRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meetings', meetingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'gc-project-backend is running' });
});

// Example route: Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        department: true,
      },
    });
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

setInterval(() => {
  // Keep process alive
}, 1000 * 60 * 60);
