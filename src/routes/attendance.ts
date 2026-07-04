import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Get current daily status (accumulated time and active check-in)
router.get('/status', async (req: any, res) => {
  const employeeId = req.user.id;
  try {
    // Get start of today (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logsToday = await prisma.attendanceLog.findMany({
      where: {
        employeeId,
        date: {
          gte: today
        }
      }
    });

    let accumulatedShiftSeconds = 0;
    let activeLog = null;

    for (const log of logsToday) {
      if (log.durationSeconds) {
        accumulatedShiftSeconds += log.durationSeconds;
      }
      if (!log.checkOutTime) {
        activeLog = log;
      }
    }

    res.json({
      accumulatedShiftSeconds,
      activeAttendanceLogId: activeLog?.id || null,
      checkInTime: activeLog?.checkInTime || null
    });
  } catch (error) {
    console.error('Error fetching attendance status:', error);
    res.status(500).json({ error: 'Failed to fetch attendance status' });
  }
});

// Check-in (Start workday)
router.post('/check-in', async (req: any, res) => {
  const employeeId = req.user.id;
  try {
    const attendanceLog = await prisma.attendanceLog.create({
      data: {
        employeeId,
        checkInTime: new Date(),
        date: new Date()
      }
    });
    res.json({ attendanceLogId: attendanceLog.id });
  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Check-out (End workday)
router.post('/check-out', async (req, res) => {
  const { attendanceLogId } = req.body;
  try {
    const log = await prisma.attendanceLog.findUnique({ where: { id: attendanceLogId } });
    if (!log) {
      return res.status(404).json({ error: 'Attendance log not found' });
    }

    const checkOutTime = new Date();
    const durationSeconds = Math.floor((checkOutTime.getTime() - log.checkInTime.getTime()) / 1000);

    const updatedLog = await prisma.attendanceLog.update({
      where: { id: attendanceLogId },
      data: {
        checkOutTime,
        durationSeconds
      },
      include: {
        employee: true
      }
    });
    res.json(updatedLog);
  } catch (error) {
    console.error('Error during check-out:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// Get attendance logs
router.get('/', async (req: any, res) => {
  const employeeId = req.user.id;
  const role = req.user.role;
  
  try {
    // Admin / PM can view all logs, employee can only view their own
    let whereClause = {};
    if (role === 'employee') {
      whereClause = { employeeId };
    }
    
    const logs = await prisma.attendanceLog.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            department: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    res.status(500).json({ error: 'Failed to fetch attendance logs' });
  }
});

export default router;
