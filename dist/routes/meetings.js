"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
    const { date } = req.query;
    const employeeId = req.user.id;
    const role = req.user.role;
    try {
        let filters = {};
        if (date) {
            // Find meetings on this date
            const queryDate = new Date(date);
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
    }
    catch (error) {
        console.error('Error fetching meetings:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/', async (req, res) => {
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
                    connect: participantsIds?.map((id) => ({ id })) || []
                }
            },
            include: {
                organizer: true,
                participants: true
            }
        });
        res.json(meeting);
    }
    catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
