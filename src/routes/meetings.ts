import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: any, res) => {
  const { date } = req.query;
  const employeeId = req.user.id;
  const role = req.user.role;

  try {
    let filters: any = {};

    if (date) {
      // Find meetings on this date
      const queryDate = new Date(date as string);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
      filters.startTime = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    const meetings = await prisma.meeting.findMany({
      where: filters,
      include: {
        organizer: true,
        participants: true
      },
      orderBy: { startTime: 'asc' }
    });
    res.json(meetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req: any, res) => {
  try {
    const { title, description, startTime, endTime, type, participantsIds } = req.body;
    const meeting = await prisma.meeting.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        type,
        organizerId: req.user.id,
        participants: {
          connect: participantsIds?.map((id: string) => ({ id })) || []
        }
      },
      include: {
        organizer: true,
        participants: true
      }
    });
    res.json(meeting);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
