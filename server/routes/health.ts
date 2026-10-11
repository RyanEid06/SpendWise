import { Router } from 'express';
import { serverConfig } from '../config';
import { geminiService } from '../services/GeminiService';
import { installationRegistry } from '../security/runtime';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try { await installationRegistry.ready(); }
  catch { return res.status(503).json({ ok: false, error: 'AUTH_STORE_UNAVAILABLE' }); }
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
