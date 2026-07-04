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
    if (role === 'employee' || role === 'project-manager') {
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

router.post('/', async (req, res) => {
  try {
    const project = await prisma.project.create({ data: req.body });

    // Notify admins and PMs
    const creatorId = (req as any).user.id;
    await prisma.notification.createMany({
      data: [
        { targetRole: 'admin', message: `New project created: ${project.name}`, type: 'project', creatorId },
        { targetRole: 'project-manager', message: `New project created: ${project.name}`, type: 'project', creatorId }
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


router.delete('/:id', async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
