import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const routerWithAuth = Router();
const prisma = new PrismaClient();

routerWithAuth.use(authenticateToken);

// Start a timer for a task
routerWithAuth.post('/start', async (req: any, res) => {
  const { taskId, timestamp } = req.body;
  const employeeId = req.user.id;
  try {
    const timeLog = await prisma.timeLog.create({
      data: {
        employeeId,
        taskId: taskId || null,
        startTime: timestamp ? new Date(timestamp) : new Date()
      }
    });

    if (taskId) {
      // Update task status to "In Progress" if it's started
      const task = await prisma.task.update({
        where: { id: taskId },
        data: { status: 'In Progress' }
      });

      if (task.projectId) {
        await prisma.project.update({
          where: { id: task.projectId },
          data: { status: 'In Progress' }
        });
      }
    }

    res.json({ timeLogId: timeLog.id });
  } catch (error) {
    console.error('Error starting time log:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Stop a timer
routerWithAuth.post('/stop', async (req, res) => {
  const { timeLogId, timestamp } = req.body;
  try {
    const timeLog = await prisma.timeLog.findUnique({ where: { id: timeLogId } });
    if (!timeLog) {
      return res.status(404).json({ error: 'Time log not found' });
    }

    const endTime = timestamp ? new Date(timestamp) : new Date();
    const durationSeconds = Math.floor((endTime.getTime() - timeLog.startTime.getTime()) / 1000);

    const updatedLog = await prisma.timeLog.update({
      where: { id: timeLogId },
      data: {
        endTime,
        durationSeconds
      },
      include: {
        task: true
      }
    });
    res.json(updatedLog);
  } catch (error) {
    console.error('Error stopping time log:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Get user's time logs
routerWithAuth.get('/', async (req: any, res) => {
  const employeeId = req.user.id;
  try {
    const logs = await prisma.timeLog.findMany({
      where: { employeeId, durationSeconds: { not: null } },
      include: { task: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching time logs:', error);
    res.status(500).json({ error: 'Failed to fetch time logs' });
  }
});

// Get total time spent on a task (for Admin)
router.get('/task/:taskId', async (req, res) => {
  const { taskId } = req.params;
  try {
    const logs = await prisma.timeLog.findMany({
      where: { taskId, durationSeconds: { not: null } }
    });

    const totalSeconds = logs.reduce((acc, log) => acc + (log.durationSeconds || 0), 0);
    res.json(logs); // We return the logs array like the frontend task view expects
  } catch (error) {
    console.error('Error fetching task time logs:', error);
    res.status(500).json({ error: 'Failed to fetch task times' });
  }
});

// Export a router that combines both
const mainRouter = Router();
mainRouter.use('/', router);
mainRouter.use('/', routerWithAuth);

export default mainRouter;
