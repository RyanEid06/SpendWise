import { randomUUID } from 'crypto';
import { boundedLog } from '../observability/safeLogging';
import type { AttemptEvent } from '../geminiReliability';

export function aiRequestId(): string {
  return randomUUID();
}

export function logAiFailure(details: AttemptEvent) {
  // Deliberately metadata-only: never attach financial request bodies or provider secrets.
  boundedLog('AI', {
    endpoint: details.endpoint, requestId: details.requestId, attempt: details.attempt,
    code: details.code, elapsedMs: details.elapsedMs, willRetry: details.willRetry,
    model: details.model, attemptMs: details.attemptMs, remainingMs: details.remainingMs,
    retryDelayMs: details.retryDelayMs, upstreamStatus: details.upstreamStatus, networkClass: details.networkClass,
  });
}
