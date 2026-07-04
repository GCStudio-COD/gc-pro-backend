import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

import { OAuth2Client } from 'google-auth-library';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '541436437556-e9elopqu97qs3083lg3j12c0oce8sv1q.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid Google Token' });

    const email = payload.email;
    const firstName = payload.given_name || 'Google';
    const lastName = payload.family_name || 'User';

    let employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) {
      // Auto promote to SuperAdmin if it's the requested email
      const isSuperAdmin = email === 'wearegoalcreatives@gmail.com';
      employee = await prisma.employee.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash: 'google-sso', // placeholder since they use Google
          role: isSuperAdmin ? 'SuperAdmin' : 'Pending',
          status: isSuperAdmin ? 'Active' : 'Pending'
        }
      });
    }

    // Auto-promote existing account to SuperAdmin just in case
    if (email === 'wearegoalcreatives@gmail.com' && employee.role !== 'SuperAdmin') {
       employee = await prisma.employee.update({
          where: { email },
          data: { role: 'SuperAdmin', status: 'Active' }
       });
    }

    if (employee.status === 'Pending' || employee.role === 'Pending') {
       return res.status(403).json({ error: 'Account is pending approval' });
    }

    const token = jwt.sign({ id: employee.id, role: employee.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, employee });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const existingUser = await prisma.employee.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        role: 'Pending',
        status: 'Pending'
      }
    });

    res.json({ message: 'Account created. Pending approval.', employeeId: employee.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee) return res.status(400).json({ error: 'Invalid credentials' });

    if (employee.status === 'Pending' || employee.role === 'Pending') {
      return res.status(403).json({ error: 'Account is pending approval' });
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

export default router;
