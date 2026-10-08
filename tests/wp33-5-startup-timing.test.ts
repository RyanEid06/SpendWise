import test from 'node:test';
import assert from 'node:assert/strict';
import { AndroidSecureKeyService } from '../src/security/SecureKeyService';
import { DefaultSecureSessionService } from '../src/security/SecureSessionService';
import { SecurityStateStore } from '../src/security/SecurityStateStore';
import { legacyAppLockService } from '../src/features/security/LegacyAppLockService';
import { StartupHomeFrameTiming, type AnimationFrameScheduler } from '../src/app/startup/StartupHomeFrameTiming';
import { DiagnosticStore } from '../src/services/diagnostics/DiagnosticStore';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function makeNativeUnlock(options: {
  existingKey?: boolean;
  legacyPin?: string;
  authenticationTimestamp?: number;
  failPrime?: boolean;
} = {}) {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  storage.setItem('spendwise_app_lock_enabled', 'true');
  if (options.legacyPin) storage.setItem('spendwise_lock_pin', options.legacyPin);
  const state = new SecurityStateStore(storage);
  if (options.existingKey !== false) {
    state.setActiveKey({ version: 1, keyVersion: 1, authenticationRequired: true });
    state.setNativeMigration('complete');
    state.setWrappedSecret('database', {
      format: 'spendwise-wrap-v1', keyVersion: 1, alias: 'spendwise.local-kek.v1',
      purpose: 'database', nonceBase64: 'AA==', ciphertextBase64: 'AA==',
    });
  }
  let primed = false;
  const adapter = {
    isAvailable: () => true,
    setPrivacyShield: async (enabled: boolean) => enabled,
    getKeyStatus: async () => ({ status: 'present' }),
    ensureKey: async () => ({ status: 'present' }),
    deleteKey: async () => ({ deleted: true }),
    verifyKey: async () => ({
      status: 'success', postAuthKeyVerifyDurationMs: 45,
      ...(options.authenticationTimestamp === undefined ? {} : {
        authSucceededAtElapsedRealtimeMs: options.authenticationTimestamp,
      }),
    }),
    unwrapSecret: async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      primed = true;
      return options.failPrime
        ? { status: 'error', code: 'PRIME_FAILED', keyStatus: 'present' }
        : { status: 'success', secretBase64: 'AQIDBA==' };
    },
  };
  const keyService = new AndroidSecureKeyService(adapter as any, state);
  const session = new DefaultSecureSessionService(
    keyService, adapter as any, state, legacyAppLockService
  );
  return { keyService, session, isPrimed: () => primed };
}

test('WP33.5 key verification preserves the native authentication start across secret priming', async () => {
  const { keyService, isPrimed } = makeNativeUnlock({ authenticationTimestamp: 123_456 });
  const result = await keyService.verifyActiveKey('Unlock SpendWise');
  assert.equal(isPrimed(), true);
  assert.equal(result.ok, true);
  assert.equal((result as any).authSucceededAtElapsedRealtimeMs, 123_456);
});

test('WP33.5 native unlock carries the authentication start through privacy shielding', async () => {
  const { session } = makeNativeUnlock({ authenticationTimestamp: 123_456 });
  await session.initialize();
  assert.equal(session.getSnapshot().state, 'locked');
  const result = await session.unlock();
  assert.equal(result.ok, true);
  assert.equal((result as any).authSucceededAtElapsedRealtimeMs, 123_456);
  assert.equal(session.getSnapshot().state, 'unlocked');
});

test('WP33.5 first key establishment and legacy migration preserve the native authentication start', async () => {
  const { session } = makeNativeUnlock({
    existingKey: false, legacyPin: '1234', authenticationTimestamp: 234_567,
  });
  await session.initialize();
  const result = await session.unlock('1234');
  assert.equal(result.ok, true);
  assert.equal((result as any).authSucceededAtElapsedRealtimeMs, 234_567);
});

test('WP33.5 an older native bridge without timing metadata remains unlock compatible', async () => {
  const { session } = makeNativeUnlock();
  await session.initialize();
  assert.deepEqual(await session.unlock(), { ok: true, code: 'success' });
});

test('WP33.5 secret priming failure cannot expose an unlocked session or successful timing', async () => {
  const { session } = makeNativeUnlock({ authenticationTimestamp: 123_456, failPrime: true });
  await session.initialize();
  const result = await session.unlock();
  assert.equal(result.ok, false);
  assert.equal(session.getSnapshot().state, 'locked');
  assert.equal((result as any).authSucceededAtElapsedRealtimeMs, undefined);
});

class ManualFrames implements AnimationFrameScheduler {
  private next = 0;
  private callbacks = new Map<number, () => void>();
  request(callback: () => void) { const handle = ++this.next; this.callbacks.set(handle, callback); return handle; }
  cancel(handle: number) { this.callbacks.delete(handle); }
  step() {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback();
  }
  get pending() { return this.callbacks.size; }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('WP33.5 Home timing includes native key priming and storage delays and waits for a committed paint', async () => {
  const frames = new ManualFrames();
  const store = new DiagnosticStore(null);
  // Android elapsedRealtime values differ completely from performance.now().
  const authSucceededAt = 9_500_000;
  const nativeNowAfterHomePaint = 9_500_827;
  const timing = new StartupHomeFrameTiming(() => nativeNowAfterHomePaint - authSucceededAt, frames, store);
  assert.equal(store.report().timings['startup.home_frame'], undefined);
  const cancel = timing.onCommittedHomeFrame(true);
  assert.equal(store.report().timings['startup.home_frame'], undefined);
  frames.step();
  await flush();
  assert.equal(store.report().timings['startup.home_frame'], undefined);
  frames.step();
  await flush();
  assert.deepEqual(store.report().timings['startup.home_frame'], { count: 1, meanMs: 827, maxMs: 827 });
  cancel();
  timing.onCommittedHomeFrame(true);
  frames.step(); frames.step(); await flush();
  assert.equal(store.report().timings['startup.home_frame']?.count, 1);
});

test('WP33.5 setup, locked and other-screen commits never record a Home frame', async () => {
  const frames = new ManualFrames();
  const store = new DiagnosticStore(null);
  const timing = new StartupHomeFrameTiming(() => 850, frames, store);
  timing.onCommittedHomeFrame(false);
  frames.step(); frames.step(); await flush();
  assert.equal(store.report().timings['startup.home_frame'], undefined);
  timing.onCommittedHomeFrame(true);
  frames.step(); frames.step(); await flush();
  assert.equal(store.report().timings['startup.home_frame']?.count, 1);
});

test('WP33.5 StrictMode effect replay cancels the abandoned attempt and records once', async () => {
  const frames = new ManualFrames();
  const store = new DiagnosticStore(null);
  const timing = new StartupHomeFrameTiming(() => 850, frames, store);
  const cancelAbandoned = timing.onCommittedHomeFrame(true);
  cancelAbandoned();
  assert.equal(frames.pending, 0);
  timing.onCommittedHomeFrame(true);
  frames.step(); frames.step(); await flush();
  assert.equal(store.report().timings['startup.home_frame']?.count, 1);
});

test('WP33.5 leaving Home between frame callbacks cancels the sample', async () => {
  const frames = new ManualFrames();
  const store = new DiagnosticStore(null);
  const timing = new StartupHomeFrameTiming(() => 850, frames, store);
  const cancel = timing.onCommittedHomeFrame(true);
  frames.step();
  cancel();
  timing.onCommittedHomeFrame(false);
  frames.step(); await flush();
  assert.equal(store.report().timings['startup.home_frame'], undefined);
  assert.equal(frames.pending, 0);
});

test('WP33.5 a cancelled native clock response cannot win a later committed Home attempt', async () => {
  const frames = new ManualFrames();
  const store = new DiagnosticStore(null);
  let resolveOld!: (duration: number) => void;
  let resolveCurrent!: (duration: number) => void;
  const oldDuration = new Promise<number>((resolve) => { resolveOld = resolve; });
  const currentDuration = new Promise<number>((resolve) => { resolveCurrent = resolve; });
  let reads = 0;
  const timing = new StartupHomeFrameTiming(() => ++reads === 1 ? oldDuration : currentDuration, frames, store);
  const cancel = timing.onCommittedHomeFrame(true);
  frames.step(); frames.step();
  cancel();
  timing.onCommittedHomeFrame(true);
  frames.step(); frames.step();
  resolveOld(800);
  await flush();
  assert.equal(store.report().timings['startup.home_frame'], undefined);
  resolveCurrent(950);
  await flush();
  assert.deepEqual(store.report().timings['startup.home_frame'], { count: 1, meanMs: 950, maxMs: 950 });
});

test('WP33.5 a failing native clock never records a successful Home duration', async () => {
  const frames = new ManualFrames();
  const store = new DiagnosticStore(null);
  const timing = new StartupHomeFrameTiming(() => Promise.reject(new Error('bridge unavailable')), frames, store);
  timing.onCommittedHomeFrame(true);
  frames.step(); frames.step(); await flush();
  assert.equal(store.report().timings['startup.home_frame'], undefined);
  assert.equal(store.report().recentErrors.at(-1)?.code, 'STARTUP_HOME_FRAME_FAILED');
});
