import {
  AndroidSecurityAdapter,
  NativeAuthenticationResult,
  NativeKeyStatus,
  NativeWrappedSecret,
  androidSecurityAdapter,
} from '../platform/android/AndroidSecurityAdapter';
import {
  ActiveKeyMetadata,
  SecurityStateStore,
  securityStateStore,
} from './SecurityStateStore';
import { diagnostics } from '../services/diagnostics/diagnostics';

export type SecureKeyFailureKind =
  | 'cancelled'
  | 'unavailable'
  | 'missing'
  | 'invalidated'
  | 'unrecoverable'
  | 'not_authenticated'
  | 'error';

export type SecureKeyResult<T = undefined> =
  | { ok: true; value: T; authSucceededAtElapsedRealtimeMs?: number }
  | { ok: false; kind: SecureKeyFailureKind; code?: string; message?: string };

export interface SecureKeyService {
  getActiveKey(): ActiveKeyMetadata | null;
  hasProtectedSecrets(): boolean;
  hasWrappedSecret(purpose: string): boolean;
  establish(authenticationRequired: boolean, reason: string): Promise<SecureKeyResult<ActiveKeyMetadata>>;
  verifyActiveKey(reason: string): Promise<SecureKeyResult<ActiveKeyMetadata>>;
  rotateAuthenticationPolicy(
    authenticationRequired: boolean,
    reason: string
  ): Promise<SecureKeyResult<ActiveKeyMetadata>>;
  ensureWrappedSecret(
    purpose: string,
    byteLength?: number
  ): Promise<SecureKeyResult<NativeWrappedSecret>>;
  withUnwrappedSecret<T>(
    purpose: string,
    consumer: (secret: Uint8Array) => Promise<T> | T
  ): Promise<SecureKeyResult<T>>;
  releaseSessionSecrets(): void;
}

function keyFailure(
  status: NativeKeyStatus | undefined,
  result?: NativeAuthenticationResult
): SecureKeyResult<never> {
  if (result?.status === 'cancelled') {
    return { ok: false, kind: 'cancelled', code: result.code, message: result.message };
  }
  if (result?.status === 'unavailable') {
    return { ok: false, kind: 'unavailable', code: result.code, message: result.message };
  }
  if (status === 'missing') return { ok: false, kind: 'missing', code: result?.code };
  if (status === 'invalidated') return { ok: false, kind: 'invalidated', code: result?.code };
  if (status === 'unrecoverable') return { ok: false, kind: 'unrecoverable', code: result?.code };
  if (status === 'unavailable') return { ok: false, kind: 'unavailable', code: result?.code };
  if (result?.code === 'USER_NOT_AUTHENTICATED') {
    return { ok: false, kind: 'not_authenticated', code: result.code };
  }
  return { ok: false, kind: 'error', code: result?.code, message: result?.message };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function recordPostAuthKeyTiming(result: NativeAuthenticationResult): void {
  const duration = result.postAuthKeyVerifyDurationMs;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return;
  diagnostics.record({ operation: 'security.post_auth_key', outcome: 'success', durationMs: duration });
}

function authenticationTiming(result: NativeAuthenticationResult): {
  authSucceededAtElapsedRealtimeMs?: number;
} {
  const timestamp = result.authSucceededAtElapsedRealtimeMs;
  return typeof timestamp === 'number' && Number.isSafeInteger(timestamp) && timestamp >= 0
    ? { authSucceededAtElapsedRealtimeMs: timestamp }
    : {};
}

export class AndroidSecureKeyService implements SecureKeyService {
  private readonly sessionSecrets = new Map<string, Uint8Array>();
  private lastVerifiedAt = 0;

  constructor(
    private readonly adapter: AndroidSecurityAdapter = androidSecurityAdapter,
    private readonly stateStore: SecurityStateStore = securityStateStore
  ) {}

  getActiveKey(): ActiveKeyMetadata | null {
    return this.stateStore.getActiveKey();
  }

  hasProtectedSecrets(): boolean {
    return this.stateStore.hasWrappedSecrets();
  }

  hasWrappedSecret(purpose: string): boolean {
    return Object.prototype.hasOwnProperty.call(
      this.stateStore.getWrappedSecrets(),
      purpose
    );
  }

  private async createAndVerify(
    keyVersion: number,
    authenticationRequired: boolean,
    reason: string
  ): Promise<SecureKeyResult<ActiveKeyMetadata>> {
    try {
      const ensured = await this.adapter.ensureKey(keyVersion, authenticationRequired);
      if (ensured.status !== 'present') return keyFailure(ensured.status);

      const verified = await this.adapter.verifyKey(
        keyVersion,
        authenticationRequired,
        'Unlock SpendWise',
        reason
      );
      recordPostAuthKeyTiming(verified);
      if (verified.status !== 'success') {
        await this.adapter.deleteKey(keyVersion).catch(() => ({ deleted: false }));
        return keyFailure(verified.keyStatus, verified);
      }

      this.lastVerifiedAt = Date.now();
      return {
        ok: true,
        value: { version: 1, keyVersion, authenticationRequired },
        ...authenticationTiming(verified),
      };
    } catch {
      await this.adapter.deleteKey(keyVersion).catch(() => ({ deleted: false }));
      return { ok: false, kind: 'error', code: 'KEY_SETUP_FAILED' };
    }
  }

  async establish(
    authenticationRequired: boolean,
    reason: string
  ): Promise<SecureKeyResult<ActiveKeyMetadata>> {
    if (!this.adapter.isAvailable()) {
      return { ok: false, kind: 'unavailable', code: 'NATIVE_SECURITY_UNAVAILABLE' };
    }

    const current = this.stateStore.getActiveKey();
    if (!current) {
      if (this.stateStore.hasWrappedSecrets()) {
        return { ok: false, kind: 'unrecoverable', code: 'ACTIVE_KEY_METADATA_MISSING' };
      }
      const created = await this.createAndVerify(1, authenticationRequired, reason);
      if (created.ok) this.stateStore.setActiveKey(created.value);
      return created;
    }

    if (current.authenticationRequired !== authenticationRequired) {
      return this.rotateAuthenticationPolicy(authenticationRequired, reason);
    }

    let status;
    try {
      status = await this.adapter.getKeyStatus(
        current.keyVersion,
        current.authenticationRequired
      );
    } catch {
      return { ok: false, kind: 'error', code: 'KEY_STATUS_FAILED' };
    }

    if (status.status === 'present') return this.verifyActiveKey(reason);

    if (this.stateStore.hasWrappedSecrets()) {
      return keyFailure(status.status);
    }

    const nextVersion = current.keyVersion + 1;
    const recreated = await this.createAndVerify(nextVersion, authenticationRequired, reason);
    if (!recreated.ok) return recreated;
    this.stateStore.setActiveKey(recreated.value);
    await this.adapter.deleteKey(current.keyVersion).catch(() => ({ deleted: false }));
    return recreated;
  }

  private async primeSessionSecrets(
    current: ActiveKeyMetadata
  ): Promise<SecureKeyResult<void>> {
    const wrappedSecrets = this.stateStore.getWrappedSecrets();
    for (const [purpose, wrapped] of Object.entries(wrappedSecrets)) {
      if (this.sessionSecrets.has(purpose)) continue;
      const result = await this.adapter.unwrapSecret({
        wrapped,
        authenticationRequired: current.authenticationRequired,
        title: 'Unlock SpendWise',
        reason: 'Open protected local data',
        authenticate: false,
      });
      if (result.status !== 'success' || !result.secretBase64) {
        return keyFailure(result.keyStatus, result);
      }
      const secret = decodeBase64(result.secretBase64);
      result.secretBase64 = undefined;
      this.sessionSecrets.set(purpose, secret);
    }
    return { ok: true, value: undefined };
  }

  async verifyActiveKey(reason: string): Promise<SecureKeyResult<ActiveKeyMetadata>> {
    const current = this.stateStore.getActiveKey();
    if (!current) return { ok: false, kind: 'missing', code: 'ACTIVE_KEY_MISSING' };

    try {
      const status = await this.adapter.getKeyStatus(
        current.keyVersion,
        current.authenticationRequired
      );
      if (status.status !== 'present') return keyFailure(status.status);

      const verified = await this.adapter.verifyKey(
        current.keyVersion,
        current.authenticationRequired,
        'Unlock SpendWise',
        reason
      );
      recordPostAuthKeyTiming(verified);
      if (verified.status !== 'success') return keyFailure(verified.keyStatus, verified);
      this.lastVerifiedAt = Date.now();
      const primeStartedAt = performance.now();
      const primed = await this.primeSessionSecrets(current);
      diagnostics.record(
        primed.ok
          ? {
              operation: 'security.secret_prime',
              outcome: 'success',
              durationMs: performance.now() - primeStartedAt,
            }
          : {
              operation: 'security.secret_prime',
              outcome: 'failure',
              code: 'SECURITY_SECRET_PRIME_FAILED',
              durationMs: performance.now() - primeStartedAt,
            }
      );
      if (!primed.ok) return primed;
      return { ok: true, value: current, ...authenticationTiming(verified) };
    } catch {
      return { ok: false, kind: 'error', code: 'KEY_VERIFY_FAILED' };
    }
  }

  async rotateAuthenticationPolicy(
    authenticationRequired: boolean,
    reason: string
  ): Promise<SecureKeyResult<ActiveKeyMetadata>> {
    this.releaseSessionSecrets();
    const current = this.stateStore.getActiveKey();
    if (!current) return this.establish(authenticationRequired, reason);
    if (current.authenticationRequired === authenticationRequired) {
      return this.verifyActiveKey(reason);
    }

    const oldSecrets = this.stateStore.getWrappedSecrets();
    if (Object.keys(oldSecrets).length > 0) {
      const oldVerified = await this.verifyActiveKey('Authorize secure key rotation');
      if (!oldVerified.ok) return oldVerified;
    }

    const nextVersion = current.keyVersion + 1;
    const next = await this.createAndVerify(nextVersion, authenticationRequired, reason);
    if (!next.ok) return next;

    const staged: Record<string, NativeWrappedSecret> = {};
    try {
      for (const [purpose, wrapped] of Object.entries(oldSecrets)) {
        const unwrapped = await this.adapter.unwrapSecret({
          wrapped,
          authenticationRequired: current.authenticationRequired,
          title: 'Authorize SpendWise security update',
          reason: 'Rotate protected key material',
          authenticate: false,
        });
        if (unwrapped.status !== 'success' || !unwrapped.secretBase64) {
          await this.adapter.deleteKey(nextVersion).catch(() => ({ deleted: false }));
          return keyFailure(unwrapped.keyStatus, unwrapped);
        }

        try {
          const rewrapped = await this.adapter.wrapSecret({
            keyVersion: nextVersion,
            authenticationRequired,
            purpose,
            secretBase64: unwrapped.secretBase64,
            title: 'Authorize SpendWise security update',
            reason: 'Rotate protected key material',
            authenticate: false,
          });
          if (rewrapped.status !== 'success' || !rewrapped.wrapped) {
            await this.adapter.deleteKey(nextVersion).catch(() => ({ deleted: false }));
            return keyFailure(rewrapped.keyStatus, rewrapped);
          }
          staged[purpose] = rewrapped.wrapped;
        } finally {
          // The native bridge does not persist the unwrapped base64 value. Dropping the
          // reference here keeps its lifetime bounded until the bridge call returns.
          unwrapped.secretBase64 = undefined;
        }
      }

      this.stateStore.replaceKeyring(next.value, staged);
      await this.adapter.deleteKey(current.keyVersion).catch(() => ({ deleted: false }));
      return next;
    } catch {
      await this.adapter.deleteKey(nextVersion).catch(() => ({ deleted: false }));
      return { ok: false, kind: 'error', code: 'KEY_ROTATION_FAILED' };
    }
  }

  async ensureWrappedSecret(
    purpose: string,
    byteLength = 32
  ): Promise<SecureKeyResult<NativeWrappedSecret>> {
    const existing = this.stateStore.getWrappedSecrets()[purpose];
    if (existing) return { ok: true, value: existing };

    const current = this.stateStore.getActiveKey();
    if (!current) return { ok: false, kind: 'missing', code: 'ACTIVE_KEY_MISSING' };
    if (!/^[a-z0-9._-]{1,80}$/i.test(purpose)) {
      return { ok: false, kind: 'error', code: 'INVALID_SECRET_PURPOSE' };
    }
    if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 64) {
      return { ok: false, kind: 'error', code: 'INVALID_SECRET_LENGTH' };
    }

    try {
      const canReuseFreshAuthentication =
        !current.authenticationRequired ||
        (this.lastVerifiedAt > 0 && Date.now() - this.lastVerifiedAt <= 4_000);
      const result = await this.adapter.generateWrappedSecret({
        keyVersion: current.keyVersion,
        authenticationRequired: current.authenticationRequired,
        purpose,
        byteLength,
        title: 'Unlock SpendWise',
        reason: 'Protect local SpendWise data',
        authenticate: !canReuseFreshAuthentication,
      });
      if (result.status !== 'success' || !result.wrapped) {
        return keyFailure(result.keyStatus, result);
      }
      this.stateStore.setWrappedSecret(purpose, result.wrapped);

      // The generating authentication also authorizes the Keystore key briefly.
      // Prime the in-memory session copy without showing a second prompt.
      const primed = await this.adapter.unwrapSecret({
        wrapped: result.wrapped,
        authenticationRequired: current.authenticationRequired,
        title: 'Unlock SpendWise',
        reason: 'Open protected local data',
        authenticate: false,
      });
      if (primed.status === 'success' && primed.secretBase64) {
        const secret = decodeBase64(primed.secretBase64);
        primed.secretBase64 = undefined;
        this.sessionSecrets.set(purpose, secret);
      }
      return { ok: true, value: result.wrapped };
    } catch {
      return { ok: false, kind: 'error', code: 'SECRET_GENERATION_FAILED' };
    }
  }

  async withUnwrappedSecret<T>(
    purpose: string,
    consumer: (secret: Uint8Array) => Promise<T> | T
  ): Promise<SecureKeyResult<T>> {
    const current = this.stateStore.getActiveKey();
    const wrapped = this.stateStore.getWrappedSecrets()[purpose];
    if (!current || !wrapped) {
      return { ok: false, kind: 'missing', code: 'PROTECTED_SECRET_MISSING' };
    }

    const useSessionCopy = async (source: Uint8Array): Promise<SecureKeyResult<T>> => {
      const copy = source.slice();
      try {
        return { ok: true, value: await consumer(copy) };
      } finally {
        copy.fill(0);
      }
    };

    const cached = this.sessionSecrets.get(purpose);
    if (cached) return useSessionCopy(cached);

    try {
      const result = await this.adapter.unwrapSecret({
        wrapped,
        authenticationRequired: current.authenticationRequired,
        title: 'Unlock SpendWise',
        reason: 'Open protected local data',
        authenticate: false,
      });
      if (result.status !== 'success' || !result.secretBase64) {
        return keyFailure(result.keyStatus, result);
      }

      const secret = decodeBase64(result.secretBase64);
      result.secretBase64 = undefined;
      this.sessionSecrets.set(purpose, secret);
      return useSessionCopy(secret);
    } catch {
      return { ok: false, kind: 'error', code: 'SECRET_UNWRAP_FAILED' };
    }
  }

  releaseSessionSecrets(): void {
    for (const secret of this.sessionSecrets.values()) secret.fill(0);
    this.sessionSecrets.clear();
    this.lastVerifiedAt = 0;
  }
}

export const secureKeyService: SecureKeyService = new AndroidSecureKeyService();
