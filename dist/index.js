"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("./routes/auth"));
const employees_1 = __importDefault(require("./routes/employees"));
const departments_1 = __importDefault(require("./routes/departments"));
const timeLog_1 = __importDefault(require("./routes/timeLog"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const leaves_1 = __importDefault(require("./routes/leaves"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const meetings_1 = __importDefault(require("./routes/meetings"));
const plaky_1 = __importDefault(require("./routes/plaky"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Public routes
app.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.url);
    next();
});
app.use('/api/auth', auth_1.default);
// Protected routes (handled inside each file)
app.use('/api/employees', employees_1.default);
app.use('/api/departments', departments_1.default);
app.use('/api/time-logs', timeLog_1.default);
app.use('/api/attendance', attendance_1.default);
app.use('/api/leaves', leaves_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/meetings', meetings_1.default);
app.use('/api/plaky', plaky_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'gc-project-backend is running',
        version: 'v2-nov4-comments',
        timestamp: new Date().toISOString()
    });
});
// Temporary debug endpoint to inspect leave data
app.get('/api/debug-leave/:id', async (req, res) => {
    try {
        const leave = await prisma.leaveRequest.findUnique({
            where: { id: req.params.id },
            include: { employee: true }
        });
        res.json({ leave });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
setInterval(() => {
    // Keep process alive
}, 1000 * 60 * 60);
