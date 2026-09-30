import { Router } from 'express';
import { serverConfig } from '../config';
import {
  AuthServiceError,
  FileInstallationRegistry,
  INSTALLATION_AUTH_ALGORITHM,
  InstallationAuthService,
} from '../security/installationAuth';
import { safeString } from '../validation/requests';
import {
  rateLimitChallenge,
  rateLimitRegistration,
} from '../middleware/rateLimit';

export const installationRegistry = new FileInstallationRegistry(
  serverConfig.installationStorePath
);
export const installationAuthService = new InstallationAuthService(
  installationRegistry,
  {
    challengeTtlMs: serverConfig.authChallengeTtlMs,
    accessTokenTtlMs: serverConfig.accessTokenTtlMs,
    deniedInstallationIds: serverConfig.deniedInstallationIds,
  }
);

function sendAuthError(res: any, error: unknown) {
  if (error instanceof AuthServiceError) {
    return res.status(error.httpStatus).json({
      error: error.code,
      message:
        error.httpStatus >= 500
          ? 'Authentication service unavailable.'
          : 'Authentication request rejected.',
    });
  }
  return res.status(500).json({
    error: 'AUTH_SERVICE_ERROR',
    message: 'Authentication service unavailable.',
  });
}

export const authRouter = Router();

authRouter.post('/register', rateLimitRegistration, (req, res) => {
  try {
    const publicKey = safeString(req.body?.publicKey, 1024);
    const algorithm = safeString(req.body?.algorithm, 64);
    if (!publicKey || !algorithm) {
      return res.status(400).json({
        error: 'INVALID_REGISTRATION',
        message: 'Invalid registration request.',
      });
    }

    const registration = installationAuthService.register(
      publicKey,
      algorithm
    );
    return res.status(registration.created ? 201 : 200).json({
      installationId: registration.record.id,
      algorithm: INSTALLATION_AUTH_ALGORITHM,
      createdAt: registration.record.createdAt,
    });
  } catch (error) {
    return sendAuthError(res, error);
  }
});

authRouter.post('/challenge', rateLimitChallenge, (req, res) => {
  try {
    const installationId = safeString(req.body?.installationId, 80);
    if (!installationId) {
      return res.status(400).json({
        error: 'INVALID_CHALLENGE_REQUEST',
        message: 'Invalid authentication request.',
      });
    }

    return res.json(
      installationAuthService.issueChallenge(installationId)
    );
  } catch (error) {
    return sendAuthError(res, error);
  }
});

authRouter.post('/verify', rateLimitChallenge, (req, res) => {
  try {
    const installationId = safeString(req.body?.installationId, 80);
    const challengeId = safeString(req.body?.challengeId, 80);
    const signature = safeString(req.body?.signature, 512);
    if (!installationId || !challengeId || !signature) {
      return res.status(400).json({
        error: 'INVALID_PROOF_REQUEST',
        message: 'Invalid authentication proof.',
      });
    }

    return res.json(
      installationAuthService.verifyChallenge(
        installationId,
        challengeId,
        signature
      )
    );
  } catch (error) {
    return sendAuthError(res, error);
  }
});
