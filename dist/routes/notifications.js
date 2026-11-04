"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.use(auth_1.authenticateToken);
router.get('/', async (req, res) => {
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
    }
    catch (error) {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await prisma.notification.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
