import { NextFunction, Request, Response } from 'express';
import { serverConfig } from '../config';

export function requireHttpsProduction(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (serverConfig.production && !req.secure) {
    return res.status(400).json({
      error: 'HTTPS_REQUIRED',
      message: 'HTTPS is required.',
    });
  }
  return next();
}

export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  if (serverConfig.production && req.secure) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  return next();
}
