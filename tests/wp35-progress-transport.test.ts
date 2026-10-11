import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthenticatedApiClient } from '../src/security/AuthenticatedApiClient';
import { classifyApiFailure, getAiErrorMessage, SpendWiseApiError, normalizeApiException } from '../src/utils/apiErrors';

test('known daily quota and provider network errors stay distinct', () => {
  assert.equal(classifyApiFailure(429, 'AI_QUOTA_EXHAUSTED'), 'quota_exhausted');
  assert.equal(classifyApiFailure(502, 'AI_NETWORK_ERROR'), 'network');
  assert.doesNotMatch(getAiErrorMessage('en', new SpendWiseApiError('quota_exhausted' as any)), /briefly|minute|hour/i);
});

test('explicit cancellation is distinct from an expired request deadline', () => {
  assert.equal(normalizeApiException(new DOMException('Cancelled', 'AbortError')).kind, 'cancelled');
  assert.equal(normalizeApiException(new DOMException('Expired', 'TimeoutError')).kind, 'timeout');
});

test('actual auth and dispatch signals surround transport; cancelled auth cannot dispatch', async t => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
  t.after(() => Reflect.deleteProperty(globalThis, 'window'));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let sends = 0;
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    if (url.endsWith('/register')) { await gate; return Response.json({ installationId: 'synthetic' }); }
    if (url.endsWith('/challenge')) return Response.json({ challengeId: 'synthetic', payload: 'synthetic' });
    if (url.endsWith('/verify')) return Response.json({ accessToken: 'synthetic', expiresAt: Date.now() + 60_000 });
    sends++; return Response.json({ ok: true });
  });
  const client = new AuthenticatedApiClient('https://example.test', {
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey: 'synthetic' }), sign: async () => 'synthetic',
  }, null);
  const controller = new AbortController();
  const phases: string[] = [];
  const pending = client.fetch('/api/gemini/analyze', { signal: controller.signal, onPhase: event => phases.push(event.phase) } as any);
  const rejected = assert.rejects(pending, (e: any) => e.name === 'AbortError');
  controller.abort(); release(); await rejected;
  assert.equal(sends, 0);
  assert.deepEqual(phases, ['authentication']);
  phases.length = 0;
  await client.fetch('/api/gemini/analyze', { onPhase: event => phases.push(event.phase) } as any);
  assert.equal(sends, 1);
  assert.deepEqual(phases, ['ai_dispatch']);
});

test('Cancel after response headers aborts body download and rejects late output', async t => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
  t.after(() => Reflect.deleteProperty(globalThis, 'window'));
  let transportSignal: AbortSignal | undefined;
  let arrived!: () => void;
  const headers = new Promise<void>(resolve => { arrived = resolve; });
  t.mock.method(globalThis, 'fetch', async (url: any, init: RequestInit) => {
    if (url.endsWith('/register')) return Response.json({ installationId: 'synthetic' });
    if (url.endsWith('/challenge')) return Response.json({ challengeId: 'synthetic', payload: 'synthetic' });
    if (url.endsWith('/verify')) return Response.json({ accessToken: 'synthetic', expiresAt: Date.now() + 60_000 });
    transportSignal = init.signal!;
    arrived();
    return new Response(new ReadableStream({ start(controller) {
      setTimeout(() => { controller.enqueue(new TextEncoder().encode('{"late":true}')); controller.close(); }, 30);
    } }));
  });
  const client = new AuthenticatedApiClient('https://example.test', {
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey: 'synthetic' }), sign: async () => 'synthetic',
  }, null);
  const controller = new AbortController();
  const pending = client.fetch('/api/gemini/analyze', { signal: controller.signal }, 500);
  const assertion = assert.rejects(pending, (e: any) => e.name === 'AbortError');
  await headers;
  await new Promise(resolve => setTimeout(resolve, 1));
  controller.abort();
  await assertion;
  assert.equal(transportSignal?.aborted, true);
});

test('request deadline aborts a stalled transport and remains a timeout', async t => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
  t.after(() => Reflect.deleteProperty(globalThis, 'window'));
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', async (url: any, init: RequestInit) => {
    if (url.endsWith('/register')) return Response.json({ installationId: 'synthetic' });
    if (url.endsWith('/challenge')) return Response.json({ challengeId: 'synthetic', payload: 'synthetic' });
    if (url.endsWith('/verify')) return Response.json({ accessToken: 'synthetic', expiresAt: Date.now() + 60_000 });
    signal = init.signal!;
    return new Promise<Response>(() => {});
  });
  const client = new AuthenticatedApiClient('https://example.test', {
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey: 'synthetic' }), sign: async () => 'synthetic',
  }, null);
  await assert.rejects(client.fetch('/api/gemini/analyze', {}, 5), (error: any) => normalizeApiException(error).kind === 'timeout');
  assert.equal(signal?.aborted, true);
});

test('expired token refresh and simulated lost registry preserve real authentication stages', async t => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } });
  t.after(() => Reflect.deleteProperty(globalThis, 'window'));
  let registrations = 0, challenges = 0, verifies = 0, sends = 0;
  t.mock.method(globalThis, 'fetch', async (url: any) => {
    if (url.endsWith('/register')) { registrations++; return Response.json({ installationId: 'new-synthetic' }); }
    if (url.endsWith('/challenge')) {
      if (++challenges === 1) return Response.json({ error: 'UNKNOWN_INSTALLATION' }, { status: 404 });
      return Response.json({ challengeId: 'synthetic', payload: 'synthetic' });
    }
    if (url.endsWith('/verify')) { verifies++; return Response.json({ accessToken: 'synthetic', expiresAt: Date.now() + 60_000 }); }
    return ++sends === 1 ? Response.json({ error: 'ACCESS_TOKEN_EXPIRED' }, { status: 401 }) : Response.json({ ok: true });
  });
  const storage = { getItem: () => 'old-synthetic', setItem: () => {}, removeItem: () => {} } as unknown as Storage;
  const client = new AuthenticatedApiClient('https://example.test', {
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey: 'synthetic' }), sign: async () => 'synthetic',
  }, storage);
  const phases: string[] = [];
  assert.equal((await client.fetch('/api/gemini/analyze', { onPhase: event => phases.push(event.phase) })).status, 200);
  assert.deepEqual(phases, ['authentication', 'ai_dispatch', 'authentication', 'ai_dispatch']);
  assert.equal(registrations, 1);
  assert.equal(verifies, 2);
  assert.equal(sends, 2);
});
