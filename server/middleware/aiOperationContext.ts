import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { boundedLog } from '../observability/safeLogging';
import { serverConfig } from '../config';
import { createAiFailure } from '../geminiReliability';
import { sendAiFailure } from './errors';

// Compatible with WP35.1: reuse its res.locals.requestId when present.
export const aiOperationContext: RequestHandler = (req, res, next) => {
  const candidate = res.locals.requestId ?? req.header('X-Request-ID');
  const requestId = typeof candidate === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(candidate) ? candidate : randomUUID();
  res.locals.requestId = requestId; res.setHeader('X-Request-ID', requestId);
  const controller = new AbortController(); res.locals.aiSignal = controller.signal;
  const started = performance.now();
  res.locals.aiDeadline = started + serverConfig.geminiOperationBudgetMs;
  const timer = setTimeout(() => {
    const failure = createAiFailure('AI_DEADLINE_EXCEEDED');
    controller.abort(failure);
    boundedLog('API', { route: req.originalUrl, requestId, phase: 'operation_deadline', outcome: 'aborted', code: failure.code, elapsedMs: performance.now() - started });
    // express.json does not consume the provider's AbortSignal. Stop receiving
    // a stalled upload and flush the stable error before closing its connection.
    req.pause();
    res.once('finish', () => { if (!req.complete) req.destroy(); });
    if (!res.headersSent && !res.writableEnded && !res.destroyed) {
      res.setHeader('Connection', 'close');
      sendAiFailure(res, failure);
    } else if (!res.writableEnded) {
      res.destroy();
    }
  }, serverConfig.geminiOperationBudgetMs);
  const close = () => {
    if (!res.writableFinished) {
      controller.abort(createAiFailure('AI_CANCELLED'));
      boundedLog('API', { route: req.originalUrl, requestId, phase: 'client_disconnect', outcome: 'aborted', code: 'AI_CANCELLED', elapsedMs: performance.now() - started });
    }
    clearTimeout(timer); res.off('close', close); res.off('finish', finish);
  };
  const finish = () => { clearTimeout(timer); res.off('close', close); res.off('finish', finish); };
  res.once('close', close); res.once('finish', finish); next();
};
