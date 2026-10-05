import type { RequestHandler } from 'express';
import { normalizeRoute, operationalAggregates, type OperationalAggregates } from './aggregates';

export function observeApiRequests(metrics: OperationalAggregates = operationalAggregates): RequestHandler {
  return (req, res, next) => {
    const start = performance.now(); const route = normalizeRoute(req.originalUrl);
    const json = res.json;
    res.json = function(body: unknown) {
      try {
        if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
          const code = (body as { error?: unknown }).error;
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
    };
    res.once('finish', finish); res.once('close', close); next();
  };
}
