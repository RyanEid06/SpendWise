import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { boundedLog } from './safeLogging';
import { normalizeRoute, operationalAggregates, type OperationalAggregates } from './aggregates';

export function observeApiRequests(metrics: OperationalAggregates = operationalAggregates, emit?: (event: unknown) => void): RequestHandler {
  return (req, res, next) => {
    const start = performance.now(); const route = normalizeRoute(req.originalUrl);
    const supplied = req.header('X-Request-ID');
    const requestId = typeof supplied === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(supplied) ? supplied : randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.locals.requestId = requestId;
    const phase = route === '/api/health' ? 'readiness' : route === '/api/auth/register' ? 'register'
      : route === '/api/auth/challenge' ? 'challenge' : route === '/api/auth/verify' ? 'verify' : route.startsWith('/api/gemini/') ? 'ai_dispatch' : undefined;
    let code: unknown;
    if (phase) boundedLog('API', { route, requestId, phase, outcome: 'start' }, emit);
    const json = res.json;
    res.json = function(body: unknown) {
      try {
        if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
          code = (body as { error?: unknown }).error;
          metrics.recordFailure(typeof code === 'string' && code.startsWith('Invalid ') || typeof code === 'string' && code.startsWith('Unsupported ') ? 'INVALID_REQUEST' : code);
        }
      } catch {}
      return json.call(this, body);
    };
    let done = false;
    const finish = () => complete(false);
    const close = () => complete(!res.writableFinished);
    const complete = (aborted: boolean) => {
      if (done) return; done = true;
      res.off('finish', finish); res.off('close', close);
      try { metrics.recordRequest(route, res.statusCode, performance.now() - start, aborted); } catch {}
      if (phase) boundedLog('API', { route, requestId, phase: aborted ? 'client_disconnect' : phase,
        outcome: aborted ? 'aborted' : res.statusCode >= 400 ? 'failure' : 'success', code, elapsedMs: performance.now() - start }, emit);
    };
    res.once('finish', finish); res.once('close', close); next();
  };
}
