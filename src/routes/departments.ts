import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        head: true,
        employees: true
      }
    });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const department = await prisma.department.create({ data: req.body });
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await prisma.department.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/employees', async (req, res) => {
  try {
    const { employeeIds } = req.body;
    
    // Remove employees that are no longer assigned
    await prisma.employee.updateMany({
      where: { departmentId: req.params.id, id: { notIn: employeeIds || [] } },
      data: { departmentId: null }
    });

    // Assign new employees
    if (employeeIds && employeeIds.length > 0) {
      await prisma.employee.updateMany({
        where: { id: { in: employeeIds } },
        data: { departmentId: req.params.id }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
