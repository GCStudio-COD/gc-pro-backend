import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Helper to get start/end of current month
function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function calculateDays(startDate: Date, endDate: Date) {
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

router.get('/balances/:employeeId', async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const { start: monthStart, end: monthEnd } = getMonthRange();

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'Approved'
      }
    });

    let usedPaid = 0;

    for (const leave of approvedLeaves) {
      const days = calculateDays(leave.startDate, leave.endDate);
      const start = new Date(leave.startDate);
      
      if (leave.type === 'Paid' && start >= monthStart && start <= monthEnd) {
        usedPaid += days;
      }
    }

    res.json({
      paid: { total: 1, used: usedPaid, remaining: 1 - usedPaid }
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
    const { start: monthStart, end: monthEnd } = getMonthRange();
    
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: { employeeId, status: 'Approved' }
    });

    let used = 0;
    for (const leave of approvedLeaves) {
      const start = new Date(leave.startDate);
      if (leave.type === type) {
        if (type === 'Paid' && start >= monthStart && start <= monthEnd) {
          used += calculateDays(leave.startDate, leave.endDate);
        }
      }
    }

    if (type === 'Paid') {
      const limit = 1;
      if (used + days > limit) {
        return res.status(400).json({ error: `Insufficient ${type} leave balance.` });
      }
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

router.put('/:id', async (req: any, res) => {
  const role = req.user.role;
  const userId = req.user.id;

  try {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    if (req.body.status && req.body.status !== leave.status) {
      if (role !== 'admin' && role !== 'project-manager' && role !== 'SuperAdmin') {
        return res.status(403).json({ error: 'Unauthorized to approve leaves' });
      }
      if (leave.employeeId === userId) {
        return res.status(403).json({ error: 'You cannot approve your own leave request' });
      }
    }

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

