import type { BackupSettings, ImportSummary } from '../types';
import { financialStatesEqual, validateFinancialState, type FinancialState } from './financialState';

/** Restore policy only: these options are never serialized into a backup. */
export interface BackupRestoreOptions {
  restoreAppPreferences?: boolean;
}

export interface LegacyBackupRestoreSummary extends ImportSummary {
  warnings?: string[];
}

export interface BackupRestoreStateAdapters {
  getState(): FinancialState;
  getSettings(): BackupSettings;
  replaceState(state: FinancialState): Promise<void>;
  setSettings(settings: BackupSettings): Promise<void>;
}

export class BackupRecoveryIncompleteError extends Error {
  constructor(
    readonly financialRecovered: boolean,
    readonly preferencesRecovered: boolean,
    cause: unknown,
  ) {
    super('BACKUP_RESTORE_RECOVERY_INCOMPLETE', { cause });
    this.name = 'BackupRecoveryIncompleteError';
  }
}

function preferencesEqual(a: BackupSettings, b: BackupSettings): boolean {
  return a.themeMode === b.themeMode && a.language === b.language;
}

/** Financial persistence verifies its own durable commit. Check the returned
 * snapshot too, and compensate both domains if either settings write fails.
 * Settings may have changed before a rejected promise, so mark attempts first.
 */
export async function commitBackupRestore(
  adapters: BackupRestoreStateAdapters,
  oldState: FinancialState,
  nextState: FinancialState,
  oldSettings: BackupSettings,
  backupSettings: BackupSettings,
  replaceExisting: boolean,
  options: BackupRestoreOptions = {},
): Promise<void> {
  const applyPreferences = replaceExisting && options.restoreAppPreferences === true;
  const expectedSettings = {
    currencyCode: nextState.currencyCode,
    themeMode: applyPreferences ? backupSettings.themeMode : oldSettings.themeMode,
    language: applyPreferences ? backupSettings.language : oldSettings.language,
  };
  let settingsAttempted = false;
  try {
    await adapters.replaceState(nextState);
    if (!financialStatesEqual(validateFinancialState(adapters.getState()), nextState)) {
      throw new Error('BACKUP_RESTORE_COMMIT_VERIFICATION_FAILED');
    }
    if (applyPreferences) {
      settingsAttempted = true;
      await adapters.setSettings(expectedSettings);
    }
    const applied = adapters.getSettings();
    if (!preferencesEqual(applied, expectedSettings)) {
      // Even a writer that silently ignores a setting must fail verification.
      settingsAttempted ||= !preferencesEqual(applied, oldSettings);
      throw new Error('BACKUP_RESTORE_SETTINGS_VERIFICATION_FAILED');
    }
  } catch (error) {
    let financialRecovered = false;
    let preferencesRecovered = false;
    try {
      await adapters.replaceState(oldState);
      financialRecovered = financialStatesEqual(validateFinancialState(adapters.getState()), oldState);
    } catch { /* Recovery status is reported explicitly below. */ }
    if (settingsAttempted) {
      try { await adapters.setSettings(oldSettings); } catch { /* Verify even after a rejected partial write. */ }
    }
    try { preferencesRecovered = preferencesEqual(adapters.getSettings(), oldSettings); } catch { /* An unreadable preference state cannot be called recovered. */ }
    if (!financialRecovered || !preferencesRecovered) {
      throw new BackupRecoveryIncompleteError(financialRecovered, preferencesRecovered, error);
    }
    throw error;
  }
}
