import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest, revokedTokens } from '../middleware/auth';
import nodemailer from 'nodemailer';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'wearegoalcreatives@gmail.com',
    pass: process.env.EMAIL_PASS || ''
  }
});

router.post('/signup/request', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const existingUser = await prisma.employee.findUnique({ where: { email } });
    if (existingUser) {
      if (existingUser.status !== 'Unverified') {
        return res.status(400).json({ error: 'Email already in use' });
      }
      // If unverified, we can resend OTP and overwrite the old one
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (existingUser && existingUser.status === 'Unverified') {
      await prisma.employee.update({
        where: { email },
        data: { firstName, lastName, passwordHash, otpCode, otpExpiry }
      });
    } else {
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

    // Send the email
    const mailOptions = {
      from: process.env.EMAIL_USER || 'wearegoalcreatives@gmail.com',
      to: email,
      subject: 'GC Studio - Verify your Email',
      text: `Hello ${firstName},\n\nYour One-Time Password (OTP) is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\nThank you!`
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.error('Error sending email:', emailErr);
      return res.status(500).json({ error: 'Failed to send OTP email. Please try again later.' });
    }

    res.json({ message: 'OTP sent to email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to request sign up' });
  }
});

router.post('/signup/verify', async (req, res) => {
  const { email, otp } = req.body;
  try {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

router.post('/forgot-password/request', async (req, res) => {
  const { email } = req.body;
  try {
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

    const mailOptions = {
      from: process.env.EMAIL_USER || 'wearegoalcreatives@gmail.com',
      to: email,
      subject: 'GC Studio - Password Reset',
      text: `Hello ${employee.firstName},\n\nYour password reset OTP is: ${otpCode}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.error('Error sending email:', emailErr);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
    }

    res.json({ message: 'If that email exists, an OTP has been sent.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to request password reset' });
  }
});

router.post('/forgot-password/reset', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
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
    const isSamePassword = await bcrypt.compare(newPassword, employee.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password cannot be the same as your old password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.employee.update({
      where: { email },
      data: {
        passwordHash,
        otpCode: null,
        otpExpiry: null
      }
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) return res.status(400).json({ error: 'Invalid credentials' });

    if (employee.status === 'Unverified') {
      return res.status(403).json({ error: 'Account is unverified. Please verify your email.' });
    }

    if (employee.status === 'Pending' || employee.role === 'Pending') {
      return res.status(403).json({ error: 'Account is pending approval by an Admin' });
    }

    const validPassword = employee.passwordHash === 'dummy' ? (password === 'dummy') : await bcrypt.compare(password, employee.passwordHash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: employee.id, role: employee.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, employee });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.user?.id } });
    if (!employee) return res.status(404).json({ error: 'User not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', authenticateToken, (req: AuthRequest, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    revokedTokens.add(token);
  }
  res.json({ success: true });
});

router.get('/check', authenticateToken, (req: AuthRequest, res) => {
  res.json({ success: true });
});

export default router;
