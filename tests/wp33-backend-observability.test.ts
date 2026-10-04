import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { OperationalAggregates, normalizeRoute, startAggregateReporting } from '../server/observability/aggregates';
import { observeApiRequests } from '../server/observability/requestObservability';
import { boundedLog, normalizeLogCode } from '../server/observability/safeLogging';

test('fixed backend dimensions count request status classes, rate limits and aborts', () => {
  const metrics = new OperationalAggregates();
  metrics.recordRequest('/api/health', 200, 1, false);
  metrics.recordRequest('/api/auth/verify', 401, 30, false);
  metrics.recordRequest('/api/gemini/analyze', 429, 50, false);
  metrics.recordRequest('/api/private-merchant?token=secret', 0, 8, true);
  const s = metrics.snapshot();
  assert.equal(s.requests.total, 4); assert.equal(s.requests.success, 1); assert.equal(s.requests.errors, 2); assert.equal(s.requests.aborted, 1); assert.equal(s.requests.rateLimited, 1);
  assert.equal(s.requests.httpClasses['4xx'], 2);
  assert.ok(!JSON.stringify(s).includes('private-merchant')); assert.ok(!JSON.stringify(s).includes('secret'));
  assert.equal(normalizeRoute('/api/health?merchant=private'), '/api/health'); assert.equal(normalizeRoute('/api/private'), 'other');
});

test('latency windows are bounded and percentiles describe retained samples', () => {
  const metrics = new OperationalAggregates();
  for (let i = 1; i <= 1024; i++) metrics.recordRequest('/api/health', 200, i, false);
  const latency = metrics.snapshot().requests.latency;
  assert.equal(latency.samples, 512); assert.equal(latency.p50, 768); assert.equal(latency.p95, 999); assert.equal(latency.p99, 1019);
  assert.equal(metrics.snapshot().requests.total, 1024);
  const report = metrics.snapshot(); report.requests.total = 0;
  assert.equal(metrics.snapshot().requests.total, 1024);
});

test('provider outcomes, retries, fallbacks and reasons are bounded safe aggregates', () => {
  const metrics = new OperationalAggregates();
  metrics.recordProvider('primary', 20, false); metrics.recordProvider('fallback', 10, true);
  metrics.recordFailure('PROVIDER_RETRY'); metrics.recordFailure('PROVIDER_FALLBACK');
  metrics.recordFailure('INVALID_JSON'); metrics.recordFailure('REQUEST_TOO_LARGE'); metrics.recordFailure('INVALID_PROOF'); metrics.recordFailure('GLOBAL_QUOTA_REJECTED');
  const s = metrics.snapshot();
  assert.equal(s.provider.attempts, 2); assert.equal(s.provider.successes, 1); assert.equal(s.provider.failures, 1); assert.equal(s.provider.retries, 1); assert.equal(s.provider.fallbacks, 1);
  assert.equal(s.reasons.INVALID_JSON, 1); assert.equal(s.reasons.REQUEST_TOO_LARGE, 1); assert.equal(s.reasons.INVALID_PROOF, 1); assert.equal(s.reasons.GLOBAL_QUOTA_REJECTED, 1);
  for (let i = 0; i < 10000; i++) metrics.recordFailure('private-' + i);
  assert.equal(s.provider.latency.samples, 2); assert.ok(Object.keys(metrics.snapshot().reasons).length < 100);
  assert.ok(!JSON.stringify(metrics.snapshot()).includes('private-'));
});

test('nonfinite status/latency and arbitrary provider labels do not poison aggregates', () => {
  const metrics = new OperationalAggregates(); metrics.recordRequest('secret', Infinity, NaN, false); metrics.recordProvider('secret', -1, false);
  const json = JSON.stringify(metrics.snapshot()); assert.ok(!json.includes('secret')); assert.ok(!json.includes('null'));
  assert.equal(metrics.snapshot().requests.latency.samples, 0); assert.equal(metrics.snapshot().provider.latency.samples, 0);
});

test('provider use bounds describe configured attempts without understating large model lists', () => {
  const metrics = new OperationalAggregates({ dailyAdmissionLimit: 5000, modelCount: 151 });
  assert.equal(metrics.snapshot().useBounds.maxAttemptsPerAdmission, 302);
  assert.equal(metrics.snapshot().useBounds.theoreticalDailyAttemptCeiling, 1_510_000);
});

test('finish and close count exactly once and detach their listeners', () => {
  const metrics = new OperationalAggregates(); const res = new EventEmitter() as any; res.statusCode = 200; res.writableFinished = true; res.json = (input: unknown) => input;
  let nextCount = 0; observeApiRequests(metrics)({ originalUrl: '/api/health?secret' } as any, res, () => nextCount++);
  res.emit('finish'); res.emit('close');
  assert.equal(nextCount, 1); assert.equal(metrics.snapshot().requests.total, 1); assert.equal(res.listenerCount('finish'), 0); assert.equal(res.listenerCount('close'), 0);
  const aborted = new EventEmitter() as any; aborted.statusCode = 200; aborted.writableFinished = false; aborted.json = (input: unknown) => input;
  observeApiRequests(metrics)({ originalUrl: '/api/secret' } as any, aborted, () => {}); aborted.emit('close'); aborted.emit('finish');
  assert.equal(metrics.snapshot().requests.total, 2); assert.equal(metrics.snapshot().requests.aborted, 1);
});

test('response error capture extracts only sanitized code without financial fields', () => {
  const metrics = new OperationalAggregates(); const res = new EventEmitter() as any; res.statusCode = 400; res.writableFinished = true; res.json = (input: unknown) => input;
  observeApiRequests(metrics)({ originalUrl: '/api/auth/verify' } as any, res, () => {});
  const payload = { error: 'INVALID_PROOF', amount: 12345.67, receipt: 'private-receipt', token: 'private-token' };
  assert.equal(res.json(payload), payload); res.emit('finish');
  assert.equal(metrics.snapshot().reasons.INVALID_PROOF, 1); assert.ok(!JSON.stringify(metrics.snapshot()).includes('private'));
});

test('bounded logging sanitizes unknown labels and suppresses repeated output', () => {
  const output: unknown[] = []; let clock = 1000;
  const emit = (value: unknown) => output.push(value);
  for (let i = 0; i < 1000; i++) boundedLog('API', { route: '/api/private-token', code: 'merchant-private', payload: 'receipt-private' }, emit, () => clock);
  assert.ok(output.length <= 10); assert.ok(!JSON.stringify(output).includes('private')); assert.equal(normalizeLogCode('merchant-private'), 'UNKNOWN_TECHNICAL_ERROR');
  clock += 60_000; boundedLog('API', { route: '/api/health', code: 'INVALID_JSON' }, emit, () => clock);
  assert.ok(output.length <= 11);
});

test('reporting timer is removable and emits only aggregate snapshots', async () => {
  const metrics = new OperationalAggregates(); const output: unknown[] = [];
  const stop = startAggregateReporting(metrics, (snapshot) => output.push(snapshot), 10);
  await new Promise((r) => setTimeout(r, 35)); stop(); const count = output.length;
  assert.ok(count > 0); await new Promise((r) => setTimeout(r, 30)); assert.equal(output.length, count);
  metrics.reset(); assert.equal(metrics.snapshot().requests.total, 0);
});
