import { Router } from 'express';
import {
  AuthServiceError,
  INSTALLATION_AUTH_ALGORITHM,
} from '../security/installationAuth';
import { installationAuthService } from '../security/runtime';
import { safeString } from '../validation/requests';
import {
  rateLimitChallenge,
  rateLimitRegistration,
} from '../middleware/rateLimit';

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

authRouter.post('/register', rateLimitRegistration, async (req, res) => {
  try {
    const publicKey = safeString(req.body?.publicKey, 1024);
    const algorithm = safeString(req.body?.algorithm, 64);
    if (!publicKey || !algorithm) {
      return res.status(400).json({
        error: 'INVALID_REGISTRATION',
        message: 'Invalid registration request.',
      });
    }

    const registration = await installationAuthService.register(
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

authRouter.post('/challenge', rateLimitChallenge, async (req, res) => {
  try {
    const installationId = safeString(req.body?.installationId, 80);
    if (!installationId) {
      return res.status(400).json({
        error: 'INVALID_CHALLENGE_REQUEST',
        message: 'Invalid authentication request.',
      });
    }

    return res.json(
      await installationAuthService.issueChallenge(installationId)
    );
  } catch (error) {
    return sendAuthError(res, error);
  }
});

authRouter.post('/verify', rateLimitChallenge, async (req, res) => {
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
      await installationAuthService.verifyChallenge(
        installationId,
        challengeId,
        signature
      )
    );
  } catch (error) {
    return sendAuthError(res, error);
  }
});
