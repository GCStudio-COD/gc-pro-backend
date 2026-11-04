"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const routerWithAuth = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
routerWithAuth.use(auth_1.authenticateToken);
// Start a timer for a task
routerWithAuth.post('/start', async (req, res) => {
    const { taskId, timestamp } = req.body;
    const employeeId = req.user.id;
    try {
        const timeLog = await prisma.timeLog.create({
            data: {
                employeeId,
                plakyTaskId: taskId || null,
                startTime: timestamp ? new Date(timestamp) : new Date()
            }
        });
        if (taskId) {
            // Update task status to "In Progress" if it's started
            await prisma.plakyTask.update({
                where: { id: taskId },
                data: { status: 'In Progress' }
            });
        }
        res.json({ timeLogId: timeLog.id });
    }
    catch (error) {
        console.error('Error starting time log:', error);
        res.status(500).json({ error: 'Failed to start timer' });
    }
});
// Stop a timer
routerWithAuth.post('/stop', async (req, res) => {
    const { timeLogId, timestamp } = req.body;
    try {
        const timeLog = await prisma.timeLog.findUnique({ where: { id: timeLogId } });
        if (!timeLog) {
            return res.status(404).json({ error: 'Time log not found' });
        }
        const endTime = timestamp ? new Date(timestamp) : new Date();
        const durationSeconds = Math.floor((endTime.getTime() - timeLog.startTime.getTime()) / 1000);
        const updatedLog = await prisma.timeLog.update({
            where: { id: timeLogId },
            data: {
                endTime,
                durationSeconds
            },
            include: {
                plakyTask: true
            }
        });
        res.json(updatedLog);
    }
    catch (error) {
        console.error('Error stopping time log:', error);
        res.status(500).json({ error: 'Failed to stop timer' });
    }
});
// Get user's time logs
routerWithAuth.get('/', async (req, res) => {
    const employeeId = req.user.id;
    try {
        const logs = await prisma.timeLog.findMany({
            where: { employeeId, durationSeconds: { not: null } },
            include: { plakyTask: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(logs);
    }
    catch (error) {
        console.error('Error fetching time logs:', error);
        res.status(500).json({ error: 'Failed to fetch time logs' });
    }
});
// Get total time spent on a task (for Admin)
router.get('/task/:taskId', async (req, res) => {
    const { taskId } = req.params;
    try {
        const logs = await prisma.timeLog.findMany({
            where: { plakyTaskId: taskId, durationSeconds: { not: null } }
        });
        res.json(logs); // We return the logs array like the frontend task view expects
    }
    catch (error) {
        console.error('Error fetching task time logs:', error);
        res.status(500).json({ error: 'Failed to fetch task times' });
    }
});
// Export a router that combines both
const mainRouter = (0, express_1.Router)();
mainRouter.use('/', router);
mainRouter.use('/', routerWithAuth);
exports.default = mainRouter;
