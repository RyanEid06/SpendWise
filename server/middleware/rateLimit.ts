import { NextFunction, Request, Response } from 'express';
import { cleanupRateBuckets } from '../geminiReliability';
import { serverConfig } from '../config';
import { getAuthenticatedInstallationId } from './authentication';
import { logSecurityEvent } from '../logging/securityLogging';

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
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      ),
    };
  }
  existing.count += 1;
  return { allowed: true };
}

const buckets = {
  registrationHour: new Map<string, RateBucket>(),
  registrationDay: new Map<string, RateBucket>(),
  challengeInstallation: new Map<string, RateBucket>(),
  challengeIp: new Map<string, RateBucket>(),
  aiInstallationMinute: new Map<string, RateBucket>(),
  aiIpMinute: new Map<string, RateBucket>(),
  aiInstallationDay: new Map<string, RateBucket>(),
  aiGlobalDay: new Map<string, RateBucket>(),
};

let requestCount = 0;

function sourceIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function consume(
  map: Map<string, RateBucket>,
  key: string,
  now: number,
  windowMs: number,
  limit: number
) {
  requestCount += 1;
  if (
    requestCount % 64 === 0 ||
    map.size > serverConfig.rateBucketMaxEntries
  ) {
    cleanupRateBuckets(
      map,
      now,
      serverConfig.rateBucketMaxEntries
    );
  }
  return consumeRateLimit(map, key, now, windowMs, limit);
}

function rejectRateLimit(
  res: Response,
  result: { retryAfterSeconds?: number },
  event: string,
  scope: string,
  route: string
) {
  res.setHeader('Retry-After', String(result.retryAfterSeconds || 1));
  logSecurityEvent(event, { scope, route });
  return res.status(429).json({
    error: 'AI_RATE_LIMITED',
    message: 'Too many requests. Please try again shortly.',
  });
}

export function rateLimitRegistration(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = Date.now();
  const ip = sourceIp(req);
  const hourly = consume(
    buckets.registrationHour,
    ip,
    now,
    60 * 60_000,
    serverConfig.registrationHourlyLimit
  );
  if (!hourly.allowed) {
    return rejectRateLimit(
      res,
      hourly,
      'registration_rate_limited',
      ip,
      req.path
    );
  }
  const daily = consume(
    buckets.registrationDay,
    ip,
    now,
    24 * 60 * 60_000,
    serverConfig.registrationDailyLimit
  );
  if (!daily.allowed) {
    return rejectRateLimit(
      res,
      daily,
      'registration_daily_limited',
      ip,
      req.path
    );
  }
  return next();
}

export function rateLimitChallenge(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = Date.now();
  const ip = sourceIp(req);
  const installationId =
    typeof req.body?.installationId === 'string'
      ? req.body.installationId.slice(0, 80)
      : 'missing';

  const perInstall = consume(
    buckets.challengeInstallation,
    installationId,
    now,
    serverConfig.challengeWindowMs,
    serverConfig.challengePerInstallationLimit
  );
  if (!perInstall.allowed) {
    return rejectRateLimit(
      res,
      perInstall,
      'challenge_installation_rate_limited',
      installationId,
      req.path
    );
  }

  const perIp = consume(
    buckets.challengeIp,
    ip,
    now,
    serverConfig.challengeWindowMs,
    serverConfig.challengePerIpLimit
  );
  if (!perIp.allowed) {
    return rejectRateLimit(
      res,
      perIp,
      'challenge_ip_rate_limited',
      ip,
      req.path
    );
  }
  return next();
}

export function rateLimitGemini(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const now = Date.now();
  const ip = sourceIp(req);
  const installationId =
    getAuthenticatedInstallationId(req) || 'unauthenticated';

  const checks = [
    {
      map: buckets.aiInstallationMinute,
      key: installationId,
      window: serverConfig.rateWindowMs,
      limit: serverConfig.aiPerInstallationLimit,
      event: 'ai_installation_rate_limited',
      scope: installationId,
    },
    {
      map: buckets.aiIpMinute,
      key: ip,
      window: serverConfig.rateWindowMs,
      limit: serverConfig.aiPerIpLimit,
      event: 'ai_ip_rate_limited',
      scope: ip,
    },
    {
      map: buckets.aiInstallationDay,
      key: installationId,
      window: 24 * 60 * 60_000,
      limit: serverConfig.aiPerInstallationDailyLimit,
      event: 'ai_installation_daily_limited',
      scope: installationId,
    },
    {
      map: buckets.aiGlobalDay,
      key: 'global',
      window: 24 * 60 * 60_000,
      limit: serverConfig.aiGlobalDailyLimit,
      event: 'ai_global_cost_guardrail',
      scope: 'global',
    },
  ];

  for (const check of checks) {
    const result = consume(
      check.map,
      check.key,
      now,
      check.window,
      check.limit
    );
    if (!result.allowed) {
      return rejectRateLimit(
        res,
        result,
        check.event,
        check.scope,
        req.path
      );
    }
  }

  return next();
}
