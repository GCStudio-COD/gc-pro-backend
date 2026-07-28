import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const boards = await prisma.board.findMany({
      include: {
        space: true,
      }
    });

    // Map boards to legacy Project format to avoid crashing frontend widgets
    const legacyProjects = boards.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description || '',
      teamId: null,
      startDate: b.createdAt,
      endDate: b.createdAt,
      priority: 'Medium',
      status: 'In Progress',
      clientName: null,
      githubUrl: null,
      liveUrl: null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    res.json(legacyProjects);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
