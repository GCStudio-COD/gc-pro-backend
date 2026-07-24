import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
const prisma = new PrismaClient();
const router = Router();

// ==========================================
// WORKSPACES
// ==========================================

router.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      include: { spaces: true },
    });
    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const workspace = await prisma.workspace.create({ data: { name } });
    res.status(201).json(workspace);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// ==========================================
// SPACES
// ==========================================

router.get('/spaces', async (req: Request, res: Response) => {
  try {
    const spaces = await prisma.space.findMany({
      include: { boards: true },
    });
    res.json(spaces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch spaces' });
  }
});

router.post('/spaces', async (req: Request, res: Response) => {
  try {
    const { workspaceId, name, description, icon, color } = req.body;
    const space = await prisma.space.create({
      data: { workspaceId, name, description, icon, color },
    });
    res.status(201).json(space);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create space' });
  }
});

// ==========================================
// BOARDS
// ==========================================

router.get('/boards', async (req: Request, res: Response) => {
  try {
    const boards = await prisma.board.findMany({
      include: {
        groups: {
          include: {
            tasks: {
              where: { parentTaskId: null },
              include: { subTasks: true },
            },
          },
        },
      },
    });
    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

router.get('/boards/:id', async (req: Request, res: Response) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: {
        groups: {
          include: {
            tasks: {
              where: { parentTaskId: null },
              include: { 
                subTasks: true,
                assignee: { select: { id: true, firstName: true, lastName: true, profileImage: true } }
              },
            },
          },
        },
      },
    });
    res.json(board);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

router.post('/boards', async (req: Request, res: Response) => {
  try {
    const { spaceId, name, description, isFavorite } = req.body;
    const board = await prisma.board.create({
      data: { spaceId, name, description, isFavorite },
    });
    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create board' });
  }
});

router.put('/boards/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, isFavorite, columns } = req.body;
    const board = await prisma.board.update({
      where: { id: req.params.id },
      data: { name, description, isFavorite, columns },
    });
    res.json(board);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update board' });
  }
});

// ==========================================
// GROUPS
// ==========================================

router.post('/groups', async (req: Request, res: Response) => {
  try {
    const { boardId, name, order } = req.body;
    const group = await prisma.boardGroup.create({
      data: { boardId, name, order: order || 0 },
    });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// ==========================================
// TASKS
// ==========================================

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { groupId, parentTaskId, name, assigneeId, dueDate, content, creativeType, paymentStatus, status, description, order } = req.body;
    const task = await prisma.plakyTask.create({
      data: {
        groupId,
        parentTaskId,
        name,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null,
        content,
        creativeType,
        paymentStatus: paymentStatus || 'Pending',
        status: status || 'To Do',
        description,
        customFields: req.body.customFields || {},
        order: order || 0
      },
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { name, assigneeId, dueDate, content, creativeType, paymentStatus, status, description, order } = req.body;
    const task = await prisma.plakyTask.update({
      where: { id: req.params.id },
      data: {
        name,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        content,
        creativeType,
        paymentStatus,
        status,
        description,
        customFields: req.body.customFields,
        order,
      },
    });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    await prisma.plakyTask.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ==========================================
// MY TASKS (FOR DESKTOP APP)
// ==========================================
router.get('/my-boards', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const boards = await prisma.board.findMany({
      include: {
        groups: {
          include: {
            tasks: {
              where: {
                assigneeId: userId
              }
            }
          }
        }
      }
    });

    // Clean up boards to only return ones that actually have tasks for this user
    const filteredBoards = boards.map(board => {
      const allTasks: any[] = [];
      board.groups.forEach(g => {
        if (g.tasks && g.tasks.length > 0) {
          allTasks.push(...g.tasks);
        }
      });
      return {
        id: board.id,
        name: board.name,
        tasks: allTasks.map(t => ({
          id: t.id,
          title: t.name, // Desktop app expects 'title'
          timeConsumed: 0, // Not currently tracked in PlakyTask directly, but can add back later
          createdAt: t.createdAt,
          status: t.status === 'Done' ? 'Done' : t.status
        }))
      };
    }).filter(b => b.tasks.length > 0);

    res.json(filteredBoards);
  } catch (error) {
    console.error("Failed to fetch my boards:", error);
    res.status(500).json({ error: 'Failed to fetch my boards' });
  }
});

export default router;
