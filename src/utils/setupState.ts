import type { Language } from '../types';

export const CURRENT_SETUP_VERSION = 1;
export const CURRENT_LEGAL_VERSION = 1;

export const SETUP_KEYS = {
  VERSION: 'spendwise_setup_version',
  PENDING: 'spendwise_setup_pending_v1',
  LEGAL_VERSION: 'spendwise_legal_ack_version',
  LEGACY_INITIALIZED: 'spendwise_clean_init_v3',
} as const;

export interface SetupKeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): SetupKeyValueStore {
  return localStorage;
}

const EXISTING_STATE_KEYS = [
  SETUP_KEYS.LEGACY_INITIALIZED,
  'spendwise_currency',
  'spendwise_theme',
  'spendwise_language',
  'spendwise_app_lock_enabled',
  'spendwise_lock_timeout_seconds',
  'spendwise_lock_pin',
  'spendwise_expenses',
  'spendwise_budgets',
  'spendwise_expense_attachments_v1',
] as const;

function hasPreWp18State(storage: SetupKeyValueStore): boolean {
  return EXISTING_STATE_KEYS.some((key) => storage.getItem(key) !== null);
}

function parsedVersion(value: string | null): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function initializeSetupState(
  storage: SetupKeyValueStore = browserStorage()
): 'fresh' | 'migrated' | 'complete' {
  if (parsedVersion(storage.getItem(SETUP_KEYS.VERSION)) >= CURRENT_SETUP_VERSION) {
    storage.removeItem(SETUP_KEYS.PENDING);
    return 'complete';
  }

  if (storage.getItem(SETUP_KEYS.PENDING) === 'true') {
    return 'fresh';
  }

  if (hasPreWp18State(storage)) {
    storage.setItem(SETUP_KEYS.VERSION, String(CURRENT_SETUP_VERSION));
    storage.removeItem(SETUP_KEYS.PENDING);
    return 'migrated';
  }

  storage.setItem(SETUP_KEYS.PENDING, 'true');
  return 'fresh';
}

export function shouldShowFirstRun(
  storage: SetupKeyValueStore = browserStorage()
): boolean {
  return (
    parsedVersion(storage.getItem(SETUP_KEYS.VERSION)) < CURRENT_SETUP_VERSION &&
    storage.getItem(SETUP_KEYS.PENDING) === 'true'
  );
}

export function completeInitialSetup(
  storage: SetupKeyValueStore = browserStorage()
): void {
  storage.setItem(SETUP_KEYS.VERSION, String(CURRENT_SETUP_VERSION));
  storage.setItem(SETUP_KEYS.LEGAL_VERSION, String(CURRENT_LEGAL_VERSION));
  storage.removeItem(SETUP_KEYS.PENDING);
}

export function acknowledgeCurrentLegal(
  storage: SetupKeyValueStore = browserStorage()
): void {
  storage.setItem(SETUP_KEYS.LEGAL_VERSION, String(CURRENT_LEGAL_VERSION));
}

export function hasAcknowledgedCurrentLegal(
  storage: SetupKeyValueStore = browserStorage()
): boolean {
  return parsedVersion(storage.getItem(SETUP_KEYS.LEGAL_VERSION)) >= CURRENT_LEGAL_VERSION;
}

export function getSetupVersion(
  storage: SetupKeyValueStore = browserStorage()
): number {
  return parsedVersion(storage.getItem(SETUP_KEYS.VERSION));
}

export function directionForLanguage(language: Language): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

export function isValidSetupPin(pin: string, confirmation: string): boolean {
  return /^\d{4,8}$/.test(pin) && pin === confirmation;
}

export const SetupState = {
  initialize: initializeSetupState,
  shouldShowFirstRun,
  completeInitialSetup,
  acknowledgeCurrentLegal,
  hasAcknowledgedCurrentLegal,
  getSetupVersion,
};
