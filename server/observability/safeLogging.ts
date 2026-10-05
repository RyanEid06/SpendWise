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
    if (typeof details.attempt === 'number' && Number.isInteger(details.attempt) && details.attempt >= 1 && details.attempt <= 2) out.attempt = details.attempt;
    if (typeof details.willRetry === 'boolean') out.willRetry = details.willRetry;
    // Optional grouping accepts only the existing hashed scope, never its input.
    if (typeof details.scopeHash === 'string' && /^[a-f0-9]{16}$/.test(details.scopeHash)) out.scopeHash = details.scopeHash;
    emit(out);
  } catch {}
}
