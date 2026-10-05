import { serverConfig } from '../config';

export const API_ROUTES = ['/api/health', '/api/auth/register', '/api/auth/challenge', '/api/auth/verify', '/api/gemini/analyze', '/api/gemini/explain-trends', '/api/gemini/smart-capture', '/api/gemini/scan-receipt', 'other'] as const;
export const FAILURE_REASONS = ['API_UNAUTHORIZED', 'INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED', 'INVALID_REGISTRATION', 'INVALID_PUBLIC_KEY', 'UNSUPPORTED_SIGNING_ALGORITHM', 'INVALID_CHALLENGE_REQUEST', 'UNKNOWN_INSTALLATION', 'INSTALLATION_REVOKED', 'INVALID_PROOF_REQUEST', 'INVALID_PROOF', 'INVALID_CHALLENGE', 'CHALLENGE_EXPIRED', 'INVALID_SIGNATURE', 'AUTH_SERVICE_ERROR', 'INVALID_JSON', 'INVALID_REQUEST', 'REQUEST_TOO_LARGE', 'HTTPS_REQUIRED', 'ORIGIN_NOT_ALLOWED', 'AI_NOT_CONFIGURED', 'AI_TIMEOUT', 'AI_RATE_LIMITED', 'AI_TEMPORARILY_UNAVAILABLE', 'AI_INVALID_RESPONSE', 'AI_REQUEST_FAILED', 'INTERNAL_ERROR', 'UNHANDLED_API_ERROR', 'PROVIDER_RETRY', 'PROVIDER_FALLBACK', 'GLOBAL_QUOTA_REJECTED', 'INSTALLATION_QUOTA_REJECTED', 'registration_rate_limited', 'registration_daily_limited', 'challenge_installation_rate_limited', 'challenge_ip_rate_limited', 'ai_installation_rate_limited', 'ai_ip_rate_limited', 'ai_installation_daily_limited', 'ai_global_cost_guardrail', 'UNKNOWN_TECHNICAL_ERROR'] as const;
export type SafeRoute = typeof API_ROUTES[number];
export type FailureReason = typeof FAILURE_REASONS[number];
export function normalizeRoute(value: unknown): SafeRoute {
  const path = typeof value === 'string' ? value.split('?')[0] : '';
  return (API_ROUTES as readonly string[]).includes(path) ? path as SafeRoute : 'other';
}
export function normalizeFailure(value: unknown): FailureReason { return (FAILURE_REASONS as readonly unknown[]).includes(value) ? value as FailureReason : 'UNKNOWN_TECHNICAL_ERROR'; }
const validDuration = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 600_000;
const increment = (value: number) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);

class LatencyWindow {
  private values: number[] = [];
  private cursor = 0;
  record(value: number) { if (!validDuration(value)) return; if (this.values.length < 512) this.values.push(value); else { this.values[this.cursor] = value; this.cursor = (this.cursor + 1) % 512; } }
  snapshot() {
    const sorted = [...this.values].sort((a, b) => a - b);
    const percentile = (fraction: number) => sorted.length ? Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 100) / 100 : 0;
    return { samples: sorted.length, p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) };
  }
}

export class OperationalAggregates {
  private total = 0; private success = 0; private errors = 0; private aborted = 0; private rateLimited = 0;
  private httpClasses = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  private requestLatency = new LatencyWindow();
  private providerLatency = new LatencyWindow();
  private routes = Object.fromEntries(API_ROUTES.map((route) => [route, { count: 0, errors: 0, latency: new LatencyWindow() }])) as Record<SafeRoute, { count: number; errors: number; latency: LatencyWindow }>;
  private reasons = Object.fromEntries(FAILURE_REASONS.map((reason) => [reason, 0])) as Record<FailureReason, number>;
  private provider = { attempts: 0, successes: 0, failures: 0, retries: 0, fallbacks: 0, roles: { primary: 0, fallback: 0, other: 0 } };
  private startedAt = Date.now();
  private readonly useBounds: { dailyAdmissionLimit: number; maxAttemptsPerAdmission: number; theoreticalDailyAttemptCeiling: number };
  constructor(bounds: { dailyAdmissionLimit?: number; modelCount?: number } = {}) {
    const daily = Number.isSafeInteger(bounds.dailyAdmissionLimit) && bounds.dailyAdmissionLimit! >= 0 ? bounds.dailyAdmissionLimit! : 0;
    const models = Number.isSafeInteger(bounds.modelCount) && bounds.modelCount! > 0 ? bounds.modelCount! : 0;
    this.useBounds = { dailyAdmissionLimit: daily, maxAttemptsPerAdmission: models * 2, theoreticalDailyAttemptCeiling: daily * models * 2 };
  }
  recordRequest(route: unknown, status: number, elapsedMs: number, aborted: boolean): void {
    const label = normalizeRoute(route); const bucket = this.routes[label];
    this.total = increment(this.total); bucket.count = increment(bucket.count);
    const isError = !aborted && Number.isInteger(status) && status >= 400 && status < 600;
    if (aborted) this.aborted = increment(this.aborted);
    else if (Number.isInteger(status) && status >= 200 && status < 400) this.success = increment(this.success);
    else if (isError) { this.errors = increment(this.errors); bucket.errors = increment(bucket.errors); }
    if (!aborted && status === 429) this.rateLimited = increment(this.rateLimited);
    const httpClass = !aborted && Number.isInteger(status) && status >= 200 && status < 600 ? `${Math.floor(status / 100)}xx` as keyof typeof this.httpClasses : 'other';
    this.httpClasses[httpClass] = increment(this.httpClasses[httpClass]);
    this.requestLatency.record(elapsedMs); bucket.latency.record(elapsedMs);
  }
  recordFailure(value: unknown): void {
    const reason = normalizeFailure(value); this.reasons[reason] = increment(this.reasons[reason]);
    if (reason === 'PROVIDER_RETRY') this.provider.retries = increment(this.provider.retries);
    if (reason === 'PROVIDER_FALLBACK') this.provider.fallbacks = increment(this.provider.fallbacks);
  }
  recordProvider(role: unknown, elapsedMs: number, succeeded: boolean): void {
    const label = role === 'primary' || role === 'fallback' ? role : 'other';
    this.provider.attempts = increment(this.provider.attempts); this.provider.roles[label] = increment(this.provider.roles[label]);
    if (succeeded) this.provider.successes = increment(this.provider.successes); else this.provider.failures = increment(this.provider.failures);
    this.providerLatency.record(elapsedMs);
  }
  snapshot() {
    return { format: 'spendwise-operational-aggregates-v1', since: this.startedAt, latencyWindowLimit: 512, requests: { total: this.total, success: this.success, errors: this.errors, aborted: this.aborted, rateLimited: this.rateLimited, httpClasses: { ...this.httpClasses }, latency: this.requestLatency.snapshot() }, routes: Object.fromEntries(API_ROUTES.map((route) => [route, { count: this.routes[route].count, errors: this.routes[route].errors, latency: this.routes[route].latency.snapshot() }])), reasons: { ...this.reasons }, provider: { ...this.provider, roles: { ...this.provider.roles }, latency: this.providerLatency.snapshot() }, useBounds: { ...this.useBounds } };
  }
  reset(): void {
    this.total = this.success = this.errors = this.aborted = this.rateLimited = 0; this.startedAt = Date.now();
    this.httpClasses = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 }; this.requestLatency = new LatencyWindow(); this.providerLatency = new LatencyWindow();
    for (const route of API_ROUTES) this.routes[route] = { count: 0, errors: 0, latency: new LatencyWindow() };
    for (const reason of FAILURE_REASONS) this.reasons[reason] = 0;
    this.provider = { attempts: 0, successes: 0, failures: 0, retries: 0, fallbacks: 0, roles: { primary: 0, fallback: 0, other: 0 } };
  }
}
export const operationalAggregates = new OperationalAggregates({ dailyAdmissionLimit: serverConfig.aiGlobalDailyLimit, modelCount: serverConfig.geminiModels.length });
export function startAggregateReporting(metrics: OperationalAggregates, emit: (snapshot: ReturnType<OperationalAggregates['snapshot']>) => void = (snapshot) => console.info('[Operations]', snapshot), intervalMs = 60_000): () => void {
  const timer = setInterval(() => { try { emit(metrics.snapshot()); } catch {} }, Math.max(10, intervalMs)); timer.unref();
  return () => clearInterval(timer);
}
