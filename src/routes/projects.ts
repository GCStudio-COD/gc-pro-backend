import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: any, res) => {
  const role = req.user.role;
  const employeeId = req.user.id;
  try {
    const filters: any = {};
    if (role === 'employee') {
      filters.employees = {
        some: { id: employeeId }
      };
    }
    
    const taskFilters: any = {};
    if (role === 'employee') {
      taskFilters.assigneeId = employeeId;
    }

    const projects = await prisma.project.findMany({ 
      where: filters,
      include: { 
        tasks: { 
          where: taskFilters,
          include: { assignee: true } 
        }, 
        employees: true 
      } 
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req: any, res) => {
  try {
    const creatorId = req.user.id;
    const role = req.user.role;
    
    // Base data
    const data: any = { ...req.body };
    
    // Automatically add the creator to the project if they are an employee
    // so they can see the project they just created.
    if (role === 'employee') {
      data.employees = {
        connect: [{ id: creatorId }]
      };
    }

    const project = await prisma.project.create({ data });

    // Notify admins and PMs
    await prisma.notification.createMany({
      data: [
        { targetRole: 'admin', message: `New project created: ${project.name}`, type: 'project', creatorId },
        { targetRole: 'PM', message: `New project created: ${project.name}`, type: 'project', creatorId }
      ]
    });

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/notes', async (req: any, res) => {
  try {
    const note = await prisma.note.create({
      data: {
        content: req.body.content,
        projectId: req.params.id,
        creatorId: req.user.id
      }
    });
    res.json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(req.params.id);
    
    let project;
    const includeConfig = { 
      tasks: { include: { assignee: true } }, 
      employees: true,
      notes: { include: { creator: true }, orderBy: { createdAt: 'desc' as const } }
    };

    if (isUuid) {
      project = await prisma.project.findUnique({
        where: { id: req.params.id },
        include: includeConfig
      });
    } else {
      const allProjects = await prisma.project.findMany({ select: { id: true, name: true } });
      const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const matchedProject = allProjects.find(p => slugify(p.name) === req.params.id);
      
      if (matchedProject) {
        project = await prisma.project.findUnique({
          where: { id: matchedProject.id },
          include: includeConfig
        });
      }
    }
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


router.delete('/:id', async (req: any, res) => {
  const role = req.user.role;
  if (role !== 'admin' && role !== 'PM' && role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Unauthorized to delete projects' });
  }

  try {
    console.log(`[DELETE PROJECT] Attempting to delete project ${req.params.id} by user ${req.user.id} (${role})`);
    
    // Manually delete related TimeLogs first, then Tasks, then Notes to satisfy foreign key constraints
    await prisma.timeLog.deleteMany({
      where: {
        task: {
          projectId: req.params.id
        }
      }
    });

    await prisma.task.deleteMany({
      where: { projectId: req.params.id }
    });

    await prisma.note.deleteMany({
      where: { projectId: req.params.id }
    });

    await prisma.project.delete({
      where: { id: req.params.id }
    });
    
    console.log(`[DELETE PROJECT] Successfully deleted project ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[DELETE PROJECT] Error deleting project ${req.params.id}:`, error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
