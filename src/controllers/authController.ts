import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Helper to log activities
async function logActivity(userId: number | null, action: string, target: string, targetId?: string, metadata?: any) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, target, target_id, metadata) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, target, targetId, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    console.error('[ACTIVITY LOG] Error logging activity:', error);
  }
}

export const register = async (req: Request, res: Response) => {
  console.log('[REGISTER] Incoming request:', req.body);
  const { email, password, role, first_name, last_name } = req.body;
  if (!email || !password || !role || !first_name || !last_name) {
    console.log('[REGISTER] Missing fields');
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  if (!['admin', 'user'].includes(role)) {
    console.log('[REGISTER] Invalid role:', role);
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO users (email, password, role, first_name, last_name, is_active, created_at, updated_at, last_login) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW(), NOW())',
      [email, hash, role, first_name, last_name]
    );
    console.log('[REGISTER] User created:', email, role);
    res.json({ success: true });
    return;
  } catch (e) {
    console.error('[REGISTER] Error:', e);
    res.status(400).json({ error: 'User exists' });
    return;
  }
};

export const login = async (req: Request, res: Response) => {
  console.log('[LOGIN] Incoming request:', req.body);
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('[LOGIN] Query result:', result.rows);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log('[LOGIN] Invalid credentials for:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    // Update last_login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('[LOGIN] Success for:', email, 'role:', user.role);
    
    // Log the login activity
    await logActivity(user.id, 'login', 'user', user.id.toString(), { email: user.email, role: user.role });
    
    res.json({
      token,
      role: user.role,
      user: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: new Date().toISOString()
    });
    return;
  } catch (e) {
    console.error('[LOGIN] Error:', e);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
}; 