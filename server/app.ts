import express from 'express';
import { apiCors } from './middleware/cors';
import { requireApiToken } from './middleware/authentication';
import { rateLimitGemini } from './middleware/rateLimit';
import { boundedJsonBody } from './middleware/requestLimits';
import { healthRouter } from './routes/health';
import { analysisRouter } from './routes/analysis';
import { trendsRouter } from './routes/trends';
import { smartCaptureRouter } from './routes/smartCapture';
import { receiptScanRouter } from './routes/receiptScan';

export function createServerApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use('/api', apiCors);
  app.use(boundedJsonBody);
  app.use('/api/gemini', requireApiToken, rateLimitGemini);

  app.use('/api', healthRouter);
  app.use('/api/gemini', analysisRouter);
  app.use('/api/gemini', trendsRouter);
  app.use('/api/gemini', smartCaptureRouter);
  app.use('/api/gemini', receiptScanRouter);

  return app;
}
