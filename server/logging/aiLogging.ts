import { randomUUID } from 'crypto';
import { boundedLog } from '../observability/safeLogging';

export function aiRequestId(): string {
  return randomUUID();
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
