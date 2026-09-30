import type { NativeWrappedSecret } from '../platform/android/AndroidSecurityAdapter';

export interface SecurityStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type NativeMigrationStatus = 'pending' | 'complete' | 'repair_required';

export interface NativeMigrationRecord {
  version: 1;
  status: NativeMigrationStatus;
  updatedAt: number;
  lastErrorCode?: string;
}

export interface ActiveKeyMetadata {
  version: 1;
  keyVersion: number;
  authenticationRequired: boolean;
}

export interface SecureKeyringRecord {
  version: 1;
  activeKey: ActiveKeyMetadata | null;
  wrappedSecrets: Record<string, NativeWrappedSecret>;
}

export interface WebPinVerifierRecord {
  version: 1;
  algorithm: 'argon2id';
  encodedHash: string;
  memorySizeKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
  createdAt: number;
}

export const SECURITY_STATE_KEYS = {
  NATIVE_MIGRATION: 'spendwise_native_security_migration_v1',
  KEYRING: 'spendwise_secure_keyring_v1',
  WEB_PIN_VERIFIER: 'spendwise_web_pin_verifier_v1',
} as const;

function browserStorage(): SecurityStateStorage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function readJson<T>(storage: SecurityStateStorage | null, key: string): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: SecurityStateStorage | null, key: string, value: unknown): void {
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
}

function emptyKeyring(): SecureKeyringRecord {
  return { version: 1, activeKey: null, wrappedSecrets: {} };
}

export class SecurityStateStore {
  constructor(private readonly storage: SecurityStateStorage | null = browserStorage()) {}

  getNativeMigration(): NativeMigrationRecord | null {
    const record = readJson<NativeMigrationRecord>(this.storage, SECURITY_STATE_KEYS.NATIVE_MIGRATION);
    if (!record || record.version !== 1) return null;
    if (!['pending', 'complete', 'repair_required'].includes(record.status)) return null;
    return record;
  }

  setNativeMigration(status: NativeMigrationStatus, lastErrorCode?: string): void {
    const record: NativeMigrationRecord = {
      version: 1,
      status,
      updatedAt: Date.now(),
      ...(lastErrorCode ? { lastErrorCode } : {}),
    };
    writeJson(this.storage, SECURITY_STATE_KEYS.NATIVE_MIGRATION, record);
  }

  getKeyring(): SecureKeyringRecord {
    const record = readJson<SecureKeyringRecord>(this.storage, SECURITY_STATE_KEYS.KEYRING);
    if (!record || record.version !== 1 || !record.wrappedSecrets) return emptyKeyring();
    return {
      version: 1,
      activeKey: record.activeKey ?? null,
      wrappedSecrets:
        typeof record.wrappedSecrets === 'object' && !Array.isArray(record.wrappedSecrets)
          ? record.wrappedSecrets
          : {},
    };
  }

  replaceKeyring(
    activeKey: ActiveKeyMetadata | null,
    wrappedSecrets: Record<string, NativeWrappedSecret>
  ): void {
    writeJson(this.storage, SECURITY_STATE_KEYS.KEYRING, {
      version: 1,
      activeKey,
      wrappedSecrets,
    } satisfies SecureKeyringRecord);
  }

  getActiveKey(): ActiveKeyMetadata | null {
    const record = this.getKeyring().activeKey;
    if (
      !record ||
      record.version !== 1 ||
      !Number.isInteger(record.keyVersion) ||
      record.keyVersion < 1 ||
      typeof record.authenticationRequired !== 'boolean'
    ) {
      return null;
    }
    return record;
  }

  setActiveKey(record: ActiveKeyMetadata): void {
    const keyring = this.getKeyring();
    this.replaceKeyring(record, keyring.wrappedSecrets);
  }

  getWrappedSecrets(): Record<string, NativeWrappedSecret> {
    return { ...this.getKeyring().wrappedSecrets };
  }

  setWrappedSecret(purpose: string, wrapped: NativeWrappedSecret): void {
    const keyring = this.getKeyring();
    this.replaceKeyring(keyring.activeKey, {
      ...keyring.wrappedSecrets,
      [purpose]: wrapped,
    });
  }

  hasWrappedSecrets(): boolean {
    return Object.keys(this.getKeyring().wrappedSecrets).length > 0;
  }

  getWebPinVerifier(): WebPinVerifierRecord | null {
    const record = readJson<WebPinVerifierRecord>(
      this.storage,
      SECURITY_STATE_KEYS.WEB_PIN_VERIFIER
    );
    if (
      !record ||
      record.version !== 1 ||
      record.algorithm !== 'argon2id' ||
      typeof record.encodedHash !== 'string' ||
      !record.encodedHash.startsWith('$argon2id$')
    ) {
      return null;
    }
    return record;
  }

  setWebPinVerifier(record: WebPinVerifierRecord): void {
    writeJson(this.storage, SECURITY_STATE_KEYS.WEB_PIN_VERIFIER, record);
  }

  clearWebPinVerifier(): void {
    this.storage?.removeItem(SECURITY_STATE_KEYS.WEB_PIN_VERIFIER);
  }
}

export const securityStateStore = new SecurityStateStore();
