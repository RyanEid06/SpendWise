import { randomUUID } from 'crypto';
import { boundedLog } from '../observability/safeLogging';

export function aiRequestId(candidate?: unknown): string {
  return typeof candidate === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(candidate) ? candidate : randomUUID();
}

export function logAiFailure(details: {
  endpoint: string;
  requestId: string;
  attempt: number;
  code: string;
  elapsedMs: number;
  willRetry: boolean;
}) {
  // Deliberately metadata-only: never attach financial request bodies or provider secrets.
  boundedLog('AI', {
    endpoint: details.endpoint,
    requestId: details.requestId,
    attempt: details.attempt,
    code: details.code,
    elapsedMs: details.elapsedMs,
    willRetry: details.willRetry,
  });
}
