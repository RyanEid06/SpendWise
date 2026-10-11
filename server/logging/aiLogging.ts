import { randomUUID } from 'crypto';
import { boundedLog } from '../observability/safeLogging';
import type { AttemptEvent } from '../geminiReliability';
import { deploymentVersion } from '../deploymentVersion';

export function aiRequestId(candidate?: unknown): string {
  return typeof candidate === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(candidate) ? candidate : randomUUID();
}

export function logAiFailure(details: AttemptEvent) {
  // Deliberately metadata-only: never attach financial request bodies or provider secrets.
  boundedLog('AI', {
    endpoint: details.endpoint, requestId: details.requestId, attempt: details.attempt,
    code: details.code, elapsedMs: details.elapsedMs, willRetry: details.willRetry,
    model: details.model, attemptMs: details.attemptMs, remainingMs: details.remainingMs,
    retryDelayMs: details.retryDelayMs, upstreamStatus: details.upstreamStatus, networkClass: details.networkClass,
    version: deploymentVersion(), fallbackUsed: details.fallbackUsed,
    timeoutStage: details.code === 'AI_TIMEOUT' ? 'provider_attempt' : details.code === 'AI_DEADLINE_EXCEEDED' ? 'operation' : 'none',
  });
}
