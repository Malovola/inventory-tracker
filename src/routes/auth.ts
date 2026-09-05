import { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';
import { hashPassword, comparePassword, generateToken } from '../services/authService';
import { registerSchema, loginSchema } from '../schemas/auth';
import { validateBody } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, display_name, role, business_id, business_name } = req.body;

    let assignedBusinessId = business_id;

    // If business_name is provided, create a new business first
    if (!assignedBusinessId && business_name) {
      const bizRes = await pool.query(
        'INSERT INTO businesses (name) VALUES ($1) RETURNING id',
        [business_name]
      );
      assignedBusinessId = bizRes.rows[0].id;
    }

    // Default to the first business if none specified
    if (!assignedBusinessId) {
      const defaultBiz = await pool.query('SELECT id FROM businesses ORDER BY created_at ASC LIMIT 1');
      if (defaultBiz.rows.length === 0) {
        const createDefault = await pool.query("INSERT INTO businesses (name) VALUES ('HQ Convenience Store') RETURNING id");
        assignedBusinessId = createDefault.rows[0].id;
      } else {
        assignedBusinessId = defaultBiz.rows[0].id;
      }
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'A user with this email address already exists.' });
      return;
    }

    // Hash password and insert
    const passwordHash = await hashPassword(password);
    const userRes = await pool.query(
      `INSERT INTO users (business_id, email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, business_id, email, display_name, role, created_at`,
      [assignedBusinessId, email.toLowerCase(), passwordHash, display_name, role || 'cashier']
    );

    const user = userRes.rows[0];
    const token = generateToken({
      userId: user.id,
      businessId: user.business_id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        businessId: user.business_id,
      },
    });
  } catch (error: any) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Registration failed due to an internal error.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const userRes = await pool.query(
      `SELECT u.id, u.business_id, u.email, u.password_hash, u.display_name, u.role, b.name as business_name
       FROM users u
       JOIN businesses b ON u.business_id = b.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = userRes.rows[0];
    const passwordValid = await comparePassword(password, user.password_hash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      businessId: user.business_id,
      email: user.email,
      role: user.role,
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        businessId: user.business_id,
        businessName: user.business_name,
      },
    });
  } catch (error: any) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed due to an internal error.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userRes = await pool.query(
      `SELECT u.id, u.business_id, u.email, u.display_name, u.role, b.name as business_name
       FROM users u
       JOIN businesses b ON u.business_id = b.id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userRes.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      businessId: user.business_id,
      businessName: user.business_name,
    });
  } catch (error) {
    console.error('Failed to get current user:', error);
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});
