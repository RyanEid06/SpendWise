import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DefaultSecureSessionService,
  shouldLockAfterTimeout,
} from '../src/security/SecureSessionService';
import type {
  SecureKeyResult,
  SecureKeyService,
} from '../src/security/SecureKeyService';
import {
  SecurityStateStore,
  SECURITY_STATE_KEYS,
} from '../src/security/SecurityStateStore';
import { legacyAppLockService } from '../src/features/security/LegacyAppLockService';
import { WebPinService, WEB_PIN_KDF } from '../src/security/WebPinService';
import {
  clearLockThrottle,
  readLockThrottleState,
  recordLockFailure,
  remainingLockDelayMs,
} from '../src/utils/lockThrottle';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
}

class FakeKeyService implements SecureKeyService {
  active = { version: 1 as const, keyVersion: 1, authenticationRequired: true };
  protectedSecrets = false;
  establishResult: SecureKeyResult<any> = { ok: true, value: this.active };
  verifyResult: SecureKeyResult<any> = { ok: true, value: this.active };
  rotateResult: SecureKeyResult<any> = { ok: true, value: { ...this.active } };
  establishCalls: Array<{ authenticationRequired: boolean; reason: string }> = [];
  released = 0;

  getActiveKey() { return this.active; }
  hasProtectedSecrets() { return this.protectedSecrets; }
  async establish(authenticationRequired: boolean, reason: string) {
    this.establishCalls.push({ authenticationRequired, reason });
    return this.establishResult;
  }
  async verifyActiveKey(_reason: string) { return this.verifyResult; }
  async rotateAuthenticationPolicy(authenticationRequired: boolean, _reason: string) {
    if (this.rotateResult.ok) {
      this.rotateResult.value.authenticationRequired = authenticationRequired;
    }
    return this.rotateResult;
  }
  async ensureWrappedSecret(_purpose: string, _byteLength?: number): Promise<SecureKeyResult<any>> {
    return { ok: false, kind: 'missing', code: 'TEST_ONLY' };
  }
  async withUnwrappedSecret<T>(
    _purpose: string,
    _consumer: (secret: Uint8Array) => Promise<T> | T
  ): Promise<SecureKeyResult<T>> {
    return { ok: false, kind: 'missing', code: 'TEST_ONLY' };
  }
  releaseSessionSecrets() { this.released += 1; }
}

class FakeNativeAdapter {
  shield: boolean[] = [];
  isAvailable() { return true; }
  async setPrivacyShield(enabled: boolean) {
    this.shield.push(enabled);
    return enabled;
  }
}

function installStorage(storage: MemoryStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
}

function makeNativeService(
  storage: MemoryStorage,
  key = new FakeKeyService(),
  adapter = new FakeNativeAdapter()
) {
  installStorage(storage);
  const state = new SecurityStateStore(storage);
  const service = new DefaultSecureSessionService(
    key,
    adapter as any,
    state,
    legacyAppLockService,
    new WebPinService()
  );
  return { service, key, adapter, state };
}

test('WP28 native migration removes plaintext PIN only after secure establishment succeeds', async () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'true');
  storage.setItem('spendwise_lock_pin', '2468');
  const { service, state } = makeNativeService(storage);

  await service.initialize();
  assert.equal(service.getSnapshot().state, 'locked');
  assert.equal(service.getSnapshot().unlockMode, 'legacy-native-migration');

  const result = await service.unlock('2468');
  assert.equal(result.ok, true);
  assert.equal(storage.getItem('spendwise_lock_pin'), null);
  assert.equal(state.getNativeMigration()?.status, 'complete');
  assert.equal(service.getSnapshot().state, 'unlocked');
});

test('WP28 enabled legacy App Lock rejects a wrong PIN before native migration', async () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'true');
  storage.setItem('spendwise_lock_pin', '1357');
  const { service, key } = makeNativeService(storage);

  await service.initialize();
  const result = await service.unlock('9999');
  assert.deepEqual(result, { ok: false, code: 'invalid_credential' });
  assert.equal(storage.getItem('spendwise_lock_pin'), '1357');
  assert.equal(key.establishCalls.length, 0);
});

test('WP28 failed native migration preserves the usable legacy credential and enabled lock', async () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'true');
  storage.setItem('spendwise_lock_pin', '8642');
  const key = new FakeKeyService();
  key.establishResult = { ok: false, kind: 'unavailable', code: 'NO_DEVICE_CREDENTIAL' };
  const { service, state } = makeNativeService(storage, key);

  await service.initialize();
  const result = await service.unlock('8642');

  assert.equal(result.ok, true);
  assert.equal(result.warning, 'migration_pending');
  assert.equal(storage.getItem('spendwise_lock_pin'), '8642');
  assert.equal(storage.getItem('spendwise_app_lock_enabled'), 'true');
  assert.equal(state.getNativeMigration()?.status, 'pending');
});

test('WP28 disabled lock migrates and deletes stale legacy PIN residue only after key verification', async () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'false');
  storage.setItem('spendwise_lock_pin', '2468');
  const { service, key, state } = makeNativeService(storage);

  await service.initialize();

  assert.equal(key.establishCalls[0]?.authenticationRequired, false);
  assert.equal(storage.getItem('spendwise_lock_pin'), null);
  assert.equal(storage.getItem('spendwise_app_lock_enabled'), 'false');
  assert.equal(state.getNativeMigration()?.status, 'complete');
});

test('WP28 disabled migration failure rolls back PIN cleanup', async () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'false');
  storage.setItem('spendwise_lock_pin', '2468');
  const key = new FakeKeyService();
  key.establishResult = { ok: false, kind: 'error', code: 'KEY_SETUP_FAILED' };
  const { service, state } = makeNativeService(storage, key);

  await service.initialize();

  assert.equal(storage.getItem('spendwise_lock_pin'), '2468');
  assert.equal(state.getNativeMigration()?.status, 'pending');
});

test('WP28 malformed or missing enabled legacy PIN enters explicit native repair instead of disabling App Lock', async () => {
  for (const raw of ['oops', null]) {
    const storage = new MemoryStorage();
    storage.setItem('spendwise_app_lock_enabled', 'true');
    if (raw !== null) storage.setItem('spendwise_lock_pin', raw);
    const { service } = makeNativeService(storage);

    await service.initialize();
    assert.equal(service.getSnapshot().unlockMode, 'native-repair');
    const repaired = await service.unlock();
    assert.equal(repaired.ok, true);
    assert.equal(storage.getItem('spendwise_app_lock_enabled'), 'true');
    assert.equal(storage.getItem('spendwise_lock_pin'), null);
  }
});

test('WP28 cancellation, unavailability, key invalidation and generic errors never unlock or disable App Lock', async () => {
  const failures = [
    { kind: 'cancelled', expected: 'cancelled' },
    { kind: 'unavailable', expected: 'unavailable' },
    { kind: 'missing', expected: 'missing_key' },
    { kind: 'invalidated', expected: 'invalidated_key' },
    { kind: 'unrecoverable', expected: 'unrecoverable_key' },
    { kind: 'error', expected: 'error' },
  ] as const;

  for (const failure of failures) {
    const storage = new MemoryStorage();
    storage.setItem('spendwise_app_lock_enabled', 'true');
    const state = new SecurityStateStore(storage);
    state.setNativeMigration('complete');
    const key = new FakeKeyService();
    key.establishResult = { ok: false, kind: failure.kind, code: 'TEST_FAILURE' };
    const { service } = makeNativeService(storage, key);

    await service.initialize();
    const result = await service.unlock();
    assert.equal(result.ok, false);
    assert.equal(result.code, failure.expected);
    assert.equal(service.getSnapshot().state, 'locked');
    assert.equal(storage.getItem('spendwise_app_lock_enabled'), 'true');
  }
});

test('WP28 process restart starts locked whenever App Lock is enabled', async () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'true');
  const state = new SecurityStateStore(storage);
  state.setNativeMigration('complete');

  const first = makeNativeService(storage);
  await first.service.initialize();
  assert.equal((await first.service.unlock()).ok, true);
  assert.equal(first.service.getSnapshot().state, 'unlocked');

  const restarted = makeNativeService(storage);
  assert.equal(restarted.service.getSnapshot().state, 'locked');
});

test('WP28 session service owns background/foreground timeout and clears session state on lock', async () => {
  assert.equal(shouldLockAfterTimeout(10_000, 14_999, 5), false);
  assert.equal(shouldLockAfterTimeout(10_000, 15_000, 5), true);

  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'true');
  storage.setItem('spendwise_lock_timeout_seconds', '60');
  const state = new SecurityStateStore(storage);
  state.setNativeMigration('complete');
  const { service, key } = makeNativeService(storage);

  await service.initialize();
  assert.equal((await service.unlock()).ok, true);
  service.onBackground(10_000);
  assert.equal(service.onForeground(69_999), false);
  assert.equal(service.getSnapshot().state, 'unlocked');

  service.onBackground(10_000);
  assert.equal(service.onForeground(70_000), true);
  assert.equal(service.getSnapshot().state, 'locked');
  assert.ok(key.released > 0);
});

test('WP28 web fallback stores only a versioned Argon2id verifier with unique random salt', async () => {
  const service = new WebPinService();
  const first = await service.createVerifier('1234');
  const second = await service.createVerifier('1234');

  assert.equal(first.algorithm, 'argon2id');
  assert.equal(first.memorySizeKiB, WEB_PIN_KDF.memorySizeKiB);
  assert.equal(first.iterations, WEB_PIN_KDF.iterations);
  assert.notEqual(first.encodedHash, second.encodedHash);
  assert.equal(await service.verify('1234', first), true);
  assert.equal(await service.verify('9999', first), false);
  assert.match(first.encodedHash, /^\$argon2id\$/);
  assert.equal(JSON.stringify(first).includes('1234'), false);
});

test('WP28 web custom PIN throttling remains persistent and bounded', () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 9; index += 1) {
    recordLockFailure(1_000, storage);
  }
  const persisted = readLockThrottleState(storage);
  assert.equal(persisted.failedAttempts, 9);
  assert.ok(remainingLockDelayMs(persisted, 1_000) > 0);
  clearLockThrottle(storage);
  assert.equal(readLockThrottleState(storage).failedAttempts, 0);
});

test('WP28 Privacy Shield follows App Lock and high-sensitivity surfaces', async () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_app_lock_enabled', 'true');
  const state = new SecurityStateStore(storage);
  state.setNativeMigration('complete');
  const { service, adapter } = makeNativeService(storage);

  await service.initialize();
  assert.equal(adapter.shield.at(-1), true);

  const disabledStorage = new MemoryStorage();
  disabledStorage.setItem('spendwise_app_lock_enabled', 'false');
  const disabled = makeNativeService(disabledStorage);
  await disabled.service.initialize();
  disabled.service.enterSensitiveSurface();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(disabled.adapter.shield.at(-1), true);
  disabled.service.leaveSensitiveSurface();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(disabled.adapter.shield.at(-1), false);
});

test('WP28 native source uses strong biometric/device credential, versioned Keystore aliases, AES-GCM and FLAG_SECURE', () => {
  const native = readFileSync(
    'android/app/src/main/java/com/spendwise/app/SpendWiseSecurityPlugin.java',
    'utf8'
  );
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  const gradle = readFileSync('android/app/build.gradle', 'utf8');
  const keyService = readFileSync('src/security/SecureKeyService.ts', 'utf8');

  assert.match(native, /BIOMETRIC_STRONG/);
  assert.match(native, /DEVICE_CREDENTIAL/);
  assert.match(native, /setDeviceCredentialAllowed\(true\)/);
  assert.match(native, /AndroidKeyStore/);
  assert.match(native, /spendwise\.local-kek\.v/);
  assert.match(native, /AES\/GCM\/NoPadding/);
  assert.match(native, /SecureRandom/);
  assert.match(native, /FLAG_SECURE/);
  assert.match(native, /KeyPermanentlyInvalidatedException/);
  assert.match(native, /UnrecoverableKeyException/);
  assert.match(keyService, /current\.keyVersion \+ 1/);
  assert.match(keyService, /replaceKeyring/);
  assert.match(manifest, /android\.permission\.USE_BIOMETRIC/);
  assert.match(gradle, /androidx\.biometric:biometric/);
});

test('WP28 keeps Keystore internals out of UI and does not pull WP29+ work forward', () => {
  const ui = [
    readFileSync('src/app/hooks/useAppLockLifecycle.ts', 'utf8'),
    readFileSync('src/screens/LockScreen.tsx', 'utf8'),
    readFileSync('src/screens/SettingsScreen.tsx', 'utf8'),
    readFileSync('src/screens/SetupWizardScreen.tsx', 'utf8'),
  ].join('\n');
  assert.doesNotMatch(
    ui,
    /AndroidKeyStore|KeyGenParameterSpec|BiometricPrompt|WindowManager\.LayoutParams\.FLAG_SECURE/
  );

  const changedScope = [
    readFileSync('src/security/SecureKeyService.ts', 'utf8'),
    readFileSync('src/security/SecureSessionService.ts', 'utf8'),
    readFileSync('android/app/src/main/java/com/spendwise/app/SpendWiseSecurityPlugin.java', 'utf8'),
  ].join('\n');
  assert.doesNotMatch(
    changedScope,
    /SQLCipher|net\.zetetic|Backup v3|challenge nonce|Play Integrity|certificate pin/i
  );
});

test('WP28 legacy migration contract no longer silently disables App Lock and CI runs WP28 after WP27', () => {
  const storage = readFileSync('src/utils/storage.ts', 'utf8');
  const workflow = readFileSync('.github/workflows/android-build.yml', 'utf8');
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    version: string;
    scripts: Record<string, string>;
  };
  const versionJson = JSON.parse(readFileSync('version.json', 'utf8')) as {
    versionName: string;
    versionCode: number;
  };

  assert.doesNotMatch(
    storage,
    /APP_LOCK\) === 'true'[\s\S]{0,180}setItem\(STORAGE_KEYS\.APP_LOCK, 'false'\)/
  );
  assert.ok(workflow.indexOf('npm run test:wp27') < workflow.indexOf('npm run test:wp28'));
  assert.equal(packageJson.scripts['test:wp28'], 'tsx --test tests/wp28-secure-auth-keystore.test.ts');
  assert.equal(packageJson.version, '2.0.0');
  assert.equal(versionJson.versionName, '2.0.0');
  assert.equal(versionJson.versionCode, 6);
});

test('WP28 security state contains no plaintext PIN field or secret key material', () => {
  const source = readFileSync('src/security/SecurityStateStore.ts', 'utf8');
  assert.doesNotMatch(source, /pin:\s*string|rawPin|privateKey|databaseKey|mediaKey/i);
  assert.match(source, /WEB_PIN_VERIFIER/);
  assert.match(source, /wrappedSecrets/);
  assert.equal(SECURITY_STATE_KEYS.WEB_PIN_VERIFIER, 'spendwise_web_pin_verifier_v1');
});
