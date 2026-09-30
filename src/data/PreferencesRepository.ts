import { Language, ThemeMode } from '../types';
import { StorageManager } from '../utils/storage';

export interface PreferencesRepository {
  getThemeMode(): ThemeMode;
  setThemeMode(mode: ThemeMode): void;
  getLanguage(): Language;
  setLanguage(language: Language): void;
  isAppLockEnabled(): boolean;
  setAppLockEnabled(enabled: boolean): void;
  getLockTimeoutSeconds(): number;
  setLockTimeoutSeconds(seconds: number): void;
}

export class StorageManagerPreferencesRepository implements PreferencesRepository {
  getThemeMode(): ThemeMode {
    return StorageManager.getThemeMode();
  }
  setThemeMode(mode: ThemeMode): void {
    StorageManager.setThemeMode(mode);
  }
  getLanguage(): Language {
    return StorageManager.getLanguage();
  }
  setLanguage(language: Language): void {
    StorageManager.setLanguage(language);
  }
  isAppLockEnabled(): boolean {
    return StorageManager.isAppLockEnabled();
  }
  setAppLockEnabled(enabled: boolean): void {
    StorageManager.setAppLockEnabled(enabled);
  }
  getLockTimeoutSeconds(): number {
    return StorageManager.getLockTimeoutSeconds();
  }
  setLockTimeoutSeconds(seconds: number): void {
    StorageManager.setLockTimeoutSeconds(seconds);
  }
}

export const preferencesRepository: PreferencesRepository =
  new StorageManagerPreferencesRepository();
