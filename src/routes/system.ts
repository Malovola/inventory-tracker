import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPairingInfo, getAvailableNetworkIps } from '../services/networkService';

export const systemRouter = Router();

// GET /api/system/pairing-info - Get pairing info for wireless phone scanner
systemRouter.get('/pairing-info', (req: Request, res: Response) => {
  let token = req.query.token as string | undefined;

  // Fallback to Bearer token if present
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  const info = getPairingInfo(token);
  res.json(info);
});

// GET /api/system/network - List available network interfaces
systemRouter.get('/network', (_req: Request, res: Response) => {
  const ips = getAvailableNetworkIps();
  res.json({ interfaces: ips });
});
