import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthenticatedApiClient } from '../src/security/AuthenticatedApiClient';
import { AiRequestGate } from '../src/app/hooks/aiRequestGate';
import { AI_PROCESSING_TIMEOUT_MS, AI_END_TO_END_TIMEOUT_MS, withOperationDeadline } from '../src/security/aiOperationBudget';
import { classifyApiFailure, getAiErrorMessage, SpendWiseApiError } from '../src/utils/apiErrors';

test('known daily quota exhaustion is distinct from a brief transient rate limit', () => {
  assert.equal(classifyApiFailure(429, 'AI_QUOTA_EXHAUSTED'), 'quota_exhausted');
  assert.equal(classifyApiFailure(429, 'AI_RATE_LIMITED'), 'rate_limited');
  assert.match(getAiErrorMessage('en', new SpendWiseApiError('quota_exhausted')), /daily/i);
  assert.doesNotMatch(getAiErrorMessage('en', new SpendWiseApiError('quota_exhausted')), /briefly/);
});

function fixture(t: any, provider: (init: RequestInit, attempt: number) => Promise<Response>) {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
  t.after(() => Reflect.deleteProperty(globalThis, 'window'));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    if (url.endsWith('/register')) return Response.json({ installationId: 'test-installation' });
    if (url.endsWith('/challenge')) return Response.json({ challengeId: 'test-challenge', payload: 'synthetic' });
    if (url.endsWith('/verify')) return Response.json({ accessToken: 'synthetic-token-for-tests', expiresAt: Date.now() + 600000 });
    return provider(init, ++calls);
  });
  const client = new AuthenticatedApiClient('https://example.test', {
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey: 'synthetic' }), sign: async () => 'synthetic',
  }, null);
  return { client, calls: () => calls };
}
const ai = '/api/gemini/analyze';
test('client cancellation aborts the AI transport and no ambiguous POST is retried', async t => {
  let signal: AbortSignal | null | undefined;
  const f = fixture(t, async init => { signal = init.signal; return new Promise(resolve => setTimeout(() => resolve(Response.json({ ok: true })), 25)); });
  const controller = new AbortController();
  const pending = f.client.fetch(ai, { method: 'POST', signal: controller.signal }, 100);
  const assertion = assert.rejects(pending, (e: any) => e.name === 'AbortError');
  await new Promise(resolve => setTimeout(resolve, 5)); controller.abort(); await assertion;
  assert.equal(signal?.aborted, true); assert.equal(f.calls(), 1);
});
test('client processing timeout includes body read and rejects an ignored abort/late success', async t => {
  const f = fixture(t, async () => new Response(new ReadableStream({ start() {} })));
  await assert.rejects(f.client.fetch(ai, { method: 'POST' }, 10), (e: any) => e.name === 'TimeoutError');
  assert.equal(f.calls(), 1);
});
test('network drop never automatically resends AI POST', async t => {
  const f = fixture(t, async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(f.client.fetch(ai, { method: 'POST' }), TypeError);
  assert.equal(f.calls(), 1);
});
test('only explicit stale-token rejection allows one authenticated re-dispatch', async t => {
  const f = fixture(t, async (_init, attempt) => attempt === 1 ? Response.json({ error: 'ACCESS_TOKEN_EXPIRED' }, { status: 401 }) : Response.json({ ok: true }));
  assert.equal((await f.client.fetch(ai, { method: 'POST' })).status, 200); assert.equal(f.calls(), 2);
});
test('unclassified 401 is never resent as another AI operation', async t => {
  const f = fixture(t, async () => Response.json({ error: 'UNEXPECTED' }, { status: 401 }));
  assert.equal((await f.client.fetch(ai, { method: 'POST' })).status, 401); assert.equal(f.calls(), 1);
});
test('duplicate prevention and invalidation reject a late old result after Retry', () => {
  const gate = new AiRequestGate(); const old = gate.begin()!;
  assert.equal(gate.begin(), null); gate.invalidate(); const current = gate.begin()!;
  assert.equal(gate.isCurrent(old), false); assert.equal(gate.finish(old), false);
  assert.equal(gate.begin(), null); assert.equal(gate.finish(current), true);
});
test('overall bound includes readiness/auth and refresh, rejects ignored cancellation and late completion', async () => {
  assert.equal(AI_PROCESSING_TIMEOUT_MS, 115000); assert.equal(AI_END_TO_END_TIMEOUT_MS, 270000);
  assert.ok(AI_END_TO_END_TIMEOUT_MS >= 90000 + 30000 + 30000 + AI_PROCESSING_TIMEOUT_MS);
  await assert.rejects(withOperationDeadline(async () => new Promise(resolve => setTimeout(() => resolve(true), 30)), 5), (e: any) => e.name === 'TimeoutError');
  const c = new AbortController(); c.abort(); let calls = 0;
  await assert.rejects(withOperationDeadline(async () => { calls++; }, 100, c.signal), (e: any) => e.name === 'AbortError');
  assert.equal(calls, 0);
});
