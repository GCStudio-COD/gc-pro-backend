import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  const { employeeId } = req.query;
  try {
    const filters: any = {};
    if (employeeId) filters.employeeId = employeeId;

    const leaves = await prisma.leaveRequest.findMany({ 
      where: filters,
      include: { employee: true }
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const leave = await prisma.leaveRequest.create({ data: req.body });
    
    // Notify admins and PMs
    await prisma.notification.createMany({
      data: [
        { targetRole: 'admin', message: `New leave request submitted`, type: 'leave', creatorId: req.body.employeeId },
        { targetRole: 'project-manager', message: `New leave request submitted`, type: 'leave', creatorId: req.body.employeeId }
      ]
    });

    res.json(leave);
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
    
    // Notify the employee about the status update
    if (req.body.status) {
      await prisma.notification.create({
        data: {
          employeeId: updated.employeeId,
          message: `Your leave request has been ${req.body.status.toLowerCase()}`,
          type: 'leave',
          creatorId: req.body.approverId // Optional, if frontend sends it
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
