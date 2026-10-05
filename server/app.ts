import express from 'express';
import { observeApiRequests } from './observability/requestObservability';
import { apiCors } from './middleware/cors';
import { requireInstallationAccess } from './middleware/authentication';
import { rateLimitGemini } from './middleware/rateLimit';
import {
  boundedAiJsonBody,
  boundedAuthJsonBody,
  enforceParsedBodyLimit,
} from './middleware/requestLimits';
import {
  requireHttpsProduction,
  securityHeaders,
} from './middleware/networkSecurity';
import { apiErrorHandler } from './middleware/errors';
import { serverConfig } from './config';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { analysisRouter } from './routes/analysis';
import { trendsRouter } from './routes/trends';
import { smartCaptureRouter } from './routes/smartCapture';
import { receiptScanRouter } from './routes/receiptScan';

export function createServerApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use('/api', observeApiRequests());
  app.use('/api', requireHttpsProduction, securityHeaders, apiCors);

  app.use('/api/auth', boundedAuthJsonBody, authRouter);
  app.use('/api', healthRouter);

  // Authenticate and enforce quotas before paying the cost of parsing
  // a potentially large AI request body.
  app.use(
    '/api/gemini',
    requireInstallationAccess,
    rateLimitGemini,
    boundedAiJsonBody
  );

  app.use(
    '/api/gemini/analyze',
    enforceParsedBodyLimit(serverConfig.maxFinancialJsonBodyBytes)
  );
  app.use(
    '/api/gemini/explain-trends',
    enforceParsedBodyLimit(serverConfig.maxFinancialJsonBodyBytes)
  );

  app.use('/api/gemini', analysisRouter);
  app.use('/api/gemini', trendsRouter);
  app.use('/api/gemini', smartCaptureRouter);
  app.use('/api/gemini', receiptScanRouter);

  app.use('/api', apiErrorHandler);
  return app;
}
