import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { serverConfig } from '../config';
import { AuthServiceError } from '../security/installationAuth';
import { installationAuthService } from '../security/runtime';

export interface SpendWiseAuthContext {
  installationId: string;
  legacy: boolean;
}

type AuthenticatedRequest = Request & {
  spendwiseAuth?: SpendWiseAuthContext;
};

export function tokenMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function bearerToken(req: Request): string | null {
  const value = req.header('authorization')?.trim() || '';
  const match = /^Bearer\s+([^\s]{32,512})$/i.exec(value);
  return match?.[1] || null;
}

export function getAuthenticatedInstallationId(req: Request): string | null {
  return (req as AuthenticatedRequest).spendwiseAuth?.installationId || null;
}

export function isLegacyAuthenticated(req: Request): boolean {
  return (req as AuthenticatedRequest).spendwiseAuth?.legacy === true;
}

export function requireInstallationAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const bearer = bearerToken(req);
  if (bearer) {
    try {
      const installation = installationAuthService.validateAccessToken(bearer);
      (req as AuthenticatedRequest).spendwiseAuth = {
        installationId: installation.id,
        legacy: false,
      };
      return next();
    } catch (error) {
      const code =
        error instanceof AuthServiceError
          ? error.code
          : 'INVALID_ACCESS_TOKEN';
      return res.status(401).json({
        error: code,
        message: 'Authentication required.',
      });
    }
  }

  // Transitional compatibility only for already-installed pre-WP31 clients.
  // New clients never send or depend on this APK-extractable credential.
  const legacy = serverConfig.legacyApiToken;
  const suppliedLegacy = req.header('x-spendwise-token')?.trim() || '';
  if (
    legacy &&
    suppliedLegacy &&
    tokenMatches(suppliedLegacy, legacy)
  ) {
    (req as AuthenticatedRequest).spendwiseAuth = {
      installationId: 'legacy-compat',
      legacy: true,
    };
    res.setHeader('Deprecation', 'true');
    res.setHeader('X-SpendWise-Legacy-Auth', 'deprecated');
    if (serverConfig.legacyCompatibilityUntil) {
      res.setHeader('Sunset', serverConfig.legacyCompatibilityUntil);
    }
    return next();
  }

  return res.status(401).json({
    error: 'API_UNAUTHORIZED',
    message: 'Authentication required.',
  });
}

// WP27 compatibility alias. The implementation is now installation-scoped.
export const requireApiToken = requireInstallationAccess;
