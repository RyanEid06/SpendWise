import {
  androidSecurityAdapter,
  AndroidSecurityAdapter,
} from '../platform/android/AndroidSecurityAdapter';
import { preferencesRepository } from '../data/PreferencesRepository';
import {
  legacyAppLockService,
  LegacyAppLockService,
  LegacyPinState,
} from '../features/security/LegacyAppLockService';
import {
  SecureKeyFailureKind,
  SecureKeyResult,
  SecureKeyService,
  secureKeyService,
} from './SecureKeyService';
import {
  SecurityStateStore,
  securityStateStore,
} from './SecurityStateStore';
import {
  WebPinService,
  webPinService,
} from './WebPinService';

export type SecureSessionState = 'locked' | 'unlocked';
export type SecureSecurityMode = 'native' | 'web';
export type SecureUnlockMode =
  | 'native'
  | 'legacy-native-migration'
  | 'native-repair'
  | 'web'
  | 'legacy-web-migration'
  | 'web-repair';

export type SensitiveAuthenticationReason =
  | 'disable-app-lock'
  | 'security-configuration'
  | 'replace-restore'
  | 'clear-app-data'
  | 'plaintext-export';

export type SecureSessionActionCode =
  | 'success'
  | 'invalid_credential'
  | 'credential_required'
  | 'cancelled'
  | 'unavailable'
  | 'missing_key'
  | 'invalidated_key'
  | 'unrecoverable_key'
  | 'migration_pending'
  | 'repair_required'
  | 'error';

export interface SecureSessionActionResult {
  ok: boolean;
  code: SecureSessionActionCode;
  warning?: 'migration_pending';
  detailCode?: string;
  authSucceededAtElapsedRealtimeMs?: number;
}

export interface SecureSessionSnapshot {
  state: SecureSessionState;
  appLockEnabled: boolean;
  lockTimeoutSeconds: number;
  securityMode: SecureSecurityMode;
  unlockMode: SecureUnlockMode;
  hasWebPin: boolean;
  migrationIssue: string | null;
}

export function shouldLockAfterTimeout(
  backgroundedAt: number,
  resumedAt: number,
  timeoutSeconds: number
): boolean {
  if (backgroundedAt <= 0) return false;
  return (resumedAt - backgroundedAt) / 1000 >= timeoutSeconds;
}

function actionFromKeyFailure(result: SecureKeyResult<unknown>): SecureSessionActionResult {
  if (result.ok) return { ok: true, code: 'success' };
  const mapping: Record<SecureKeyFailureKind, SecureSessionActionCode> = {
    cancelled: 'cancelled',
    unavailable: 'unavailable',
    missing: 'missing_key',
    invalidated: 'invalidated_key',
    unrecoverable: 'unrecoverable_key',
    not_authenticated: 'credential_required',
    error: 'error',
  };
  return {
    ok: false,
    code: mapping[result.kind],
    detailCode: result.code,
  };
}

function successfulKeyAction(
  result: Extract<SecureKeyResult<unknown>, { ok: true }>
): SecureSessionActionResult {
  return {
    ok: true,
    code: 'success',
    ...(result.authSucceededAtElapsedRealtimeMs === undefined ? {} : {
      authSucceededAtElapsedRealtimeMs: result.authSucceededAtElapsedRealtimeMs,
    }),
  };
}

function safeAppLockEnabled(): boolean {
  try {
    return preferencesRepository.isAppLockEnabled();
  } catch {
    return false;
  }
}

function safeTimeout(): number {
  try {
    return preferencesRepository.getLockTimeoutSeconds();
  } catch {
    return 300;
  }
}

export class DefaultSecureSessionService {
  private state: SecureSessionState = 'unlocked';
  private backgroundedAt = 0;
  private lastAuthenticatedAt = 0;
  private sensitiveSurfaceDepth = 0;
  private authenticating = false;
  private privacyShieldDesired: boolean | null = null;
  private initialized = false;

  constructor(
    private readonly keyService: SecureKeyService = secureKeyService,
    private readonly nativeAdapter: AndroidSecurityAdapter = androidSecurityAdapter,
    private readonly stateStore: SecurityStateStore = securityStateStore,
    private readonly legacyLock: LegacyAppLockService = legacyAppLockService,
    private readonly webPin: WebPinService = webPinService
  ) {}

  private securityMode(): SecureSecurityMode {
    return this.nativeAdapter.isAvailable() ? 'native' : 'web';
  }

  private legacyState(): LegacyPinState {
    try {
      return this.legacyLock.getPinState();
    } catch {
      return { kind: 'none' };
    }
  }

  private unlockMode(): SecureUnlockMode {
    if (this.securityMode() === 'native') {
      if (this.stateStore.getNativeMigration()?.status === 'complete') return 'native';
      return this.legacyState().kind === 'valid'
        ? 'legacy-native-migration'
        : 'native-repair';
    }

    if (this.stateStore.getWebPinVerifier()) return 'web';
    return this.legacyState().kind === 'valid'
      ? 'legacy-web-migration'
      : 'web-repair';
  }

  getSnapshot(): SecureSessionSnapshot {
    const appLockEnabled = safeAppLockEnabled();
    if (!this.initialized) {
      this.state = appLockEnabled ? 'locked' : 'unlocked';
    }
    const migration = this.stateStore.getNativeMigration();
    return {
      state: this.state,
      appLockEnabled,
      lockTimeoutSeconds: safeTimeout(),
      securityMode: this.securityMode(),
      unlockMode: this.unlockMode(),
      hasWebPin: this.stateStore.getWebPinVerifier() !== null,
      migrationIssue:
        migration && migration.status !== 'complete' && migration.lastErrorCode
          ? migration.lastErrorCode
          : null,
    };
  }

  async initialize(): Promise<SecureSessionSnapshot> {
    if (this.initialized) {
      await this.reconcilePrivacyShield();
      return this.getSnapshot();
    }

    this.initialized = true;
    this.state = safeAppLockEnabled() ? 'locked' : 'unlocked';

    if (this.securityMode() === 'native') {
      if (!safeAppLockEnabled()) await this.migrateDisabledNativeState();
    } else {
      await this.migrateWebCredential();
    }

    await this.reconcilePrivacyShield();
    return this.getSnapshot();
  }

  private async migrateDisabledNativeState(): Promise<void> {
    const migration = this.stateStore.getNativeMigration();
    const legacy = this.legacyState();
    if (migration?.status === 'complete' && legacy.kind === 'none') return;

    const result = await this.keyService.establish(
      false,
      'Initialize SpendWise secure key storage'
    );
    if (!result.ok) {
      this.stateStore.setNativeMigration('pending', result.code ?? result.kind);
      return;
    }

    this.stateStore.setNativeMigration('complete');
    this.legacyLock.clearPin();
  }

  private async migrateWebCredential(): Promise<void> {
    const existing = this.stateStore.getWebPinVerifier();
    const legacy = this.legacyState();

    if (existing) {
      if (legacy.kind !== 'none') this.legacyLock.clearPin();
      return;
    }

    if (legacy.kind === 'valid') {
      try {
        const verifier = await this.webPin.createVerifier(legacy.pin);
        this.stateStore.setWebPinVerifier(verifier);
        this.legacyLock.clearPin();
      } catch {
        // Keep the only usable legacy credential intact and retry later.
      }
      return;
    }

    if (legacy.kind === 'malformed' && !safeAppLockEnabled()) {
      this.legacyLock.clearPin();
    }
  }

  private async runNativeKeyOperation<T>(
    operation: () => Promise<SecureKeyResult<T>>
  ): Promise<SecureKeyResult<T>> {
    this.authenticating = true;
    await this.reconcilePrivacyShield();
    try {
      return await operation();
    } finally {
      this.authenticating = false;
      await this.reconcilePrivacyShield();
    }
  }

  async unlock(credential?: string): Promise<SecureSessionActionResult> {
    if (!safeAppLockEnabled()) {
      this.state = 'unlocked';
      return { ok: true, code: 'success' };
    }

    if (this.securityMode() === 'native') {
      const migration = this.stateStore.getNativeMigration();
      const legacy = this.legacyState();

      if (migration?.status === 'complete') {
        const result = await this.runNativeKeyOperation(() =>
          this.keyService.establish(true, 'Unlock SpendWise')
        );
        if (!result.ok) return actionFromKeyFailure(result);

        if (legacy.kind !== 'none') this.legacyLock.clearPin();
        this.state = 'unlocked';
        this.lastAuthenticatedAt = Date.now();
        return successfulKeyAction(result);
      }

      if (legacy.kind === 'valid') {
        if (credential !== legacy.pin) {
          return { ok: false, code: 'invalid_credential' };
        }

        const migrationResult = await this.runNativeKeyOperation(() =>
          this.keyService.establish(true, 'Upgrade SpendWise App Lock')
        );
        if (migrationResult.ok) {
          this.stateStore.setNativeMigration('complete');
          this.legacyLock.clearPin();
          this.state = 'unlocked';
          this.lastAuthenticatedAt = Date.now();
          return successfulKeyAction(migrationResult);
        }

        // The legacy PIN was valid. Preserve it and preserve access to this
        // session rather than locking a v1.4 user out because the secure
        // migration was cancelled or unavailable.
        this.stateStore.setNativeMigration(
          'pending',
          migrationResult.code ?? migrationResult.kind
        );
        this.state = 'unlocked';
        this.lastAuthenticatedAt = Date.now();
        return {
          ok: true,
          code: 'migration_pending',
          warning: 'migration_pending',
          detailCode: migrationResult.code,
        };
      }

      this.stateStore.setNativeMigration('repair_required');
      const repairResult = await this.runNativeKeyOperation(() =>
        this.keyService.establish(true, 'Repair SpendWise App Lock')
      );
      if (!repairResult.ok) {
        this.stateStore.setNativeMigration(
          'repair_required',
          repairResult.code ?? repairResult.kind
        );
        return actionFromKeyFailure(repairResult);
      }

      this.stateStore.setNativeMigration('complete');
      this.legacyLock.clearPin();
      this.state = 'unlocked';
      this.lastAuthenticatedAt = Date.now();
      return successfulKeyAction(repairResult);
    }

    const verifier = this.stateStore.getWebPinVerifier();
    const legacy = this.legacyState();
    if (verifier) {
      if (!credential || !(await this.webPin.verify(credential, verifier))) {
        return { ok: false, code: 'invalid_credential' };
      }
      this.state = 'unlocked';
      this.lastAuthenticatedAt = Date.now();
      return { ok: true, code: 'success' };
    }

    if (legacy.kind === 'valid') {
      if (credential !== legacy.pin) {
        return { ok: false, code: 'invalid_credential' };
      }
      try {
        const nextVerifier = await this.webPin.createVerifier(legacy.pin);
        this.stateStore.setWebPinVerifier(nextVerifier);
        this.legacyLock.clearPin();
      } catch {
        // A KDF/storage failure must not destroy the old working credential.
      }
      this.state = 'unlocked';
      this.lastAuthenticatedAt = Date.now();
      return { ok: true, code: 'success' };
    }

    return { ok: false, code: 'repair_required' };
  }

  lock(): void {
    if (!safeAppLockEnabled()) return;
    this.state = 'locked';
    this.lastAuthenticatedAt = 0;
    this.backgroundedAt = 0;
    this.keyService.releaseSessionSecrets();
  }

  onBackground(now = Date.now()): void {
    this.backgroundedAt = now;
  }

  onForeground(now = Date.now()): boolean {
    if (
      safeAppLockEnabled() &&
      shouldLockAfterTimeout(this.backgroundedAt, now, safeTimeout())
    ) {
      this.lock();
      return true;
    }
    this.backgroundedAt = 0;
    return false;
  }

  async configureFromSetup(pin?: string): Promise<SecureSessionActionResult> {
    if (this.securityMode() === 'native') {
      return this.setAppLockEnabled(true);
    }

    if (!pin) return { ok: false, code: 'credential_required' };
    const saved = await this.setWebPin(pin, false);
    if (!saved.ok) return saved;
    preferencesRepository.setAppLockEnabled(true);
    this.state = 'unlocked';
    this.lastAuthenticatedAt = Date.now();
    return { ok: true, code: 'success' };
  }

  async setWebPin(
    pin: string,
    requireExistingAuthentication = true
  ): Promise<SecureSessionActionResult> {
    if (this.securityMode() !== 'web') {
      return { ok: false, code: 'error', detailCode: 'WEB_PIN_NATIVE_FORBIDDEN' };
    }

    if (requireExistingAuthentication && safeAppLockEnabled()) {
      const fresh = await this.requireFreshAuthentication('security-configuration');
      if (!fresh.ok) return fresh;
    }

    try {
      const verifier = await this.webPin.createVerifier(pin);
      this.stateStore.setWebPinVerifier(verifier);
      this.legacyLock.clearPin();
      return { ok: true, code: 'success' };
    } catch {
      return { ok: false, code: 'error', detailCode: 'WEB_PIN_KDF_FAILED' };
    }
  }

  async setAppLockEnabled(enabled: boolean): Promise<SecureSessionActionResult> {
    const currentlyEnabled = safeAppLockEnabled();
    if (enabled === currentlyEnabled) return { ok: true, code: 'success' };

    if (this.securityMode() === 'native') {
      if (enabled) {
        const result = await this.runNativeKeyOperation(() =>
          this.keyService.establish(true, 'Enable SpendWise App Lock')
        );
        if (!result.ok) return actionFromKeyFailure(result);

        this.stateStore.setNativeMigration('complete');
        this.legacyLock.clearPin();
        preferencesRepository.setAppLockEnabled(true);
        this.state = 'unlocked';
        this.lastAuthenticatedAt = Date.now();
        await this.reconcilePrivacyShield();
        return { ok: true, code: 'success' };
      }

      const fresh = await this.requireFreshAuthentication('disable-app-lock');
      if (!fresh.ok) return fresh;
      const rotated = await this.runNativeKeyOperation(() =>
        this.keyService.rotateAuthenticationPolicy(
          false,
          'Disable SpendWise App Lock'
        )
      );
      if (!rotated.ok) return actionFromKeyFailure(rotated);

      preferencesRepository.setAppLockEnabled(false);
      this.state = 'unlocked';
      this.lastAuthenticatedAt = 0;
      await this.reconcilePrivacyShield();
      return { ok: true, code: 'success' };
    }

    if (enabled) {
      if (!this.stateStore.getWebPinVerifier()) {
        return { ok: false, code: 'credential_required' };
      }
      preferencesRepository.setAppLockEnabled(true);
      this.state = 'unlocked';
      this.lastAuthenticatedAt = Date.now();
      return { ok: true, code: 'success' };
    }

    const fresh = await this.requireFreshAuthentication('disable-app-lock');
    if (!fresh.ok) return fresh;
    preferencesRepository.setAppLockEnabled(false);
    this.state = 'unlocked';
    this.lastAuthenticatedAt = 0;
    return { ok: true, code: 'success' };
  }

  async setLockTimeoutSeconds(seconds: number): Promise<SecureSessionActionResult> {
    if (![0, 60, 300, 900].includes(seconds)) {
      return { ok: false, code: 'error', detailCode: 'INVALID_LOCK_TIMEOUT' };
    }

    if (safeAppLockEnabled()) {
      const fresh = await this.requireFreshAuthentication('security-configuration');
      if (!fresh.ok) return fresh;
    }
    preferencesRepository.setLockTimeoutSeconds(seconds);
    return { ok: true, code: 'success' };
  }

  async requireFreshAuthentication(
    reason: SensitiveAuthenticationReason,
    credential?: string
  ): Promise<SecureSessionActionResult> {
    if (!safeAppLockEnabled()) return { ok: true, code: 'success' };

    if (this.securityMode() === 'native') {
      const result = await this.runNativeKeyOperation(() =>
        this.keyService.establish(true, reason)
      );
      if (!result.ok) return actionFromKeyFailure(result);
      this.lastAuthenticatedAt = Date.now();
      return { ok: true, code: 'success' };
    }

    if (credential) {
      const verifier = this.stateStore.getWebPinVerifier();
      if (!verifier || !(await this.webPin.verify(credential, verifier))) {
        return { ok: false, code: 'invalid_credential' };
      }
      this.lastAuthenticatedAt = Date.now();
      return { ok: true, code: 'success' };
    }

    const freshnessMs = Date.now() - this.lastAuthenticatedAt;
    if (this.lastAuthenticatedAt > 0 && freshnessMs <= 60_000) {
      return { ok: true, code: 'success' };
    }
    return { ok: false, code: 'credential_required' };
  }

  enterSensitiveSurface(): void {
    this.sensitiveSurfaceDepth += 1;
    void this.reconcilePrivacyShield();
  }

  leaveSensitiveSurface(): void {
    this.sensitiveSurfaceDepth = Math.max(0, this.sensitiveSurfaceDepth - 1);
    void this.reconcilePrivacyShield();
  }

  private async reconcilePrivacyShield(): Promise<void> {
    if (!this.nativeAdapter.isAvailable()) return;
    const desired =
      safeAppLockEnabled() || this.sensitiveSurfaceDepth > 0 || this.authenticating;
    if (this.privacyShieldDesired === desired) return;
    this.privacyShieldDesired = desired;
    try {
      await this.nativeAdapter.setPrivacyShield(desired);
    } catch {
      this.privacyShieldDesired = null;
    }
  }
}

export interface SecureSessionService {
  getSnapshot(): SecureSessionSnapshot;
  initialize(): Promise<SecureSessionSnapshot>;
  unlock(credential?: string): Promise<SecureSessionActionResult>;
  lock(): void;
  onBackground(now?: number): void;
  onForeground(now?: number): boolean;
  configureFromSetup(pin?: string): Promise<SecureSessionActionResult>;
  setWebPin(pin: string): Promise<SecureSessionActionResult>;
  setAppLockEnabled(enabled: boolean): Promise<SecureSessionActionResult>;
  setLockTimeoutSeconds(seconds: number): Promise<SecureSessionActionResult>;
  requireFreshAuthentication(
    reason: SensitiveAuthenticationReason,
    credential?: string
  ): Promise<SecureSessionActionResult>;
  enterSensitiveSurface(): void;
  leaveSensitiveSurface(): void;
}

export const secureSessionService: SecureSessionService =
  new DefaultSecureSessionService();
