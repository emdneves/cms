import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware to require admin role
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    const token = auth.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        if (!decoded || typeof decoded !== 'object' || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
        return;
    } catch {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

// Helper to get user ID from JWT token
export const getUserFromToken = (req: Request): number | null => {
    const auth = req.headers.authorization;
    if (!auth) return null;
    
    try {
        const token = auth.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return typeof decoded === 'object' && decoded.id ? decoded.id : null;
    } catch {
        return null;
    }
}; 