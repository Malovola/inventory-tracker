import type { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/authService';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || !parts[1]) {
    res.status(401).json({ error: 'Unauthorized: Malformed authorization header' });
    return;
  }

  const token = parts[1];
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
}

export function requireRole(...allowedRoles: Array<'owner' | 'manager' | 'cashier'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        error: `Forbidden: Action requires one of the following roles: ${allowedRoles.join(', ')} (Your role: ${req.user.role})` 
      });
      return;
    }

    next();
  };
}
