import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

// Leaves Router - GC Pro
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

function calculateDays(startDate: Date | string, endDate: Date | string, isHalfDay?: boolean) {
  if (isHalfDay) return 0.5;
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
    let usedWfh = 0;

    for (const leave of approvedLeaves) {
      const days = calculateDays(leave.startDate, leave.endDate, leave.isHalfDay);
      const start = new Date(leave.startDate);
      
      if (start >= monthStart && start <= monthEnd) {
        if (leave.type === 'Paid') {
          usedPaid += days;
        } else if (leave.type === 'Work From Home') {
          usedWfh += days;
        }
      }
    }

    res.json({
      paid: { total: 1, used: usedPaid, remaining: Math.max(0, 1 - usedPaid) },
      wfh: { total: 4, used: usedWfh, remaining: Math.max(0, 4 - usedWfh) }
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
    const { employeeId, startDate, endDate, reason, type, isHalfDay, halfDayPeriod } = req.body;
    
    // Validate balance before creating
    const days = calculateDays(startDate, endDate, Boolean(isHalfDay));
    const { start: monthStart, end: monthEnd } = getMonthRange();
    
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: { employeeId, status: 'Approved' }
    });

    let used = 0;
    for (const leave of approvedLeaves) {
      const start = new Date(leave.startDate);
      if (leave.type === type && start >= monthStart && start <= monthEnd) {
        used += calculateDays(leave.startDate, leave.endDate, leave.isHalfDay);
      }
    }

    if (type === 'Paid') {
      const limit = 1;
      if (used + days > limit) {
        return res.status(400).json({ error: `Insufficient Paid leave balance. (Limit: 1 day/month, remaining: ${Math.max(0, limit - used)} days)` });
      }
    } else if (type === 'Work From Home') {
      const limit = 4;
      if (used + days > limit) {
        return res.status(400).json({ error: `Insufficient Work From Home balance. (Limit: 4 days/month, remaining: ${Math.max(0, limit - used)} days)` });
      }
    }

    const leave = await prisma.leaveRequest.create({ 
      data: { 
        employeeId, 
        startDate: new Date(startDate), 
        endDate: isHalfDay ? new Date(startDate) : new Date(endDate), 
        reason, 
        type,
        isHalfDay: Boolean(isHalfDay),
        halfDayPeriod: isHalfDay ? (halfDayPeriod || 'First Half') : null
      } 
    });
    
    const halfDayInfo = isHalfDay ? ` (Half Day - ${halfDayPeriod || 'First Half'})` : '';
    await prisma.notification.createMany({
      data: [
        { targetRole: 'admin', message: `New ${type} leave request submitted${halfDayInfo}`, type: 'leave', creatorId: employeeId },
        { targetRole: 'project-manager', message: `New ${type} leave request submitted${halfDayInfo}`, type: 'leave', creatorId: employeeId }
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
  const role = req.user?.role || '';
  const userId = req.user?.id;

  try {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!leave) return res.status(404).json({ error: 'Leave not found' });

    // Normalize role string (case-insensitive, remove spaces/dashes/underscores)
    const normalizedRole = role.toLowerCase().replace(/[-_ ]/g, '');
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'superadmin' || normalizedRole.includes('admin');
    const isPM = normalizedRole === 'projectmanager' || normalizedRole === 'pm' || normalizedRole.includes('pm') || normalizedRole.includes('projectmanager');

    // Status change authorization
    if (req.body.status && req.body.status !== leave.status) {
      if (!isAdmin && !isPM) {
        return res.status(403).json({ error: 'Unauthorized: Only Admin and Project Manager can approve or reject leaves' });
      }
    }

    // Build update payload
    const updateData: any = {};
    if (req.body.status) {
      updateData.status = req.body.status;
    }

    // Direct explicit fields
    if (req.body.adminComment !== undefined) {
      updateData.adminComment = req.body.adminComment;
    }
    if (req.body.pmComment !== undefined) {
      updateData.pmComment = req.body.pmComment;
    }

    // Generic comment field (or fallback based on user role)
    if (req.body.comment !== undefined) {
      const commentVal = req.body.comment;
      if (isAdmin && updateData.adminComment === undefined) {
        updateData.adminComment = commentVal;
      } else if (isPM && updateData.pmComment === undefined) {
        updateData.pmComment = commentVal;
      } else if (updateData.adminComment === undefined && updateData.pmComment === undefined) {
        updateData.adminComment = commentVal;
      }
    }

    // Fallbacks
    if (isPM && !isAdmin && req.body.adminComment !== undefined && updateData.pmComment === undefined) {
      updateData.pmComment = req.body.adminComment;
    }
    if (isAdmin && !isPM && req.body.pmComment !== undefined && updateData.adminComment === undefined) {
      updateData.adminComment = req.body.pmComment;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: updateData,
      include: { employee: true }
    });
    
    // Notifications (non-blocking)
    try {
      if (req.body.status && req.body.status !== leave.status) {
        const commentText = updateData.adminComment || updateData.pmComment;
        const commentNote = commentText ? ` (Note: ${commentText})` : '';
        await prisma.notification.create({
          data: {
            employeeId: updated.employeeId,
            message: `Your leave request has been ${req.body.status.toLowerCase()}${commentNote}`,
            type: 'leave',
            creatorId: req.body.approverId || userId
          }
        });
      } else if (updateData.adminComment !== undefined || updateData.pmComment !== undefined) {
        const commenter = isAdmin ? 'Admin' : 'Project Manager';
        await prisma.notification.create({
          data: {
            employeeId: updated.employeeId,
            message: `${commenter} added a comment to your leave request`,
            type: 'leave',
            creatorId: userId
          }
        });
      }
    } catch (notifErr) {
      console.error('Failed to create notification for leave update:', notifErr);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
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
