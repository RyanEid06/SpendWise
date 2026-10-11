import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { AuthenticatedApiClient } from '../src/security/AuthenticatedApiClient';
import { FileInstallationRegistry, InstallationAuthService } from '../server/security/installationAuth';

const ai = '/api/gemini/analyze';
const requestId = '2ba31729-546d-4fe6-96ed-3a7448706912';
const flush = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };
function fixture() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const service = new InstallationAuthService(new FileInstallationRegistry(null));
  const calls: { path: string; headers: Headers; signal?: AbortSignal | null }[] = [];
  let override: ((path: string, init: RequestInit) => Promise<Response | undefined>) | undefined;
  const client = new AuthenticatedApiClient('https://synthetic.invalid', {
    persistent: false,
    getPublicIdentity: async () => ({ algorithm: 'ECDSA_P256_SHA256', publicKey }),
    sign: async payload => sign('sha256', Buffer.from(payload), pair.privateKey).toString('base64'),
  }, null, { now: Date.now, random: () => 0, onPhase: () => {}, fetch: async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ path, headers: new Headers(init.headers), signal: init.signal });
    const replacement = await override?.(path, init);
    if (replacement) return replacement;
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (path === '/api/health') return Response.json({ ok: true });
    if (path.endsWith('/register')) return Response.json({ installationId: (await service.register(body.publicKey, body.algorithm)).record.id });
    if (path.endsWith('/challenge')) return Response.json(await service.issueChallenge(body.installationId));
    if (path.endsWith('/verify')) return Response.json(await service.verifyChallenge(body.installationId, body.challengeId, body.signature));
    await service.validateAccessToken(new Headers(init.headers).get('Authorization')!.slice(7));
    return Response.json({ ok: true });
  } });
  return { client, calls, override: (fn: typeof override) => { override = fn; } };
}

test('one operation preserves incoming correlation through actual readiness, signing and dispatch phases', async () => {
  const f = fixture(); const phases: any[] = [];
  assert.equal((await f.client.fetch(ai, { headers: { 'X-Request-ID': requestId }, onPhase: (e: unknown) => phases.push(e) } as any)).status, 200);
  assert.deepEqual(phases.filter(e => e.outcome === 'start').map(e => e.phase), ['readiness', 'register', 'challenge', 'verify', 'ai_dispatch']);
  assert.ok(phases.every(e => e.requestId === requestId));
  assert.ok(f.calls.every(c => c.headers.get('X-Request-ID') === requestId));
});

test('late readiness subscriber receives active phase; cancelling its leader neither dispatches nor leaks callbacks', async t => {
  const f = fixture(); let ready!: (r: Response) => void;
  f.override(async path => path === '/api/health' ? new Promise(resolve => { ready = resolve; }) : undefined);
  const leader = new AbortController(); const first: any[] = []; const second: any[] = [];
  t.after(() => { leader.abort(); ready?.(Response.json({ ok: true })); });
  const a = f.client.fetch(ai, { signal: leader.signal, onPhase: (e: unknown) => first.push(e) } as any);
  const cancelled = assert.rejects(a, (e: any) => e.name === 'AbortError');
  await flush();
  const b = f.client.fetch(ai, { onPhase: (e: unknown) => second.push(e) } as any);
  void b.catch(() => {});
  await flush();
  assert.deepEqual(second.map(e => [e.phase, e.outcome]), [['readiness', 'start']]);
  leader.abort(); await cancelled; const count = first.length;
  ready(Response.json({ ok: true }));
  assert.equal((await b).status, 200);
  assert.equal(first.length, count);
  assert.equal(f.calls.filter(c => c.path === ai).length, 1);
  assert.deepEqual(second.filter(e => e.outcome === 'start').map(e => e.phase), ['readiness', 'register', 'challenge', 'verify', 'ai_dispatch']);
});

test('late authentication subscriber survives leader cancellation and sees only its own dispatch', async t => {
  const f = fixture(); let verify!: (r: Response | undefined) => void;
  f.override(async path => path.endsWith('/verify') ? new Promise(resolve => { verify = resolve; }) : undefined);
  const leader = new AbortController(); const first: any[] = []; const second: any[] = [];
  t.after(() => { leader.abort(); verify?.(undefined); });
  const a = f.client.fetch(ai, { signal: leader.signal, onPhase: (e: unknown) => first.push(e) } as any);
  const cancelled = assert.rejects(a, (e: any) => e.name === 'AbortError');
  await flush();
  const b = f.client.fetch(ai, { onPhase: (e: unknown) => second.push(e) } as any);
  void b.catch(() => {});
  await flush();
  assert.ok(second.some(e => e.phase === 'verify' && e.outcome === 'start'));
  leader.abort(); await cancelled; const count = first.length;
  verify(undefined); assert.equal((await b).status, 200);
  assert.equal(first.length, count);
  assert.equal(second.filter(e => e.phase === 'ai_dispatch' && e.outcome === 'start').length, 1);
  assert.equal(f.calls.filter(c => c.path === ai).length, 1);
});

test('stale-token refresh shares the processing allowance across both response bodies', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(); let attempts = 0;
  f.override(async path => {
    if (path !== ai) return undefined;
    if (++attempts === 1) return new Promise(resolve => setTimeout(() => resolve(Response.json({ error: 'ACCESS_TOKEN_EXPIRED' }, { status: 401 })), 80));
    return new Response(new ReadableStream({ start() {} }));
  });
  const pending = f.client.fetch(ai, {}, 100);
  let outcome: unknown;
  const settled = pending.then(value => { outcome = value; }, error => { outcome = error; });
  await flush(); t.mock.timers.tick(80); await flush();
  assert.equal(attempts, 2);
  t.mock.timers.tick(20); await flush(); const atDeadline = outcome;
  t.mock.timers.tick(100); await flush(); await settled;
  assert.equal((atDeadline as Error)?.name, 'TimeoutError');
  assert.equal(f.calls.filter(c => c.path === ai).length, 2);
});

test('readiness deadline remains a timeout rather than being mislabeled explicit cancellation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture(); f.override(async path => path === '/api/health' ? new Promise(() => {}) : undefined);
  const pending = f.client.fetch(ai);
  const rejected = assert.rejects(pending, (e: any) => e.name === 'TimeoutError');
  await flush(); t.mock.timers.tick(90_000); await flush(); await rejected;
  assert.equal(f.calls.filter(c => c.path === ai).length, 0);
});
