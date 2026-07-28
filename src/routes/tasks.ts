import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.plakyTask.findMany({
      include: {
        assignee: true,
      }
    });

    // Map PlakyTasks to legacy Task format to avoid crashing frontend widgets
    const legacyTasks = tasks.map(t => ({
      id: t.id,
      title: t.name,
      description: t.description || '',
      projectId: t.groupId, // Mock project ID
      assigneeId: t.assigneeId,
      dueDate: t.dueDate || t.createdAt,
      priority: 'Medium',
      status: t.status,
      timeConsumed: 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      assignee: t.assignee,
    }));

    res.json(legacyTasks);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
