import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { boundedLog } from '../server/observability/safeLogging';
import { sanitizeDiagnosticRecord } from '../src/services/diagnostics/contract';
import { classifyApiFailure, getAiErrorMessage, SpendWiseApiError } from '../src/utils/apiErrors';

process.env.SPENDWISE_INSTALLATION_STORE_PATH = ':memory:';
const { createServerApp } = await import('../server/app');

test('health exposes only a sanitized short runtime commit and preserves its contract', async t => {
  const server = createServerApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const previous = process.env.RENDER_GIT_COMMIT;
  t.after(() => { if (previous === undefined) delete process.env.RENDER_GIT_COMMIT; else process.env.RENDER_GIT_COMMIT = previous; });
  for (const [raw, expected] of [
    ['ABC123DEF456' + '0'.repeat(28), 'abc123def456'],
    ['private-key\nABC123DEF456', 'unknown'], ['abc', 'unknown'], ['', 'local'],
  ]) {
    process.env.RENDER_GIT_COMMIT = raw;
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`);
    const health = await response.json();
    assert.equal(response.status, 200);
    assert.equal(health.ok, true);
    assert.equal(health.authentication, 'installation-signature-v1');
    assert.equal(health.version, expected);
    assert.equal(response.headers.get('X-Backend-Version'), expected);
    assert.equal(Object.keys(health).length, 5);
  }
});

test('structured diagnostics retain safe version, fallback and timeout stage, rejecting private fields', () => {
  const logs: any[] = [];
  boundedLog('AI', { endpoint: '/api/gemini/explain-trends', version: 'abc123def456', fallbackUsed: true,
    timeoutStage: 'provider_attempt', phase: 'quality_validation', code: 'AI_INVALID_RESPONSE',
    prompt: 'private-expense', token: 'private-token' }, v => logs.push(v), () => 999999999);
  assert.equal(logs[0].version, 'abc123def456');
  assert.equal(logs[0].fallbackUsed, true);
  assert.equal(logs[0].timeoutStage, 'provider_attempt');
  assert.equal(logs[0].phase, 'quality_validation');
  const record = sanitizeDiagnosticRecord({ operation: 'api.request', code: 'timeout',
    requestId: 'd0af7161-d7a2-4a27-8565-20abc1f766f0', backendVersion: 'abc123def456',
    feature: 'scan-receipt', stage: 'ai_dispatch', prompt: 'private-receipt' }, 1);
  assert.equal(record.requestId, 'd0af7161-d7a2-4a27-8565-20abc1f766f0');
  assert.equal(record.backendVersion, 'abc123def456');
  assert.equal(record.feature, 'scan-receipt');
  assert.equal(record.stage, 'ai_dispatch');
  assert.ok(!JSON.stringify({ logs, record }).includes('private-'));
  const rejected = sanitizeDiagnosticRecord({ requestId: 'private-id', backendVersion: 'private-version', feature: 'private-feature', stage: 'private-stage' }, 1);
  assert.ok(!JSON.stringify(rejected).includes('private-'));
});

test('backend/auth failures are distinguishable from provider unavailability without exposing infrastructure', () => {
  assert.equal(classifyApiFailure(503, 'AUTH_STORE_UNAVAILABLE'), 'backend_unavailable');
  assert.equal(classifyApiFailure(401, 'API_UNAUTHORIZED'), 'unauthorized');
  for (const language of ['en', 'fr', 'ar'] as const) {
    const backend = getAiErrorMessage(language, new SpendWiseApiError('backend_unavailable' as any));
    const provider = getAiErrorMessage(language, new SpendWiseApiError('temporary_unavailable'));
    const auth = getAiErrorMessage(language, new SpendWiseApiError('unauthorized'));
    assert.notEqual(backend, provider);
    assert.notEqual(auth, provider);
    assert.doesNotMatch(backend + auth, /Neon|Postgres|Render|password|token/i);
  }
});
