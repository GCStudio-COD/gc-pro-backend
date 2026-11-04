"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const email_1 = require("../lib/email");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
router.post('/signup/request', async (req, res) => {
    let { firstName, lastName, email, password, fullname, fullName, name } = req.body || {};
    try {
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        if (!password || typeof password !== 'string' || !password.trim()) {
            return res.status(400).json({ error: 'Password is required' });
        }
        email = email.trim().toLowerCase();
        if (!firstName) {
            const full = (fullname || fullName || name || '').trim();
            if (full) {
                const parts = full.split(' ');
                firstName = parts[0];
                lastName = parts.slice(1).join(' ') || '-';
            }
        }
        if (!firstName) {
            firstName = email ? email.split('@')[0] : 'User';
        }
        if (!lastName) {
            lastName = '-';
        }
        const existingUser = await prisma.employee.findUnique({ where: { email } });
        if (existingUser) {
            if (existingUser.status !== 'Unverified') {
                return res.status(400).json({ error: 'Email already in use' });
            }
            // If unverified, we can resend OTP and overwrite the old one
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        if (existingUser && existingUser.status === 'Unverified') {
            await prisma.employee.update({
                where: { email },
                data: { firstName, lastName, passwordHash, otpCode, otpExpiry }
            });
        }
        else {
            await prisma.employee.create({
                data: {
                    firstName,
                    lastName,
                    email,
                    passwordHash,
                    role: 'Pending',
                    status: 'Unverified',
                    otpCode,
                    otpExpiry
                }
            });
        }
        // Send the email via Brevo / Nodemailer
        try {
            await (0, email_1.sendEmail)({
                to: email,
                subject: 'GC Studio - Verify your Email',
                text: `Hello ${firstName},\n\nYour One-Time Password (OTP) is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\nThank you!`,
                recipientName: firstName
            });
        }
        catch (emailErr) {
            console.error('Error sending OTP email:', emailErr);
            return res.status(500).json({
                error: 'Failed to send OTP email. Please try again later.',
                details: emailErr?.message || String(emailErr)
            });
        }
        res.json({ message: 'OTP sent to email.' });
    }
    catch (error) {
        console.error('Signup request error:', error);
        res.status(500).json({ error: 'Failed to request sign up. Internal error.' });
    }
});
router.post('/signup/verify', async (req, res) => {
    let { email, otp } = req.body || {};
    try {
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }
        email = email.trim().toLowerCase();
        otp = String(otp).trim();
        const employee = await prisma.employee.findUnique({ where: { email } });
        if (!employee || employee.status !== 'Unverified') {
            return res.status(400).json({ error: 'Invalid request or user already verified.' });
        }
        if (employee.otpCode !== otp) {
            return res.status(400).json({ error: 'Invalid OTP.' });
        }
        if (!employee.otpExpiry || new Date() > employee.otpExpiry) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }
        // Verified! Set to Pending
        const updatedEmployee = await prisma.employee.update({
            where: { email },
            data: {
                status: 'Pending',
                otpCode: null,
                otpExpiry: null
            }
        });
        // Notify admins and PMs
        await prisma.notification.createMany({
            data: [
                { targetRole: 'admin', message: `New user registration pending approval: ${employee.firstName} ${employee.lastName}`, type: 'system' },
                { targetRole: 'project-manager', message: `New user registration pending approval: ${employee.firstName} ${employee.lastName}`, type: 'system' }
            ]
        });
        res.json({ message: 'Account verified successfully. Pending Admin approval.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});
router.post('/forgot-password/request', async (req, res) => {
    let { email } = req.body || {};
    try {
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ error: 'Valid email is required' });
        }
        email = email.trim().toLowerCase();
        const employee = await prisma.employee.findUnique({ where: { email } });
        if (!employee) {
            // Return success even if not found to prevent email enumeration
            return res.json({ message: 'If that email exists, an OTP has been sent.' });
        }
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await prisma.employee.update({
            where: { email },
            data: { otpCode, otpExpiry }
        });
        // Send the email via Brevo / Nodemailer
        try {
            await (0, email_1.sendEmail)({
                to: email,
                subject: 'GC Studio - Password Reset',
                text: `Hello ${employee.firstName},\n\nYour password reset OTP is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
                recipientName: employee.firstName
            });
        }
        catch (emailErr) {
            console.error('Error sending reset email:', emailErr);
            return res.status(500).json({
                error: 'Failed to send reset email. Please try again later.',
                details: emailErr?.message || String(emailErr)
            });
        }
        res.json({ message: 'If that email exists, an OTP has been sent.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to request password reset' });
    }
});
router.post('/forgot-password/reset', async (req, res) => {
    let { email, otp, newPassword } = req.body || {};
    try {
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }
        email = email.trim().toLowerCase();
        otp = String(otp).trim();
        const employee = await prisma.employee.findUnique({ where: { email } });
        if (!employee) {
            return res.status(400).json({ error: 'Invalid request.' });
        }
        if (employee.otpCode !== otp) {
            return res.status(400).json({ error: 'Invalid OTP.' });
        }
        if (!employee.otpExpiry || new Date() > employee.otpExpiry) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }
        // Check if new password is the same as the old password
        const isSamePassword = await bcryptjs_1.default.compare(newPassword, employee.passwordHash);
        if (isSamePassword) {
            return res.status(400).json({ error: 'New password cannot be the same as your old password.' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(newPassword, salt);
        await prisma.employee.update({
            where: { email },
            data: {
                passwordHash,
                otpCode: null,
                otpExpiry: null
            }
        });
        res.json({ message: 'Password reset successfully. You can now log in.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});
router.post('/login', async (req, res) => {
    let { email, password } = req.body || {};
    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        email = email.trim().toLowerCase();
        const employee = await prisma.employee.findUnique({ where: { email } });
        if (!employee)
            return res.status(400).json({ error: 'Invalid credentials' });
        if (employee.status === 'Unverified') {
            return res.status(403).json({ error: 'Account is unverified. Please verify your email.' });
        }
        if (employee.status === 'Pending' || employee.role === 'Pending') {
            return res.status(403).json({ error: 'Account is pending approval by an Admin' });
        }
        const validPassword = employee.passwordHash === 'dummy' ? (password === 'dummy') : await bcryptjs_1.default.compare(password, employee.passwordHash);
        if (!validPassword)
            return res.status(400).json({ error: 'Invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ id: employee.id, role: employee.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, employee });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to log in' });
    }
});
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const employee = await prisma.employee.findUnique({ where: { id: req.user?.id } });
        if (!employee)
            return res.status(404).json({ error: 'User not found' });
        res.json(employee);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/logout', auth_1.authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        auth_1.revokedTokens.add(token);
    }
    res.json({ success: true });
});
router.get('/check', auth_1.authenticateToken, (req, res) => {
    res.json({ success: true });
});
exports.default = router;
