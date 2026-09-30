import { Router } from 'express';
import { serverConfig } from '../config';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  return res.json({
    ok: true,
    model: serverConfig.geminiModel,
    fallbackModel: serverConfig.geminiFallbackModels[0] || null,
    fallbackModels: serverConfig.geminiFallbackModels,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    accessProtected: Boolean(process.env.SPENDWISE_API_TOKEN?.trim()),
    aiTimeoutMs: serverConfig.geminiTimeoutMs,
  });
});
