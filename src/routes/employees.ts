import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken); // Protect all routes

router.get('/', async (req, res) => {
  const { status } = req.query;
  try {
    const filters: any = {};
    if (status) filters.status = status;
    const employees = await prisma.employee.findMany({ 
      where: filters,
      include: { department: true }
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Approval endpoint
router.put('/:id/approve', async (req: AuthRequest, res) => {
  const { role } = req.body;
  const userRole = req.user?.role;
  const targetId = req.params.id;

  try {
    // Basic validation
    if (!['admin', 'project-manager', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role provided' });
    }

    // Role-based authorization
    if (userRole === 'project-manager' && role !== 'employee') {
      return res.status(403).json({ error: 'PMs can only approve Employees' });
    }
    
    if (!['SuperAdmin', 'admin', 'project-manager'].includes(userRole as string)) {
      return res.status(403).json({ error: 'Unauthorized to approve users' });
    }

    const updated = await prisma.employee.update({
      where: { id: targetId as string },
      data: {
        status: 'Active',
        role: role
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Unauthorized to delete users' });
    }
    
    // Additional check: Don't allow an admin to delete a SuperAdmin
    const target = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (target?.role === 'SuperAdmin' && userRole !== 'SuperAdmin') {
      return res.status(403).json({ error: 'Cannot delete SuperAdmin' });
    }
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
