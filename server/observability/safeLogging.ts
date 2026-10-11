import { normalizeFailure, normalizeRoute, type FailureReason } from './aggregates';

export const normalizeLogCode = (value: unknown): FailureReason => normalizeFailure(value);
const windows = new Map<string, { start: number; emitted: number; suppressed: number }>();
export function boundedLog(tag: 'API' | 'AI' | 'Security', details: { [key: string]: unknown }, emit: (value: unknown) => void = (value) => console.warn(`[${tag}]`, value), now: () => number = Date.now): void {
  try {
    const group = tag === 'API' || tag === 'AI' || tag === 'Security' ? tag : 'API';
    const clock = now();
    const previous = windows.get(group);
    const window = !previous || clock - previous.start >= 60_000 || clock < previous.start ? { start: clock, emitted: 0, suppressed: previous?.suppressed ?? 0 } : previous;
    windows.set(group, window);
    if (window.emitted >= 10) { window.suppressed = Math.min(Number.MAX_SAFE_INTEGER, window.suppressed + 1); return; }
    window.emitted++;
    const out: Record<string, unknown> = { route: normalizeRoute(details.route ?? details.endpoint), code: normalizeLogCode(details.code ?? details.event), suppressed: window.suppressed };
    window.suppressed = 0;
    if (typeof details.elapsedMs === 'number' && Number.isFinite(details.elapsedMs) && details.elapsedMs >= 0 && details.elapsedMs <= 600_000) out.elapsedMs = Math.round(details.elapsedMs);
    if (typeof details.attempt === 'number' && Number.isInteger(details.attempt) && details.attempt >= 1 && details.attempt <= 3) out.attempt = details.attempt;
    if (typeof details.willRetry === 'boolean') out.willRetry = details.willRetry;
    // Optional grouping accepts only the existing hashed scope, never its input.
    if (typeof details.scopeHash === 'string' && /^[a-f0-9]{16}$/.test(details.scopeHash)) out.scopeHash = details.scopeHash;
    if (typeof details.requestId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(details.requestId)) out.requestId = details.requestId;
    if (typeof details.model === 'string' && /^gemini-\d(?:\.\d)?-(?:flash|flash-lite|pro)(?:-[a-z0-9.-]{1,40})?$/.test(details.model)) out.model = details.model;
    if (['readiness', 'register', 'challenge', 'verify', 'ai_dispatch', 'client_disconnect', 'operation_deadline'].includes(String(details.phase))) out.phase = details.phase;
    if (['start', 'success', 'failure', 'aborted'].includes(String(details.outcome))) out.outcome = details.outcome;
    for (const key of ['attemptMs', 'remainingMs', 'retryDelayMs']) {
      const value = details[key]; if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 600_000) out[key] = Math.round(value);
    }
    for (const key of ['promptTokens', 'outputTokens', 'thinkingTokens']) {
      const value = details[key]; if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000) out[key] = value;
    }
    if (typeof details.upstreamStatus === 'number' && Number.isInteger(details.upstreamStatus) && details.upstreamStatus >= 400 && details.upstreamStatus <= 599) out.upstreamStatus = details.upstreamStatus;
    if (['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(String(details.networkClass))) out.networkClass = details.networkClass;
    emit(out);
  } catch {}
}
