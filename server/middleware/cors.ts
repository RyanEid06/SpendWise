import { NextFunction, Request, Response } from 'express';
import { serverConfig } from '../config';

export function isSameOrigin(origin: string, req: Request): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.host === req.get('host');
  } catch {
    return false;
  }
}

export function apiCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.header('origin');

  if (origin) {
    const allowed = serverConfig.allowedOrigins.has(origin) || isSameOrigin(origin, req);
    if (!allowed) {
      return res.status(403).json({ error: 'Origin is not allowed.' });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,X-SpendWise-Token'
    );
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}
