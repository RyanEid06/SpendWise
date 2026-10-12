import test from 'node:test';
import assert from 'node:assert/strict';
import { DefaultSecureSessionService } from '../src/security/SecureSessionService';
import { AndroidSecureKeyService } from '../src/security/SecureKeyService';
import { SecurityStateStore } from '../src/security/SecurityStateStore';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { LockScreen } from '../src/screens/LockScreen';
import * as AndroidSecurity from '../src/platform/android/AndroidSecurityAdapter';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) { return this.values.get(k) ?? null; }
  setItem(k: string, v: string) { this.values.set(k, v); }
  removeItem(k: string) { this.values.delete(k); }
  key(i: number) { return [...this.values.keys()][i] ?? null; }
  get length() { return this.values.size; }
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function fixture(timeout = 60) {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  storage.setItem('spendwise_app_lock_enabled', 'true');
  storage.setItem('spendwise_lock_timeout_seconds', String(timeout));
  const state = new SecurityStateStore(storage);
  state.setNativeMigration('complete');
  const pending = deferred<any>();
  const key = {
    calls: 0, released: 0,
    async establish() { this.calls++; return pending.promise; },
    releaseSessionSecrets() { this.released++; },
  };
  const adapter = { isAvailable: () => true, setPrivacyShield: async () => true };
  const service = new DefaultSecureSessionService(key as any, adapter as any, state);
  return { service, key, pending, state, storage };
}

test('WP37 a stale native success cannot unlock after returning from Home past timeout', async () => {
  const { service, pending, key } = fixture();
  await service.initialize();
  const request = service.unlock();
  await Promise.resolve();
  service.onBackground(1_000);
  assert.equal(service.onForeground(61_000), true);
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  assert.equal((await request).ok, false);
  assert.equal(service.getSnapshot().state, 'locked');
  assert.ok(key.released > 0);
});

test('WP37 rapid native unlock requests start only one protected operation', async () => {
  const { service, pending, key } = fixture();
  await service.initialize();
  const first = service.unlock();
  const second = service.unlock();
  await Promise.resolve();
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  const results = await Promise.all([first, second]);
  assert.equal(key.calls, 1);
  assert.equal(results.filter(r => r.ok).length, 1);
});

test('WP37 immediate lock invalidates pending native authentication without waiting for foreground', async () => {
  const { service, pending } = fixture(0);
  await service.initialize();
  const request = service.unlock();
  await Promise.resolve();
  service.onBackground(1_000);
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  assert.equal((await request).ok, false);
  assert.equal(service.getSnapshot().state, 'locked');
});

test('WP37 cancelled authentication does not start recovery automatically', async () => {
  const { service, pending, key } = fixture();
  await service.initialize();
  const request = service.unlock();
  pending.resolve({ ok: false, kind: 'cancelled' });
  assert.equal((await request).code, 'cancelled');
  assert.equal(key.calls, 1);
  assert.equal(service.getSnapshot().state, 'locked');
});

test('WP37 missing or invalidated established keys are never automatically replaced even without wrapped secrets', async () => {
  for (const status of ['missing', 'invalidated', 'unrecoverable'] as const) {
    const storage = new MemoryStorage();
    const state = new SecurityStateStore(storage);
    state.setActiveKey({ version: 1, keyVersion: 1, authenticationRequired: true });
    let generated = 0; let deleted = 0;
    const adapter = {
      isAvailable: () => true,
      getKeyStatus: async () => ({ status }),
      ensureKey: async () => { generated++; return { status: 'present' }; },
      verifyKey: async () => ({ status: 'success' }),
      deleteKey: async () => { deleted++; return { deleted: true }; },
    };
    const service = new AndroidSecureKeyService(adapter as any, state);
    const result = await service.establish(true, 'unlock');
    assert.equal(result.ok, false);
    assert.equal(generated, 0);
    assert.equal(deleted, 0);
    assert.equal(state.getActiveKey()?.keyVersion, 1);
  }
});

test('WP37 each semantic action has intentional distinct EN FR AR title/reason and no internal IDs', async () => {
  const module = await import('../src/security/authenticationCopy').catch(() => null);
  assert.ok(module, 'semantic localized authentication contract exists');
  for (const language of ['en', 'fr', 'ar'] as const) {
    for (const action of module.AUTHENTICATION_ACTIONS) {
      const copy = module.authenticationPrompt(action, language);
      assert.ok(copy.title.length > 4);
      assert.ok(copy.reason.length > 10);
      assert.notEqual(copy.title, copy.reason);
      assert.ok(!copy.title.includes(action));
      assert.ok(!copy.reason.includes(action));
      if (language === 'ar') assert.match(copy.title, /[\u0600-\u06ff]/);
      assert.ok(copy.credentialButton.length > 4);
    }
  }
});

test('WP37 releasing session while verification is pending prevents secret priming', async () => {
  const { state } = fixture();
  state.setActiveKey({ version: 1, keyVersion: 1, authenticationRequired: true });
  state.setWrappedSecret('database', { format: 'spendwise-wrap-v1', keyVersion: 1, alias: 'fixture', purpose: 'database', nonceBase64: 'AA==', ciphertextBase64: 'AA==' });
  const pending = deferred<any>();
  let reads = 0;
  const adapter = {
    isAvailable: () => true,
    getKeyStatus: async () => ({ status: 'present' }),
    verifyKey: () => pending.promise,
    unwrapSecret: async () => { reads++; return { status: 'success', secretBase64: 'AQIDBA==' }; },
  };
  const key = new AndroidSecureKeyService(adapter as any, state);
  const request = key.verifyActiveKey('unlock');
  await Promise.resolve();
  key.releaseSessionSecrets();
  pending.resolve({ status: 'success' });
  assert.equal((await request).ok, false);
  assert.equal(reads, 0);
});

test('WP37 failed verification never deletes an existing native alias without metadata', async () => {
  const state = new SecurityStateStore(new MemoryStorage());
  let deletes = 0;
  const adapter = {
    isAvailable: () => true,
    ensureKey: async () => ({ status: 'present', created: false }),
    verifyKey: async () => ({ status: 'cancelled' }),
    deleteKey: async () => { deletes++; return { deleted: true }; },
  };
  const key = new AndroidSecureKeyService(adapter as any, state);
  assert.equal((await key.establish(true, 'unlock')).ok, false);
  assert.equal(deletes, 0);
});

test('WP37 completed migration with lost active metadata fails closed without generating a replacement', async () => {
  const { state } = fixture();
  let creates = 0;
  const adapter = {
    isAvailable: () => true,
    ensureKey: async () => { creates++; return { status: 'present' }; },
    verifyKey: async () => ({ status: 'success' }),
  };
  const key = new AndroidSecureKeyService(adapter as any, state);
  assert.equal((await key.establish(true, 'unlock')).ok, false);
  assert.equal(creates, 0);
});

test('WP37 lockscreen migration failure describes repair instead of generic authentication failure', () => {
  for (const language of ['en', 'fr', 'ar'] as const) {
    const html = renderToStaticMarkup(createElement(LockScreen, {
      unlockMode: 'native-repair', migrationIssue: 'KEY_INVALIDATED', language,
      onUnlock: async () => ({ ok: false, code: 'invalidated_key' }),
    }));
    assert.ok(!html.includes('KEY_INVALIDATED'));
    assert.ok(!html.includes(language === 'en' ? 'Authentication failed. Try again.' : language === 'fr' ? 'Échec de l’authentification. Réessayez.' : 'فشلت المصادقة. حاول مجددًا.'));
  }
});

test('WP37 protected sensitive scopes reject stale success after explicit lock', async () => {
  for (const scope of ['disable-app-lock', 'security-configuration', 'replace-restore', 'clear-app-data', 'plaintext-export'] as const) {
    const { service, pending } = fixture();
    await service.initialize();
    const request = service.requireFreshAuthentication(scope);
    await Promise.resolve();
    service.lock();
    pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
    assert.equal((await request).ok, false, scope);
    assert.equal(service.getSnapshot().state, 'locked', scope);
  }
});

test('WP37 only session-bound OS credential activity exempts native background bookkeeping', async () => {
  const { service, pending } = fixture(60);
  (service as any).nativeAdapter.getAuthenticationLifecycle = async () => ({ systemCredentialActive: true });
  await service.initialize();
  const request = service.unlock(undefined, 'device-credential');
  await Promise.resolve();
  await service.onNativeBackground(1_000);
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  assert.equal((await request).ok, true);
  assert.equal(service.getSnapshot().state, 'unlocked');
});

test('WP37 native biometric authentication never exempts real immediate background lock', async () => {
  const { service, pending } = fixture(0);
  (service as any).nativeAdapter.getAuthenticationLifecycle = async () => ({ systemCredentialActive: false });
  await service.initialize();
  const request = service.unlock();
  await Promise.resolve();
  await service.onNativeBackground(1_000);
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  assert.equal((await request).ok, false);
  assert.equal(service.getSnapshot().state, 'locked');
});

test('WP37 legacy external credential classification never exempts immediate background lock', async () => {
  const { service, pending } = fixture(0);
  (service as any).nativeAdapter.getAuthenticationLifecycle = async () => ({ systemCredentialActive: true });
  await service.initialize();
  const request = service.unlock();
  await Promise.resolve();
  await service.onNativeBackground(1_000);
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  assert.equal((await request).ok, false);
  assert.equal(service.getSnapshot().state, 'locked');
});

test('WP37 native Home cancellation locks an already-open sensitive session even during an OS credential activity', async () => {
  const { service, pending, key } = fixture(60);
  await service.initialize();
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  assert.equal((await service.unlock()).ok, true);
  key.establish = async () => ({ ok: false, kind: 'cancelled', code: 'AUTHENTICATION_BACKGROUND_TIMEOUT' });
  assert.equal((await service.requireFreshAuthentication('plaintext-export')).ok, false);
  assert.equal(service.getSnapshot().state, 'locked');
});

test('WP37 cancelling legacy upgrade preserves PIN but never unlocks the cancelled presentation', async () => {
  const { service, pending, storage, state } = fixture();
  storage.setItem('spendwise_lock_pin', '2468');
  state.setNativeMigration('pending');
  await service.initialize();
  const request = service.unlock('2468');
  pending.resolve({ ok: false, kind: 'cancelled', code: 'CREDENTIAL_CANCELLED' });
  assert.equal((await request).ok, false);
  assert.equal(service.getSnapshot().state, 'locked');
  assert.equal(storage.getItem('spendwise_lock_pin'), '2468');
});

test('WP37 platform capabilities distinguish biometric credential combinations and terminal conditions', () => {
  const classify = (AndroidSecurity as any).classifyNativeAuthenticationCapabilities;
  assert.equal(typeof classify, 'function');
  const capabilities = { platform: 'android', canAuthenticate: true, combinedAuthenticatorsSupported: false };
  assert.equal(classify({ ...capabilities, biometricStrongAvailable: true, deviceCredentialAvailable: true }), 'biometric-and-credential');
  assert.equal(classify({ ...capabilities, biometricStrongAvailable: true, deviceCredentialAvailable: false }), 'biometric-only');
  assert.equal(classify({ ...capabilities, biometricStrongAvailable: false, deviceCredentialAvailable: true }), 'credential-only');
  assert.equal(classify({ ...capabilities, biometricStrongAvailable: false, deviceCredentialAvailable: false }), 'unavailable');
  assert.equal(classify({ ...capabilities, biometricStrongAvailable: true, deviceCredentialAvailable: true }, 'temporary-lockout'), 'temporary-lockout');
  assert.equal(classify({ ...capabilities, biometricStrongAvailable: false, deviceCredentialAvailable: true }, 'permanent-lockout'), 'permanent-lockout');
});

test('WP37 adapter forwards selected app language semantic copy and explicit method to native verification', async () => {
  const { storage } = fixture(60);
  const calls: any[] = [];
  const bridge = { verifyKey: async (options: any) => { calls.push(options); return { status: 'success' }; } };
  const adapter = new AndroidSecurity.AndroidSecurityAdapter(bridge as any);
  for (const language of ['en', 'fr', 'ar'] as const) {
    storage.setItem('spendwise_language', language);
    await adapter.verifyKey(1, true, 'plaintext-export', 'device-credential');
  }
  assert.equal(calls.length, 3);
  assert.equal(calls[0].title, 'Export readable data');
  assert.match(calls[1].reason, /Confirmez votre identité/);
  assert.match(calls[2].reason, /أكّد هويتك/);
  for (const call of calls) {
    assert.equal(call.method, 'device-credential');
    assert.equal(call.lockTimeoutSeconds, 60);
    assert.equal(call.authenticationRequired, true);
    assert.ok(!call.title.includes('plaintext-export'));
    assert.notEqual(call.title, call.reason);
  }
});

test('WP37 legacy credential-only devices cannot be configured into an unusable immediate lock', async () => {
  const { service, pending, storage } = fixture(60);
  (service as any).nativeAdapter.getCapabilities = async () => ({ apiLevel: 29, biometricStrongAvailable: false, deviceCredentialAvailable: true });
  await service.initialize();
  pending.resolve({ ok: true, value: { version: 1, keyVersion: 1, authenticationRequired: true } });
  await service.unlock();
  const result = await service.setLockTimeoutSeconds(0);
  assert.equal(result.ok, false);
  assert.equal(result.detailCode, 'CREDENTIAL_IMMEDIATE_LOCK_UNSUPPORTED');
  assert.equal(storage.getItem('spendwise_lock_timeout_seconds'), '60');
});

test('WP37 policy changes never replace a missing or invalidated old key when wrapped registry is empty', async () => {
  for (const status of ['missing', 'invalidated', 'unrecoverable'] as const) {
    const state = new SecurityStateStore(new MemoryStorage());
    state.setActiveKey({ version: 1, keyVersion: 1, authenticationRequired: false });
    let creates = 0;
    const adapter = {
      isAvailable: () => true,
      getKeyStatus: async () => ({ status }),
      ensureKey: async () => { creates++; return { status: 'present' }; },
      verifyKey: async () => ({ status: 'success' }),
      deleteKey: async () => ({ deleted: true }),
    };
    const key = new AndroidSecureKeyService(adapter as any, state);
    assert.equal((await key.establish(true, 'enable-app-lock')).ok, false);
    assert.equal(creates, 0);
    assert.equal(state.getActiveKey()?.keyVersion, 1);
  }
});
