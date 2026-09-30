import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { safeString } from '../validation/requests';

export function tokenMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function requireApiToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SPENDWISE_API_TOKEN?.trim();

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'AI_NOT_CONFIGURED',
        message: 'AI service access is not configured.',
      });
    }
    return next();
  }

  const supplied = safeString(req.header('x-spendwise-token'), 512);
  if (!supplied || !tokenMatches(supplied, expected)) {
    return res.status(401).json({
      error: 'API_UNAUTHORIZED',
      message: 'Unauthorized.',
    });
  }

  return next();
}
