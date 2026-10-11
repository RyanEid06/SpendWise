export type AiFailureCode = 'AI_NOT_CONFIGURED' | 'AI_TIMEOUT' | 'AI_DEADLINE_EXCEEDED' | 'AI_CANCELLED' | 'AI_RATE_LIMITED' | 'AI_QUOTA_EXHAUSTED' | 'AI_NETWORK_ERROR' | 'AI_TEMPORARILY_UNAVAILABLE' | 'AI_INVALID_RESPONSE' | 'AI_CONTENT_BLOCKED' | 'AI_REQUEST_FAILED';
export interface NormalizedAiFailure {
  code: AiFailureCode; httpStatus: number; message: string; retryable: boolean;
  upstreamStatus?: number; networkClass?: string; retryAfterMs?: number;
}
const defaults: Record<AiFailureCode, [number, boolean, string]> = {
  AI_NOT_CONFIGURED: [503, false, 'AI service is not configured.'],
  AI_TIMEOUT: [504, true, 'AI analysis timed out. Please try again.'],
  AI_DEADLINE_EXCEEDED: [504, false, 'AI processing deadline expired. Please try again.'],
  AI_CANCELLED: [499, false, 'AI request was cancelled.'],
  AI_RATE_LIMITED: [429, true, 'AI service is rate limited. Please try again shortly.'],
  AI_QUOTA_EXHAUSTED: [429, false, 'AI daily quota is exhausted. Please try again later.'],
  AI_NETWORK_ERROR: [503, true, 'AI provider connection failed. Please try again.'],
  AI_TEMPORARILY_UNAVAILABLE: [503, true, 'AI service is temporarily unavailable. Please try again.'],
  AI_INVALID_RESPONSE: [502, false, 'AI service returned an invalid response. Please try again.'],
  AI_CONTENT_BLOCKED: [422, false, 'AI service could not process this content.'],
  AI_REQUEST_FAILED: [502, false, 'AI request failed. Please try again.'],
};
function failure(code: AiFailureCode): NormalizedAiFailure {
  const [httpStatus, retryable, message] = defaults[code]; return { code, httpStatus, retryable, message };
}
export class AiReliabilityError extends Error implements NormalizedAiFailure {
  readonly code: AiFailureCode; readonly httpStatus: number; readonly retryable: boolean;
  readonly upstreamStatus?: number; readonly networkClass?: string; readonly retryAfterMs?: number;
  constructor(details: NormalizedAiFailure) {
    super(details.message); this.name = 'AiReliabilityError'; this.code = details.code;
    this.httpStatus = details.httpStatus; this.retryable = details.retryable;
    this.upstreamStatus = details.upstreamStatus; this.networkClass = details.networkClass; this.retryAfterMs = details.retryAfterMs;
  }
}
export const createAiFailure = (code: AiFailureCode) => new AiReliabilityError(failure(code));
const record = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
export function normalizeGeminiFailure(error: unknown): NormalizedAiFailure {
  if (error instanceof AiReliabilityError) return { code: error.code, httpStatus: error.httpStatus, message: error.message, retryable: error.retryable, upstreamStatus: error.upstreamStatus, networkClass: error.networkClass, retryAfterMs: error.retryAfterMs };
  const e = record(error); let embedded: Record<string, any> = {};
  // SDK embeds structured Google details in message; inspect only, never log it.
  try { if (typeof e.message === 'string') embedded = record(JSON.parse(e.message.slice(0, 32768))); } catch {}
  const provider = record(embedded.error ?? e.error);
  const status = [e.status, e.statusCode, provider.code].map(Number).find(v => Number.isInteger(v) && v >= 400 && v <= 599);
  const text = [e.name, e.message, provider.status, provider.message].filter(v => typeof v === 'string').join(' ').slice(0, 32768);
  const details: any[] = Array.isArray(provider.details) ? provider.details : [];
  const networkClass = ['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].find(v => e.code === v || record(e.cause).code === v);
  let code: AiFailureCode;
  if (status != null && status < 500 && status !== 408 && status !== 429) code = 'AI_REQUEST_FAILED';
  else if (/SAFETY|PROHIBITED_CONTENT|BLOCKLIST|RECITATION|content.policy/i.test(text)) code = 'AI_CONTENT_BLOCKED';
  else if (status === 429) code = /perday|per_day|daily|requests per day/i.test(JSON.stringify(details) + text) ? 'AI_QUOTA_EXHAUSTED' : 'AI_RATE_LIMITED';
  else if (status === 408 || status === 504 || /timeout|timed out|deadline exceeded|ETIMEDOUT/i.test(text)) code = 'AI_TIMEOUT';
  else if (networkClass || /fetch failed|network error|socket hang up/i.test(text)) code = 'AI_NETWORK_ERROR';
  else if (status != null && status >= 500 || /UNAVAILABLE|overloaded|temporar(?:y|ily) unavailable/i.test(text)) code = 'AI_TEMPORARILY_UNAVAILABLE';
  else code = 'AI_REQUEST_FAILED';
  const headers = e.headers ?? record(e.response).headers;
  const header = headers?.get?.('retry-after') ?? headers?.['retry-after'] ?? headers?.['Retry-After'];
  let retryAfterMs = typeof header === 'string' && /^\d+(?:\.\d+)?$/.test(header) ? Number(header) * 1000 : typeof header === 'string' && Number.isFinite(Date.parse(header)) ? Math.max(0, Date.parse(header) - Date.now()) : undefined;
  for (const d of details) if (typeof d.retryDelay === 'string' && /^\d+(?:\.\d+)?s$/.test(d.retryDelay)) retryAfterMs = Math.max(retryAfterMs ?? 0, parseFloat(d.retryDelay) * 1000);
  return { ...failure(code), upstreamStatus: status, networkClass, retryAfterMs };
}
export interface AttemptEvent {
  endpoint: string; requestId: string; model: string; attempt: number; code: string;
  elapsedMs: number; attemptMs: number; remainingMs: number; willRetry: boolean;
  retryDelayMs?: number; upstreamStatus?: number; networkClass?: string;
  promptTokens?: number; outputTokens?: number; thinkingTokens?: number;
}
interface ProviderResponse {
  text?: string | null;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: unknown }; candidates?: { finishReason?: unknown }[];
}
export interface GeminiJsonExecutionOptions<T> {
  endpoint: string; requestId: string; timeoutMs: number; retryDelayMs: number;
  operationBudgetMs?: number; operationDeadline?: number; maxAttempts?: number; minAttemptBudgetMs?: number; signal?: AbortSignal;
  now?: () => number; random?: () => number;
  request: (timeoutMs: number, attempt: number, signal: AbortSignal) => Promise<ProviderResponse>;
  validate: (value: unknown) => T | null;
  logFailure?: (details: AttemptEvent) => void; logAttempt?: (details: AttemptEvent) => void;
}
export interface GeminiJsonModelFallbackOptions<T> extends Omit<GeminiJsonExecutionOptions<T>, 'request'> {
  models: string[];
  request: (model: string, timeoutMs: number, attempt: number, signal: AbortSignal) => Promise<ProviderResponse>;
  logModelFallback?: (details: { endpoint: string; requestId: string; fromModel: string; toModel: string; code: AiFailureCode }) => void;
}
function interruptible<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return work(); }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
async function delay(ms: number, signal: AbortSignal): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await interruptible(() => new Promise<void>(resolve => { timer = setTimeout(resolve, ms); }), signal); }
  finally { clearTimeout(timer); }
}
const bounded = (v: number | undefined, fallback: number, min: number, max: number) => v == null || !Number.isFinite(v) ? fallback : Math.max(min, Math.min(max, v));
export async function executeGeminiJsonWithModelFallback<T>(o: GeminiJsonModelFallbackOptions<T>): Promise<T> {
  const models = [...new Set(o.models.map(m => m.trim()).filter(Boolean))];
  if (!models.length) throw createAiFailure('AI_NOT_CONFIGURED');
  const now = o.now ?? (() => performance.now()); const started = now();
  const budget = bounded(o.operationBudgetMs, 90000, 1, 100000);
  const deadline = Math.min(started + budget, Number.isFinite(o.operationDeadline) ? o.operationDeadline! : Infinity);
  const remaining = () => Math.max(0, deadline - now());
  const maxAttempts = Math.floor(bounded(o.maxAttempts, 2, 1, 3));
  const minAttempt = bounded(o.minAttemptBudgetMs, 5000, 1, budget);
  const operation = new AbortController(); const cancel = () => operation.abort(o.signal?.reason instanceof AiReliabilityError && o.signal.reason.code === 'AI_DEADLINE_EXCEEDED' ? o.signal.reason : createAiFailure('AI_CANCELLED'));
  if (o.signal?.aborted) cancel(); else o.signal?.addEventListener('abort', cancel, { once: true });
  const operationTimer = setTimeout(() => operation.abort(createAiFailure('AI_DEADLINE_EXCEEDED')), remaining());
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      operation.signal.throwIfAborted();
      if (remaining() < minAttempt) throw createAiFailure('AI_DEADLINE_EXCEEDED');
      const model = models[Math.min(attempt - 1, models.length - 1)];
      const attemptStart = now(); const controller = new AbortController(); const abort = () => controller.abort(operation.signal.reason);
      operation.signal.addEventListener('abort', abort, { once: true });
      const timeout = Math.min(bounded(o.timeoutMs, 50000, 1, 60000), remaining());
      const timer = setTimeout(() => controller.abort(createAiFailure('AI_TIMEOUT')), timeout);
      let error: unknown;
      try {
        const response = await interruptible(() => o.request(model, timeout, attempt, controller.signal), controller.signal);
        operation.signal.throwIfAborted(); if (remaining() <= 0) throw createAiFailure('AI_DEADLINE_EXCEEDED');
        if (response.promptFeedback?.blockReason || response.candidates?.some(c => ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(String(c.finishReason)))) throw createAiFailure('AI_CONTENT_BLOCKED');
        let parsed: unknown; try { parsed = JSON.parse(response.text?.trim() || ''); } catch { throw createAiFailure('AI_INVALID_RESPONSE'); }
        const result = o.validate(parsed); if (result == null) throw createAiFailure('AI_INVALID_RESPONSE');
        if (remaining() <= 0) throw createAiFailure('AI_DEADLINE_EXCEEDED');
        o.logAttempt?.({ endpoint: o.endpoint, requestId: o.requestId, model, attempt, code: 'PROVIDER_SUCCESS', elapsedMs: now() - started, attemptMs: now() - attemptStart, remainingMs: remaining(), willRetry: false, promptTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount, thinkingTokens: response.usageMetadata?.thoughtsTokenCount });
        return result;
      } catch (caught) { error = operation.signal.aborted ? operation.signal.reason : caught; }
      finally { clearTimeout(timer); operation.signal.removeEventListener('abort', abort); }
      const normalized = normalizeGeminiFailure(error);
      const backoff = Math.min(8000, Math.max(0, o.retryDelayMs) * 2 ** (attempt - 1)) * (1 + Math.max(0, Math.min(1, (o.random ?? Math.random)())) * 0.5);
      const wait = Math.max(backoff, normalized.retryAfterMs ?? 0);
      const willRetry = !operation.signal.aborted && normalized.retryable && attempt < maxAttempts && remaining() >= wait + minAttempt;
      const event = { endpoint: o.endpoint, requestId: o.requestId, model, attempt, code: normalized.code, elapsedMs: now() - started, attemptMs: now() - attemptStart, remainingMs: remaining(), willRetry, retryDelayMs: wait, upstreamStatus: normalized.upstreamStatus, networkClass: normalized.networkClass };
      o.logFailure?.(event); o.logAttempt?.(event);
      if (!willRetry) {
        if (!operation.signal.aborted && remaining() <= 0) throw createAiFailure('AI_DEADLINE_EXCEEDED');
        throw new AiReliabilityError(normalized);
      }
      const nextModel = models[Math.min(attempt, models.length - 1)];
      if (nextModel !== model) o.logModelFallback?.({ endpoint: o.endpoint, requestId: o.requestId, fromModel: model, toModel: nextModel, code: normalized.code });
      await delay(wait, operation.signal);
    }
    throw createAiFailure('AI_REQUEST_FAILED');
  } finally { clearTimeout(operationTimer); o.signal?.removeEventListener('abort', cancel); }
}
export function executeGeminiJson<T>(o: GeminiJsonExecutionOptions<T>): Promise<T> {
  return executeGeminiJsonWithModelFallback({ ...o, models: ['primary'], request: (_model, timeout, attempt, signal) => o.request(timeout, attempt, signal) });
}
export function cleanupRateBuckets<T extends { resetAt: number }>(buckets: Map<string, T>, now: number, maxEntries: number): number {
  let removed = 0;
  for (const [key, bucket] of buckets) if (now >= bucket.resetAt) { buckets.delete(key); removed++; }
  for (const [key] of [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt).slice(0, Math.max(0, buckets.size - maxEntries))) if (buckets.delete(key)) removed++;
  return removed;
}
