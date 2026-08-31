import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
const prisma = new PrismaClient();
const router = Router();

// Helper to generate a slug from a string
const generateSlug = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-');      // Replace multiple - with single -
};

// Helper to ensure a unique space slug
const getUniqueSpaceSlug = async (baseSlug: string) => {
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.space.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
};

// Helper to ensure a unique board slug
const getUniqueBoardSlug = async (baseSlug: string) => {
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.board.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
};

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
    const { employeeId, role } = req.query;
    let whereClause = {};
    let includeBoards: any = true;

    if (role === 'employee' && employeeId) {
      whereClause = {
        boards: {
          some: {
            groups: { some: { tasks: { some: { assigneeId: String(employeeId) } } } }
          }
        }
      };
      includeBoards = {
        where: {
          groups: { some: { tasks: { some: { assigneeId: String(employeeId) } } } }
        }
      };
    }

    const spaces = await prisma.space.findMany({
      where: whereClause,
      include: { boards: includeBoards },
    });
    res.json(spaces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch spaces' });
  }
});

router.post('/spaces', async (req: Request, res: Response) => {
  try {
    const { workspaceId, name, description, icon, color } = req.body;
    const baseSlug = generateSlug(name) || 'space';
    const slug = await getUniqueSpaceSlug(baseSlug);
    
    const space = await prisma.space.create({
      data: { workspaceId, name, slug, description, icon, color },
    });
    res.status(201).json(space);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create space' });
  }
});

// ==========================================
// BOARDS
// ==========================================

router.delete('/spaces/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role?.toLowerCase() || '';
    if (userRole === 'employee') {
      return res.status(403).json({ error: 'Employees cannot delete spaces' });
    }
    
    // Find first by id or slug
    const spaceToDelete = await prisma.space.findFirst({
      where: {
        OR: [
          { id: req.params.id as string }, { slug: req.params.id as string }
        ]
      }
    });

    if (!spaceToDelete) return res.status(404).json({ error: 'Space not found' });

    await prisma.space.delete({ where: { id: spaceToDelete.id } });
    res.json({ message: 'Space deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete space' });
  }
});

router.get('/boards', async (req: Request, res: Response) => {
  try {
    const { employeeId, role } = req.query;
    let whereClause = {};
    let tasksWhereClause: any = { parentTaskId: null };
    let subTasksClause: any = true;
    let groupsWhereClause: any = {};

    if (role === 'employee' && employeeId) {
      whereClause = {
        groups: { some: { tasks: { some: { assigneeId: String(employeeId) } } } }
      };
      tasksWhereClause = { parentTaskId: null, assigneeId: String(employeeId) };
      subTasksClause = { where: { assigneeId: String(employeeId) } };
      groupsWhereClause = { tasks: { some: { assigneeId: String(employeeId) } } };
    }

    const boards = await prisma.board.findMany({
      where: whereClause,
      include: {
        groups: {
          where: groupsWhereClause,
          include: {
            tasks: {
              where: tasksWhereClause,
              include: { subTasks: subTasksClause },
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
    const { employeeId, role } = req.query;
    let tasksWhereClause: any = { parentTaskId: null };
    let subTasksClause: any = true;
    let groupsWhereClause: any = {};

    if (role === 'employee' && employeeId) {
      tasksWhereClause = { parentTaskId: null, assigneeId: String(employeeId) };
      subTasksClause = { where: { assigneeId: String(employeeId) } };
      groupsWhereClause = { tasks: { some: { assigneeId: String(employeeId) } } };
    }

    // Use findFirst so we can match by either id or slug
    const board = await prisma.board.findFirst({
      where: {
        OR: [
          { id: req.params.id as string }, { slug: req.params.id as string }
        ]
      },
      include: {
        groups: {
          where: groupsWhereClause,
          include: {
            tasks: {
              where: tasksWhereClause,
              include: { 
                subTasks: subTasksClause,
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
    const baseSlug = generateSlug(name) || 'board';
    const slug = await getUniqueBoardSlug(baseSlug);

    const board = await prisma.board.create({
      data: { spaceId, name, slug, description, isFavorite },
    });
    
    // Automatically create a default group so the user can immediately add tasks
    await prisma.boardGroup.create({
      data: {
        boardId: board.id,
        name: "New Group",
        order: 0
      }
    });

    // Notify PMs and Admins about the new board
    await prisma.notification.createMany({
      data: [
        { targetRole: 'project-manager', type: 'project', message: `New board created: ${board.name}` },
        { targetRole: 'admin', type: 'project', message: `New board created: ${board.name}` }
      ]
    });

    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create board' });
  }
});

router.put('/boards/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, isFavorite, status, columns } = req.body;
    
    // Find first by id or slug
    const boardToUpdate = await prisma.board.findFirst({
      where: {
        OR: [
          { id: req.params.id as string }, { slug: req.params.id as string }
        ]
      }
    });

    if (!boardToUpdate) return res.status(404).json({ error: 'Board not found' });

    const board = await prisma.board.update({
      where: { id: boardToUpdate.id },
      data: { name, description, isFavorite, status, columns },
    });
    res.json(board);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update board' });
  }
});

// ==========================================
// GROUPS
// ==========================================

router.delete('/boards/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role?.toLowerCase() || '';
    if (userRole === 'employee') {
      return res.status(403).json({ error: 'Employees cannot delete projects' });
    }
    
    // Find first by id or slug
    const boardToDelete = await prisma.board.findFirst({
      where: {
        OR: [
          { id: req.params.id as string }, { slug: req.params.id as string }
        ]
      }
    });

    if (!boardToDelete) return res.status(404).json({ error: 'Board not found' });

    await prisma.board.delete({ where: { id: boardToDelete.id } });
    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

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

router.put('/groups/:id', async (req: Request, res: Response) => {
  try {
    const { name, order } = req.body;
    const group = await prisma.boardGroup.update({
      where: { id: req.params.id as string },
      data: { 
        name: name !== undefined ? name : undefined,
        order: order !== undefined ? order : undefined
      },
    });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/groups/:id', async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id as string;
    // Delete all tasks in group first
    await prisma.plakyTask.deleteMany({ where: { groupId } });
    await prisma.boardGroup.delete({ where: { id: groupId } });
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// ==========================================
// TASKS
// ==========================================

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { employeeId, role } = req.query;
    let whereClause: any = {};
    if (role === 'employee' && employeeId) {
      whereClause = { assigneeId: String(employeeId) };
    }
    const tasks = await prisma.plakyTask.findMany({
      where: whereClause,
      include: { assignee: true, group: { include: { board: true } } }
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { groupId, parentTaskId, name, assigneeId, dueDate, content, creativeType, paymentStatus, status, priority, description, order } = req.body;
    const task = await prisma.plakyTask.create({
      data: {
        groupId,
        parentTaskId,
        name,
        assigneeId,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : null,
        content,
        creativeType,
        paymentStatus: paymentStatus || 'Pending',
        status: status || 'To Do',
        priority: priority || 'Medium',
        description,
        customFields: req.body.customFields || {},
        order: order || 0
      },
    });
    if (assigneeId) {
      await prisma.notification.create({
        data: {
          employeeId: assigneeId,
          type: 'task',
          message: `You have been assigned to a new task: ${task.name}`
        }
      });
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { name, assigneeId, dueDate, content, creativeType, paymentStatus, status, priority, description, order } = req.body;
    const existingTask = await prisma.plakyTask.findUnique({ where: { id: req.params.id as string } });

    const task = await prisma.plakyTask.update({
      where: { id: req.params.id as string },
      data: {
        name,
        assigneeId,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        content,
        creativeType,
        paymentStatus,
        status,
        priority,
        description,
        customFields: req.body.customFields,
        order,
      },
    });

    if (existingTask) {
      if (assigneeId && existingTask.assigneeId !== assigneeId) {
        await prisma.notification.create({
          data: {
            employeeId: assigneeId,
            type: 'task',
            message: `You have been assigned to task: ${task.name}`
          }
        });
      }
      if (status && existingTask.status !== status && task.assigneeId) {
        await prisma.notification.create({
          data: {
            employeeId: task.assigneeId,
            type: 'task',
            message: `Task "${task.name}" status changed to ${status}`
          }
        });
      }
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    await prisma.plakyTask.delete({ where: { id: req.params.id as string } });
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
