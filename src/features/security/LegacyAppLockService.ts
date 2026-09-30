import { StorageManager } from '../../utils/storage';

export type LegacyPinState =
  | { kind: 'none' }
  | { kind: 'valid'; pin: string }
  | { kind: 'malformed'; raw: string };

/**
 * Read-only compatibility boundary for the v1.4 plaintext custom PIN.
 *
 * WP28 may read this credential only long enough to perform a lockout-safe
 * migration. New credentials must never be written through this service.
 */
export interface LegacyAppLockService {
  getPinState(): LegacyPinState;
  clearPin(): void;
}

class StorageManagerLegacyAppLockService implements LegacyAppLockService {
  getPinState(): LegacyPinState {
    const raw = StorageManager.getLockPin();
    if (!raw) return { kind: 'none' };
    if (/^\d{4,8}$/.test(raw)) return { kind: 'valid', pin: raw };
    return { kind: 'malformed', raw };
  }

  clearPin(): void {
    StorageManager.clearLockPin();
  }
}

export const legacyAppLockService: LegacyAppLockService =
  new StorageManagerLegacyAppLockService();
