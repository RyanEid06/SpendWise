import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { AuthenticatedApiClient } from '../src/security/AuthenticatedApiClient';

process.env.NODE_ENV = 'test';
process.env.SPENDWISE_INSTALLATION_STORE_PATH = ':memory:';
const { createServerApp } = await import('../server/app');
const { geminiService } = await import('../server/services/GeminiService');

test('actual signed HTTP operation carries one correlation through readiness, auth, provider and disconnect', async t => {
  const logs: any[][] = []; const phases: any[] = []; const calls: { path: string; id: string | null }[] = [];
  t.mock.method(console, 'warn', (...args: any[]) => { logs.push(args); });
  // Advance only the metadata logging window between requests; no wait or budget is changed.
  const clock = Date.now; let offset = 0;
  t.mock.method(Date, 'now', () => clock() + offset);
  let attempt = 0; let providerStarted!: () => void; let providerCancelled!: () => void;
  const started = new Promise<void>(resolve => { providerStarted = resolve; });
  const cancelled = new Promise<void>(resolve => { providerCancelled = resolve; });
  t.mock.method(geminiService as any, 'createClient', () => ({ models: { generateContent: async (request: any) => {
    if (++attempt === 1) return { text: JSON.stringify({ description: 'synthetic-private-description', category: 'Food', amount: 12.5,
      merchantOrBrand: null, notes: null, confidence: 'high', uncertaintyReason: null, priceVisible: true, detectedCurrencyCode: 'USD' }) };
    providerStarted();
    return new Promise((_resolve, reject) => request.config.abortSignal.addEventListener('abort', () => {
      providerCancelled(); reject(request.config.abortSignal.reason);
    }, { once: true }));
  } } }));
  const server = createServerApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const client = new AuthenticatedApiClient(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, {
    persistent: false,
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') }),
    sign: async payload => sign('sha256', Buffer.from(payload), pair.privateKey).toString('base64'),
  }, null, { onPhase: e => phases.push(e), fetch: async (url, init) => {
    calls.push({ path: new URL(url).pathname, id: new Headers(init.headers).get('X-Request-ID') });
    return fetch(url, init);
  } });
  const first = '2ba31729-546d-4fe6-96ed-3a7448706912';
  const body = JSON.stringify({ imageBase64: 'c3ludGhldGlj', mimeType: 'image/jpeg', language: 'en', currencyCode: 'USD' });
  const response = await client.fetch('/api/gemini/smart-capture', { method: 'POST', headers: { 'X-Request-ID': first }, body }, 115_000);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).amount, 12.5);
  assert.ok(calls.every(c => c.id === first));
  assert.ok(phases.every(p => p.requestId === first));
  for (const phase of ['readiness', 'register', 'challenge', 'verify', 'ai_dispatch']) {
    assert.ok(logs.some(([tag, e]) => tag === '[API]' && e.requestId === first && e.phase === phase), phase);
  }
  assert.ok(logs.some(([tag, e]) => tag === '[AI]' && e.requestId === first && e.code === 'PROVIDER_SUCCESS'));
  offset = 60_001;
  const second = '7ba31729-546d-4fe6-96ed-3a7448706912'; const controller = new AbortController();
  const pending = client.fetch('/api/gemini/smart-capture', { method: 'POST', headers: { 'X-Request-ID': second }, body, signal: controller.signal }, 115_000);
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  await started; controller.abort(); await rejection; await cancelled;
  assert.ok(logs.some(([tag, e]) => tag === '[API]' && e.requestId === second && e.phase === 'client_disconnect'));
  assert.equal(attempt, 2);
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-private-description|c3ludGhldGlj|Bearer|signature|publicKey/);
});
