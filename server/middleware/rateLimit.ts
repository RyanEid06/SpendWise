import { NextFunction, Request, Response } from 'express';
import { cleanupRateBuckets } from '../geminiReliability';
import { serverConfig } from '../config';

export interface RateBucket {
  count: number;
  resetAt: number;
}

export function consumeRateLimit(
  buckets: Map<string, RateBucket>,
  key: string,
  now: number,
  windowMs: number,
  limit: number
): { allowed: boolean; retryAfterSeconds?: number } {
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true };
}

const rateBuckets = new Map<string, RateBucket>();
let rateLimitRequestCount = 0;

export function rateLimitGemini(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  rateLimitRequestCount += 1;
  if (
    rateLimitRequestCount % 64 === 0 ||
    rateBuckets.size > serverConfig.rateBucketMaxEntries
  ) {
    cleanupRateBuckets(rateBuckets, now, serverConfig.rateBucketMaxEntries);
  }

  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const result = consumeRateLimit(
    rateBuckets,
    key,
    now,
    serverConfig.rateWindowMs,
    serverConfig.rateLimit
  );

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    return res.status(429).json({
      error: 'AI_RATE_LIMITED',
      message: 'Too many AI requests. Please try again shortly.',
    });
  }

  return next();
}
