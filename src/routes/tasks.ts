import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: any, res) => {
  const { projectId, assigneeId } = req.query;
  const role = req.user.role;
  const employeeId = req.user.id;
  try {
    const filters: any = {};
    if (projectId) filters.projectId = projectId;
    
    if (role === 'employee') {
      filters.assigneeId = employeeId;
    } else if (assigneeId) {
      filters.assigneeId = assigneeId;
    }

    const tasks = await prisma.task.findMany({ 
      where: filters,
      include: {
        project: true,
        assignee: true
      }
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const task = await prisma.task.create({ data: req.body });
    
    if (task.assigneeId) {
      // Auto-add assignee to project's team members
      if (task.projectId) {
        await prisma.project.update({
          where: { id: task.projectId },
          data: {
            employees: {
              connect: { id: task.assigneeId }
            }
          }
        });
      }

      await prisma.notification.create({
        data: {
          employeeId: task.assigneeId,
          message: `You have been assigned a new task: ${task.title}`,
          type: 'task',
          creatorId: (req as any).user.id
        }
      });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body
    });

    if (updated.assigneeId && updated.projectId) {
      await prisma.project.update({
        where: { id: updated.projectId },
        data: {
          employees: {
            connect: { id: updated.assigneeId }
          }
        }
      });
    }

    if (updated.projectId && (updated.status === 'Done' || updated.status === 'Completed')) {
      const allProjectTasks = await prisma.task.findMany({ where: { projectId: updated.projectId } });
      const allDone = allProjectTasks.length > 0 && allProjectTasks.every(t => t.status === 'Done' || t.status === 'Completed');
      
      if (allDone) {
        await prisma.project.update({
          where: { id: updated.projectId },
          data: { status: 'Completed' }
        });
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
