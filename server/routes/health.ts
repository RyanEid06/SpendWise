import { Router } from 'express';
import { serverConfig } from '../config';
import { geminiService } from '../services/GeminiService';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  return res.json({
    ok: true,
    aiConfigured: geminiService.isConfigured(),
    authentication: 'installation-signature-v1',
    legacyCompatibilityEnabled: Boolean(
      serverConfig.legacyApiToken &&
        serverConfig.legacyCompatibilityUntilMs != null &&
        Date.now() < serverConfig.legacyCompatibilityUntilMs
    ),
  });
});
