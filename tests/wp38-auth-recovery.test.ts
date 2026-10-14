import test from 'node:test';
import assert from 'node:assert/strict';
import { DefaultSecureSessionService } from '../src/security/SecureSessionService';
import { AndroidSecureKeyService } from '../src/security/SecureKeyService';
import { SecurityStateStore } from '../src/security/SecurityStateStore';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { this.values.set(k, v); }
  removeItem(k: string) { this.values.delete(k); }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function fixture() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  storage.setItem('spendwise_app_lock_enabled', 'true');
  storage.setItem('spendwise_lock_timeout_seconds', '0');
  const state = new SecurityStateStore(storage as Storage);
  state.setNativeMigration('complete');
  state.setActiveKey({ version: 1, keyVersion: 1, authenticationRequired: true });
  state.setWrappedSecret('database', { format: 'spendwise-wrap-v1', keyVersion: 1, alias: 'fixture', purpose: 'database', nonceBase64: 'AA==', ciphertextBase64: 'AA==' });
  const requests: ReturnType<typeof deferred<any>>[] = [];
  const cancellation = deferred<{ cancelled: boolean }>();
  let reads = 0;
  const adapter = {
    isAvailable: () => true,
    setPrivacyShield: async () => true,
    getKeyStatus: async () => ({ status: 'present' }),
    verifyKey: () => { const request = deferred<any>(); requests.push(request); return request.promise; },
    cancelAuthentication: () => cancellation.promise,
    unwrapSecret: async () => { reads++; return { status: 'success', secretBase64: 'AQIDBA==' }; },
  };
  const key = new AndroidSecureKeyService(adapter as any, state);
  const session = new DefaultSecureSessionService(key, adapter as any, state);
  await session.initialize();
  return { session, requests, cancellation, key, reads: () => reads, adapter };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

test('WP38 recovery invalidates a hung real key operation before native cancellation acknowledgment, then allows retry', async () => {
  const f = await fixture();
  const first = f.session.unlock();
  await flush();
  const revision = f.session.getSnapshot().sessionRevision;
  const recovery = f.session.cancelPendingAuthentication();
  assert.ok(f.session.getSnapshot().sessionRevision > revision);
  assert.equal((await f.session.unlock()).ok, false);
  f.cancellation.resolve({ cancelled: true });
  assert.equal(await recovery, true);
  const second = f.session.unlock();
  await flush();
  assert.equal(f.requests.length, 2);
  f.requests[0].resolve({ status: 'success' });
  assert.equal((await first).ok, false);
  assert.equal(f.session.getSnapshot().state, 'locked');
  assert.equal(f.reads(), 0);
  assert.equal((await f.session.unlock()).ok, false, 'old finally cannot release the newer request');
  f.requests[1].resolve({ status: 'success' });
  assert.equal((await second).ok, true);
  assert.equal(f.reads(), 1);
});

test('WP38 late old result cannot release secrets belonging to a recovered successful session', async () => {
  const f = await fixture();
  const first = f.session.unlock();
  await flush();
  f.cancellation.resolve({ cancelled: true });
  assert.equal(await f.session.cancelPendingAuthentication(), true);
  const second = f.session.unlock();
  await flush();
  f.requests[1].resolve({ status: 'success' });
  assert.equal((await second).ok, true);
  f.requests[0].resolve({ status: 'success' });
  assert.equal((await first).ok, false);
  assert.equal(f.session.getSnapshot().state, 'unlocked');
  const secret = await f.key.withUnwrappedSecret('database', bytes => [...bytes]);
  assert.deepEqual(secret, { ok: true, value: [1, 2, 3, 4] });
  assert.equal(f.reads(), 1, 'late operation must not clear the newer authenticated cache');
});

test('WP38 bounded recovery cancellation failure stays locked and never overlaps native requests', async () => {
  const f = await fixture();
  f.adapter.cancelAuthentication = async () => { throw new Error('bridge failed'); };
  const first = f.session.unlock();
  await flush();
  assert.equal(await f.session.cancelPendingAuthentication(), false);
  assert.equal((await f.session.unlock()).ok, false);
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve({ status: 'success' });
  assert.equal((await first).ok, false);
  assert.equal(f.session.getSnapshot().state, 'locked');
});

test('WP38 recovery during key-status lookup cannot launch a late native prompt', async () => {
  const f = await fixture();
  const status = deferred<any>();
  f.adapter.getKeyStatus = () => status.promise;
  const first = f.session.unlock();
  await flush();
  f.cancellation.resolve({ cancelled: true });
  await f.session.cancelPendingAuthentication();
  status.resolve({ status: 'present' });
  await flush();
  assert.equal(f.requests.length, 0);
  assert.equal((await first).ok, false);
});

test('WP38 a later explicit retry recovers when native cancellation was temporarily unavailable', async () => {
  const f = await fixture();
  f.adapter.cancelAuthentication = async () => { throw new Error('temporary bridge failure'); };
  const first = f.session.unlock();
  await flush();
  assert.equal(await f.session.cancelPendingAuthentication(), false);
  f.adapter.cancelAuthentication = async () => ({ cancelled: true });
  const second = f.session.unlock();
  await flush();
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ status: 'success' });
  assert.equal((await second).ok, true);
  f.requests[0].resolve({ status: 'success' });
  assert.equal((await first).ok, false);
  assert.equal(f.session.getSnapshot().state, 'unlocked');
});

test('WP38 background locking acknowledges cancellation before releasing a hung sensitive operation', async () => {
  const f = await fixture();
  const first = f.session.requireFreshAuthentication('plaintext-export');
  await flush();
  f.session.lock();
  assert.equal((await f.session.unlock()).ok, false);
  f.cancellation.resolve({ cancelled: true });
  await flush();
  const second = f.session.unlock();
  await flush();
  assert.equal(f.requests.length, 2);
  f.requests[1].resolve({ status: 'success' });
  assert.equal((await second).ok, true);
  f.requests[0].resolve({ status: 'success' });
  assert.equal((await first).ok, false);
  assert.equal(f.session.getSnapshot().state, 'unlocked');
});
