import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Helper to get start/end of current week (Monday to Sunday)
function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

// Helper to get start/end of current year
function getYearRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function calculateDays(startDate: Date, endDate: Date) {
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

router.get('/balances/:employeeId', async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const { start: weekStart, end: weekEnd } = getWeekRange();
    const { start: yearStart, end: yearEnd } = getYearRange();

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'Approved'
      }
    });

    let usedSick = 0;
    let usedPaid = 0;
    let usedEmergency = 0;

    for (const leave of approvedLeaves) {
      const days = calculateDays(leave.startDate, leave.endDate);
      const start = new Date(leave.startDate);
      
      if (leave.type === 'Sick' && start >= yearStart && start <= yearEnd) {
        usedSick += days;
      } else if (leave.type === 'Paid' && start >= weekStart && start <= weekEnd) {
        usedPaid += days;
      } else if (leave.type === 'Emergency' && start >= weekStart && start <= weekEnd) {
        usedEmergency += days;
      }
    }

    res.json({
      sick: { total: 14, used: usedSick, remaining: 14 - usedSick },
      paid: { total: 1, used: usedPaid, remaining: 1 - usedPaid },
      emergency: { total: 1, used: usedEmergency, remaining: 1 - usedEmergency }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  const { employeeId } = req.query;
  try {
    const filters: any = {};
    if (employeeId) filters.employeeId = employeeId;

    const leaves = await prisma.leaveRequest.findMany({ 
      where: filters,
      include: { employee: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { employeeId, startDate, endDate, reason, type } = req.body;
    
    // Validate balance before creating
    const days = calculateDays(startDate, endDate);
    const { start: weekStart, end: weekEnd } = getWeekRange();
    const { start: yearStart, end: yearEnd } = getYearRange();
    
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: { employeeId, status: 'Approved' }
    });

    let used = 0;
    for (const leave of approvedLeaves) {
      const start = new Date(leave.startDate);
      if (leave.type === type) {
        if (type === 'Sick' && start >= yearStart && start <= yearEnd) {
          used += calculateDays(leave.startDate, leave.endDate);
        } else if ((type === 'Paid' || type === 'Emergency') && start >= weekStart && start <= weekEnd) {
          used += calculateDays(leave.startDate, leave.endDate);
        }
      }
    }

    const limit = type === 'Sick' ? 14 : 1;
    if (used + days > limit) {
      return res.status(400).json({ error: `Insufficient ${type} leave balance.` });
    }

    const leave = await prisma.leaveRequest.create({ 
      data: { employeeId, startDate: new Date(startDate), endDate: new Date(endDate), reason, type } 
    });
    
    await prisma.notification.createMany({
      data: [
        { targetRole: 'admin', message: `New ${type} leave request submitted`, type: 'leave', creatorId: employeeId },
        { targetRole: 'project-manager', message: `New ${type} leave request submitted`, type: 'leave', creatorId: employeeId }
      ]
    });

    res.json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/cancel', async (req, res) => {
  try {
    const updated = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: 'CancelPending' }
    });
    
    await prisma.notification.createMany({
      data: [
        { targetRole: 'admin', message: `Leave cancellation requested`, type: 'leave', creatorId: updated.employeeId },
        { targetRole: 'project-manager', message: `Leave cancellation requested`, type: 'leave', creatorId: updated.employeeId }
      ]
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: req.body
    });
    
    if (req.body.status) {
      await prisma.notification.create({
        data: {
          employeeId: updated.employeeId,
          message: `Your leave request has been ${req.body.status.toLowerCase()}`,
          type: 'leave',
          creatorId: req.body.approverId
        }
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.leaveRequest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
