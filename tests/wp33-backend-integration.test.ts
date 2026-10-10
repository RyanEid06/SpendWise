import test from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'test';
process.env.SPENDWISE_INSTALLATION_STORE_PATH = ':memory:';
process.env.SPENDWISE_REGISTRATION_HOURLY_LIMIT = '3';
process.env.SPENDWISE_REGISTRATION_DAILY_LIMIT = '4';
const { createServerApp } = await import('../server/app');
const { operationalAggregates: metrics } = await import('../server/observability/aggregates');
const { logAiFailure } = await import('../server/logging/aiLogging');
const { logSecurityEvent } = await import('../server/logging/securityLogging');
const { GeminiService } = await import('../server/services/GeminiService');
const { serverConfig } = await import('../server/config');
const { apiErrorHandler } = await import('../server/middleware/errors');

test('real API observer counts health, auth, parser, oversize, proof, validation and quota failures without logging sensitive data', async () => {
  metrics.reset(); const logs: unknown[][] = []; const warn = console.warn; console.warn = (...args) => { logs.push(args); };
  const server = createServerApp().listen(0, '127.0.0.1'); await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = (path: string, body: unknown, bearer?: string) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  try {
    const health = await fetch(base + '/api/health?merchant=private-merchant');
    assert.equal(health.status, 200); assert.deepEqual(Object.keys(await health.json()).sort(), ['aiConfigured', 'authentication', 'legacyCompatibilityEnabled', 'ok']);
    assert.equal((await request('/api/gemini/analyze', { amount: 887766.55, receipt: 'private-receipt', image: 'private-photo' })).status, 401);
    assert.equal((await request('/api/auth/verify', '{malformed-private-token')).status, 400);
    assert.equal((await request('/api/auth/verify', { passphrase: 'private-passphrase'.repeat(10000) })).status, 413);
    assert.equal((await request('/api/auth/verify', { signature: 'private-signature' })).status, 400);
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const registration = await request('/api/auth/register', { publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), algorithm: 'ECDSA_P256_SHA256' });
    assert.equal(registration.status, 201); const { installationId } = await registration.json();
    const challenge = await (await request('/api/auth/challenge', { installationId })).json();
    const sign = createSign('SHA256'); sign.update(challenge.payload); sign.end();
    const proof = await request('/api/auth/verify', { installationId, challengeId: challenge.challengeId, signature: sign.sign(pair.privateKey).toString('base64') });
    assert.equal(proof.status, 200); const { accessToken } = await proof.json();
    assert.equal((await request('/api/gemini/analyze', { description: 'private-description', note: 'private-note' }, accessToken)).status, 400);
    const leakedSignature = await request('/api/auth/verify', { installationId, challengeId: challenge.challengeId, signature: 'private-signature' }); assert.equal(leakedSignature.status, 401);
    for (let i = 0; i < 4; i++) await request('/api/auth/register', { publicKey: 'private-key', algorithm: 'private-algorithm' });
    const report = metrics.snapshot();
    assert.ok(report.requests.total >= 14); assert.equal(report.reasons.INVALID_JSON, 1); assert.equal(report.reasons.REQUEST_TOO_LARGE, 1); assert.equal(report.reasons.INVALID_PROOF_REQUEST, 1); assert.equal(report.reasons.INVALID_CHALLENGE, 1); assert.equal(report.reasons.INVALID_REQUEST, 1);
    assert.ok(report.requests.rateLimited >= 1); assert.ok(report.reasons.registration_rate_limited >= 1);
    const output = JSON.stringify({ logs, report }); assert.ok(!output.includes('private-')); assert.ok(!output.includes(accessToken)); assert.ok(!output.includes(installationId)); assert.ok(!output.includes('887766.55'));
  } finally { console.warn = warn; await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test('existing AI and security log entry points sanitize arbitrary technical strings too', () => {
  const logs: unknown[][] = []; const warn = console.warn; console.warn = (...args) => { logs.push(args); };
  try {
    logAiFailure({ endpoint: '/api/private-receipt', requestId: 'private-token', attempt: 1, code: 'private-prompt', elapsedMs: 5, willRetry: false });
    logSecurityEvent('private-passphrase', { scope: 'private-installation', route: '/api/private-photo', code: 'private-signature', count: 3 });
    assert.ok(logs.length > 0); assert.ok(!JSON.stringify(logs).includes('private-'));
  } finally { console.warn = warn; }
});

test('actual Gemini service measures successful fallback, failed attempts and retry without content logging', async () => {
  const logs: unknown[][] = []; const warn = console.warn; console.warn = (...args) => { logs.push(args); };
  const delay = serverConfig.geminiRetryDelayMs; serverConfig.geminiRetryDelayMs = 0;
  metrics.reset(); let attempts = 0;
  const service = new GeminiService();
  // Substitute the provider transport in the test object; authentication/crypto production paths stay unchanged.
  (service as any).createClient = () => ({ models: { generateContent: async () => { attempts++; if (attempts === 1) throw { status: 503, message: 'private-provider-financial-error' }; return { text: '{"ok":true,"receipt":"private-provider-response"}' }; } } });
  try {
    const result = await service.generateJson({ endpoint: '/api/gemini/analyze', requestId: 'private-request-token', contents: 'private-financial-prompt', responseJsonSchema: { type: 'object' }, systemInstruction: 'private-system-prompt', validate: (value) => value && typeof value === 'object' && (value as any).ok ? { ok: true } : null });
    assert.deepEqual(result, { ok: true }); const report = metrics.snapshot();
    assert.equal(report.provider.attempts, 2); assert.equal(report.provider.failures, 1); assert.equal(report.provider.successes, 1); assert.equal(report.provider.retries, 1); assert.equal(report.provider.fallbacks, 1); assert.equal(report.provider.roles.primary, 1); assert.equal(report.provider.roles.fallback, 1);
    assert.equal(report.provider.latency.samples, 2); assert.ok(!JSON.stringify({ logs, report }).includes('private-'));
  } finally { console.warn = warn; serverConfig.geminiRetryDelayMs = delay; }
});

test('unhandled API logger discards error objects and arbitrary raw request paths', () => {
  const logs: unknown[][] = []; const warn = console.warn; console.warn = (...args) => { logs.push(args); };
  try {
    let status = 0; const res = { status(value: number) { status = value; return this; }, json(value: unknown) { return value; } };
    apiErrorHandler(new Error('private-receipt-key-token'), { originalUrl: '/api/private-passphrase?amount=887766.55', path: '/private-path' } as any, res as any, () => {});
    assert.equal(status, 500); assert.ok(!JSON.stringify(logs).includes('private-')); assert.ok(!JSON.stringify(logs).includes('887766.55'));
  } finally { console.warn = warn; }
});
