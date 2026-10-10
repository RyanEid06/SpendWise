import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { AuthenticatedApiClient } from '../src/security/AuthenticatedApiClient';
import { FileInstallationRegistry, InstallationAuthService } from '../server/security/installationAuth';

const storageKey = 'spendwise_backend_installation_id_v1';
function fixture(options: Record<string, unknown> = {}) {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const registry = new FileInstallationRegistry(null);
  let service = new InstallationAuthService(registry);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } as Storage;
  const calls: string[] = [];
  const events: any[] = [];
  let override: ((path: string, init: RequestInit) => Promise<Response | undefined>) | undefined;
  const transport = async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push(path);
    const replacement = await override?.(path, init);
    if (replacement) return replacement;
    const body = init.body ? JSON.parse(String(init.body)) : {};
    try {
      if (path === '/api/health') return Response.json({ ok: true, aiConfigured: false });
      if (path.endsWith('/register')) { const r = await service.register(body.publicKey, body.algorithm); return Response.json({ installationId: r.record.id }); }
      if (path.endsWith('/challenge')) return Response.json(await service.issueChallenge(body.installationId));
      if (path.endsWith('/verify')) return Response.json(await service.verifyChallenge(body.installationId, body.challengeId, body.signature));
      const token = new Headers(init.headers).get('Authorization')!.slice(7);
      await service.validateAccessToken(token);
      return Response.json({ authorized: true });
    } catch (e: any) { return Response.json({ error: e.code }, { status: e.httpStatus }); }
  };
  const client = new AuthenticatedApiClient('https://example.test', {
    persistent: options.persistent as boolean | undefined,
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey }),
    sign: async (payload) => sign('sha256', Buffer.from(payload), pair.privateKey).toString('base64'),
  }, storage, { fetch: transport, now: Date.now, random: () => 0, onPhase: (event: unknown) => events.push(event), ...options });
  return { client, service, storage, calls, events, restart: () => { service = new InstallationAuthService(registry); }, override: (fn: typeof override) => { override = fn; } };
}
const flush = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };
const ai = '/api/gemini/analyze';

test('explicit device offline status fails promptly without auth or AI and permits a later online retry', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const connectivity = { onLine: false };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: connectivity });
  try {
    const f = fixture();
    await assert.rejects(f.client.fetch(ai), /offline/i);
    assert.deepEqual(f.calls, []);
    connectivity.onLine = true;
    assert.equal((await f.client.fetch(ai)).status, 200);
    assert.equal(f.calls.filter(path => path === ai).length, 1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('60s first health response is awaited; proof completes before exactly one authorized AI dispatch', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture();
  f.override(async (path) => path === '/api/health' ? new Promise(resolve => setTimeout(() => resolve(Response.json({ ok: true })), 60_000)) : undefined);
  const pending = f.client.fetch(ai, { method: 'POST', body: '{}' }, 30_000);
  await flush();
  t.mock.timers.tick(59_999); await flush();
  assert.deepEqual(f.calls, ['/api/health']);
  t.mock.timers.tick(1); await flush();
  assert.equal((await pending).status, 200);
  assert.deepEqual(f.calls, ['/api/health', '/api/auth/register', '/api/auth/challenge', '/api/auth/verify', ai]);
  assert.ok(f.events.some(e => e.phase === 'readiness' && e.outcome === 'success' && e.elapsedMs >= 60_000));
  assert.equal(new Set(f.events.map(e => e.requestId)).size, 1);
});

test('ephemeral browser signer does not reuse a persisted ID belonging to a previous key', async () => {
  const f = fixture({ persistent: false });
  f.storage.setItem(storageKey, 'previous-browser-or-native-id');
  assert.equal((await f.client.fetch(ai)).status, 200);
  assert.deepEqual(f.calls, ['/api/health', '/api/auth/register', '/api/auth/challenge', '/api/auth/verify', ai]);
  assert.equal(f.storage.getItem(storageKey), 'previous-browser-or-native-id');
  await f.client.fetch(ai);
  assert.equal(f.calls.filter(p => p.endsWith('/register')).length, 1);
});

test('concurrent operations share readiness and authentication but each dispatches once', async () => {
  const f = fixture();
  const responses = await Promise.all([f.client.fetch(ai), f.client.fetch(ai)]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  for (const path of ['/api/health', '/api/auth/register', '/api/auth/challenge', '/api/auth/verify']) assert.equal(f.calls.filter(p => p === path).length, 1);
  assert.equal(f.calls.filter(p => p === ai).length, 2);
});

test('only explicit UNKNOWN_INSTALLATION permits one registration recovery', async () => {
  const f = fixture(); f.storage.setItem(storageKey, 'old-id');
  assert.equal((await f.client.fetch(ai)).status, 200);
  assert.equal(f.calls.filter(p => p.endsWith('/register')).length, 1);
  assert.equal(f.calls.filter(p => p.endsWith('/challenge')).length, 2);
});

for (const [status, error] of [[401, 'INVALID_SIGNATURE'], [404, 'NOT_FOUND'], [403, 'INSTALLATION_REVOKED']] as const) {
  test(`${error} never clears identity, registers again or dispatches AI`, async () => {
    const f = fixture(); f.storage.setItem(storageKey, 'prior-id');
    f.override(async (path) => path.endsWith('/challenge') ? Response.json({ error }, { status }) : undefined);
    await assert.rejects(f.client.fetch(ai));
    assert.equal(f.storage.getItem(storageKey), 'prior-id');
    assert.equal(f.calls.some(p => p.endsWith('/register') || p === ai), false);
  });
}

test('unknown-installation recovery cannot loop', async () => {
  const f = fixture(); f.storage.setItem(storageKey, 'prior-id');
  f.override(async (path) => path.endsWith('/challenge') ? Response.json({ error: 'UNKNOWN_INSTALLATION' }, { status: 404 }) : undefined);
  await assert.rejects(f.client.fetch(ai));
  assert.equal(f.calls.filter(p => p.endsWith('/register')).length, 1);
});

test('revoked identity cannot refresh a cached token or re-register', async () => {
  const f = fixture(); await f.client.fetch(ai);
  const id = f.storage.getItem(storageKey)!;
  await f.service.revokeInstallation(id);
  f.override(async (path) => path === ai ? Response.json({ error: 'INVALID_ACCESS_TOKEN' }, { status: 401 }) : undefined);
  // Revoked identity prevents proof refresh and a second dispatch.
  await assert.rejects(f.client.fetch(ai));
  assert.equal(f.calls.filter(p => p.endsWith('/register')).length, 1);
  assert.equal(f.calls.filter(p => p === ai).length, 2);
});

test('server restart invalidates sessions but prior identity refreshes without re-registration', async () => {
  const f = fixture(); await f.client.fetch(ai); f.restart();
  assert.equal((await f.client.fetch(ai)).status, 200);
  assert.equal(f.calls.filter(p => p.endsWith('/register')).length, 1);
  assert.equal(f.calls.filter(p => p.endsWith('/verify')).length, 2);
  assert.equal(f.calls.filter(p => p === ai).length, 3); // rejected before processing, then authorized retry
});

test('90s readiness bound aborts a silent connection without auth or AI', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture();
  f.override(async (path, init) => path === '/api/health' ? new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })) : undefined);
  const pending = assert.rejects(f.client.fetch(ai), { name: 'AbortError' });
  await flush(); t.mock.timers.tick(65_000); await flush(); t.mock.timers.tick(250); await flush(); t.mock.timers.tick(24_750); await flush();
  await pending;
  assert.equal(f.calls.every(p => p === '/api/health'), true);
  assert.equal(f.calls.length, 2);
});

test('fast waking 503/HTML responses continue probing until a 60s backend wake', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const started = Date.now(); const f = fixture();
  let probes = 0;
  f.override(async path => {
    if (path === '/api/health' && Date.now() - started < 60_000) {
      probes++;
      return probes % 2 ? Response.json({ error: 'WAKING' }, { status: 503 }) : new Response('<html>Starting</html>', { status: 200 });
    }
  });
  const pending = f.client.fetch(ai); pending.catch(() => {});
  for (let i = 0; i < 16; i++) { await flush(); t.mock.timers.tick(4_000); }
  await flush(); assert.equal((await pending).status, 200);
  assert.equal(f.calls.filter(p => p === ai).length, 1);
});

test('temporary 503 authentication recovery keeps identity and signs a fresh challenge', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(); await f.client.fetch(ai); f.client.invalidateSession();
  let failed = false;
  f.override(async path => { if (path.endsWith('/verify') && !failed) { failed = true; return Response.json({ error: 'AUTH_STORE_UNAVAILABLE' }, { status: 503 }); } });
  const pending = f.client.fetch(ai); await flush(); t.mock.timers.tick(250); await flush();
  assert.equal((await pending).status, 200);
  assert.equal(f.calls.filter(p => p.endsWith('/register')).length, 1);
  assert.equal(f.calls.filter(p => p.endsWith('/challenge')).length, 3);
  assert.equal(f.calls.filter(p => p === ai).length, 2);
  assert.deepEqual(f.events.filter(e => e.phase === 'verify' && e.outcome === 'start').map(e => e.attempt), [1, 1, 2]);
});

test('network failure during AI processing never retries the AI POST', async () => {
  const f = fixture(); f.override(async path => { if (path === ai) throw new TypeError('network'); });
  await assert.rejects(f.client.fetch(ai, { method: 'POST', body: '{}' }));
  assert.equal(f.calls.filter(p => p === ai).length, 1);
});

test('late rejection of an old token cannot invalidate a concurrently refreshed session', async () => {
  const f = fixture(); await f.client.fetch(ai); f.restart();
  let release!: () => void; let arrivals = 0;
  f.override(async (path) => {
    if (path === ai && ++arrivals === 2) {
      await new Promise<void>(resolve => { release = resolve; });
      return Response.json({ error: 'INVALID_ACCESS_TOKEN' }, { status: 401 });
    }
  });
  const first = f.client.fetch(ai); const second = f.client.fetch(ai);
  await first; release(); assert.equal((await second).status, 200);
  assert.equal(f.calls.filter(p => p.endsWith('/verify')).length, 2);
});

test('expired token acquires a new signed session without duplicate AI or registration', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(); await f.client.fetch(ai);
  t.mock.timers.tick(601_000);
  assert.equal((await f.client.fetch(ai)).status, 200);
  assert.equal(f.calls.filter(p => p.endsWith('/verify')).length, 2);
  assert.equal(f.calls.filter(p => p.endsWith('/register')).length, 1);
  assert.equal(f.calls.filter(p => p === ai).length, 2);
});

test('auth network failure retries boundedly and retains prior identity', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(); f.storage.setItem(storageKey, 'prior-id');
  f.override(async (path) => { if (path.endsWith('/challenge')) throw new TypeError('network secret'); });
  const pending = assert.rejects(f.client.fetch(ai));
  await flush(); t.mock.timers.tick(1_000); await flush(); t.mock.timers.tick(1_000); await flush();
  await pending;
  assert.equal(f.calls.filter(p => p.endsWith('/challenge')).length, 3);
  assert.equal(f.storage.getItem(storageKey), 'prior-id');
  assert.equal(f.calls.some(p => p.endsWith('/register') || p === ai), false);
  assert.doesNotMatch(JSON.stringify(f.events), /prior-id|network secret|signature|accessToken|publicKey/);
});

test('whole auth deadline includes a hung signer and prevents late dispatch', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  let late!: (value: any) => void;
  const calls: string[] = [];
  const client = new AuthenticatedApiClient('https://example.test', { getPublicIdentity: () => new Promise(resolve => { late = resolve; }), sign: async () => 'unused' }, null, {
    fetch: async (url: string) => { calls.push(url); return Response.json({ ok: true }); }, now: Date.now, onPhase: () => {},
  });
  const pending = assert.rejects(client.fetch(ai), { name: 'AbortError' });
  await flush(); t.mock.timers.tick(30_001); await flush(); await pending;
  late({ algorithm: 'ECDSA_P256_SHA256', publicKey }); await flush();
  assert.deepEqual(calls, ['https://example.test/api/health']);
});

test('cancelling one readiness waiter preserves another; last cancellation aborts transport', async () => {
  const f = fixture(); let signal!: AbortSignal;
  f.override(async (path, init) => path === '/api/health' ? new Promise((resolve, reject) => {
    signal = init.signal!; signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    setTimeout(() => resolve(Response.json({ ok: true })), 10);
  }) : undefined);
  const a = new AbortController(); const b = new AbortController();
  const first = assert.rejects(f.client.fetch(ai, { signal: a.signal }), { name: 'AbortError' });
  const second = f.client.fetch(ai, { signal: b.signal });
  await flush(); a.abort(); await first;
  assert.equal(signal.aborted, false);
  assert.equal((await second).status, 200);
  const c = new AbortController(); const third = assert.rejects(f.client.fetch(ai, { signal: c.signal }), { name: 'AbortError' });
  await flush(); c.abort(); await third; assert.equal(signal.aborted, true);
});

test('cancel before start never sends health, auth or AI', async () => {
  const f = fixture(); const c = new AbortController(); c.abort();
  await assert.rejects(f.client.fetch(ai, { signal: c.signal }), { name: 'AbortError' });
  assert.deepEqual(f.calls, []);
});

test('one cancelled authentication waiter preserves another signed session acquisition', async () => {
  const f = fixture(); let release!: () => void;
  f.override(async (path) => { if (path.endsWith('/verify')) await new Promise<void>(resolve => { release = resolve; }); });
  const a = new AbortController(); const b = new AbortController();
  const first = assert.rejects(f.client.fetch(ai, { signal: a.signal }), { name: 'AbortError' });
  const second = f.client.fetch(ai, { signal: b.signal }); await flush();
  assert.equal(typeof release, 'function'); a.abort(); await first; release();
  assert.equal((await second).status, 200);
  assert.equal(f.calls.filter(p => p.endsWith('/verify')).length, 1);
  assert.equal(f.calls.filter(p => p === ai).length, 1);
});

test('last auth cancellation ignores a late registration response and cannot persist it or dispatch', async () => {
  const f = fixture(); let release!: () => void;
  f.override(async path => { if (path.endsWith('/register')) await new Promise<void>(resolve => { release = resolve; }); });
  const a = new AbortController(); const pending = assert.rejects(f.client.fetch(ai, { signal: a.signal }), { name: 'AbortError' });
  await flush(); assert.equal(typeof release, 'function'); a.abort(); await pending;
  release(); await flush();
  assert.equal(f.storage.getItem(storageKey), null);
  assert.equal(f.calls.some(p => p.endsWith('/challenge') || p === ai), false);
  f.override(undefined);
  assert.equal((await f.client.fetch(ai)).status, 200);
});
