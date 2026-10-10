import type { AttemptEvent } from '../geminiReliability';
import { boundedLog } from '../observability/safeLogging';

// Usage means numeric counts only. The existing failure logger keeps its strict
// no-credential source guard; boundedLog validates these counts independently.
export function logProviderUsage(event: Pick<AttemptEvent, 'endpoint' | 'requestId' | 'model' | 'attempt' | 'promptTokens' | 'outputTokens' | 'thinkingTokens'>): void {
  if ([event.promptTokens, event.outputTokens, event.thinkingTokens].every(v => v == null)) return;
  boundedLog('AI', { endpoint: event.endpoint, requestId: event.requestId, model: event.model, attempt: event.attempt,
    code: 'PROVIDER_SUCCESS', promptTokens: event.promptTokens, outputTokens: event.outputTokens, thinkingTokens: event.thinkingTokens });
}
