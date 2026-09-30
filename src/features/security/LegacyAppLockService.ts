import { StorageManager } from '../../utils/storage';

/**
 * Compatibility boundary for the v1.4 custom PIN implementation.
 * WP28 replaces this behavior behind SecureSessionService/SecureKeyService.
 */
export interface LegacyAppLockService {
  hasPin(): boolean;
  readPin(): string;
  savePin(pin: string): void;
}

class StorageManagerLegacyAppLockService implements LegacyAppLockService {
  hasPin(): boolean {
    return StorageManager.hasLockPin();
  }
  readPin(): string {
    return StorageManager.getLockPin();
  }
  savePin(pin: string): void {
    StorageManager.setLockPin(pin);
  }
}

export const legacyAppLockService: LegacyAppLockService =
  new StorageManagerLegacyAppLockService();
