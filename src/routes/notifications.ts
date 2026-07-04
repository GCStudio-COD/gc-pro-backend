import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: any, res) => {
  const employeeId = req.user.id;
  const role = req.user.role;
  
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId is required' });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { employeeId: employeeId },
          { targetRole: role }
        ],
        AND: [
          {
            OR: [
              { creatorId: null },
              { creatorId: { not: employeeId } }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
