import test from 'node:test';
import assert from 'node:assert/strict';
import type { Expense, ExpenseAttachment } from '../src/types';
import {
  LEGACY_FINANCIAL_KEYS,
  type FinancialState,
  type KeyValueStore,
  readLegacyFinancialState,
} from '../src/utils/financialState';
import { LocalDataStoreImpl } from '../src/utils/localDataStore';
import {
  createBackupV2Archive,
  restoreBackupV2WithAdapters,
  type BackupV2AttachmentRecord,
} from '../src/utils/backupV2';
import {
  AndroidSecurityAdapter,
  type NativeAuthenticationResult,
  type NativeKeyResult,
} from '../src/platform/android/AndroidSecurityAdapter';
import { AndroidSecureKeyService } from '../src/security/SecureKeyService';
import {
  SecurityStateStore,
  type SecurityStateStorage,
} from '../src/security/SecurityStateStore';

const NOW = 1_780_339_200_000;
const settings = { currencyCode: 'USD', themeMode: 'LIGHT' as const, language: 'en' as const };

function expense(id: number, description = `Fixture ${id}`): Expense {
  return {
    id,
    amount: 10 + id,
    description,
    category: 'Food & Dining',
    date: NOW + id,
    note: 'synthetic WP32 fixture',
    createdAt: NOW + id,
  };
}

function attachment(id: string, expenseId = 1): ExpenseAttachment {
  return {
    id,
    expenseId,
    storageKey: `expense-attachments/${id}.jpg`,
    mimeType: 'image/jpeg',
    createdAt: NOW + expenseId,
    originalFilename: 'wp32-fixture.jpg',
    kind: 'proof',
    byteSize: 4,
    width: 1,
    height: 1,
  };
}

function stateWithMedia(count = 1): FinancialState {
  return {
    expenses: [expense(1)],
    budgets: [{ monthKey: '2026-10', startingAmount: 1250, updatedAt: NOW }],
    attachments: Array.from({ length: count }, (_, index) => attachment(`photo-${index + 1}`)),
    currencyCode: 'USD',
  };
}

class FaultyStorage implements KeyValueStore, SecurityStateStorage {
  private values = new Map<string, string>();
  failOnceKey: string | null = null;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnceKey === key) {
      this.failOnceKey = null;
      throw new Error('WP32_INJECTED_STORAGE_FAILURE');
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function seedLegacy(storage: FaultyStorage) {
  storage.setItem(LEGACY_FINANCIAL_KEYS.EXPENSES, JSON.stringify([expense(7, 'Authoritative old ledger')]));
  storage.setItem(
    LEGACY_FINANCIAL_KEYS.BUDGETS,
    JSON.stringify([{ monthKey: '2026-10', startingAmount: 777, updatedAt: NOW }])
  );
  storage.setItem(LEGACY_FINANCIAL_KEYS.ATTACHMENTS, '[]');
  storage.setItem(LEGACY_FINANCIAL_KEYS.CURRENCY, 'USD');
}

async function fullBackup(mediaCount = 1): Promise<Blob> {
  return createBackupV2Archive({
    appVersion: '1.4.0-wp32-fixture',
    state: stateWithMedia(mediaCount),
    settings,
    includeMedia: true,
    readMedia: async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
  });
}

function staged(source: BackupV2AttachmentRecord, targetExpenseId: number, blob: Blob): ExpenseAttachment {
  return {
    id: `staged-${source.id}`,
    expenseId: targetExpenseId,
    storageKey: `expense-attachments/staged-${source.id}.jpg`,
    mimeType: 'image/jpeg',
    createdAt: source.createdAt,
    originalFilename: source.originalFilename ?? null,
    kind: source.kind,
    byteSize: blob.size,
    width: source.width,
    height: source.height,
  };
}

test('database/write failure preserves the authoritative ledger and restart recovery', async () => {
  const storage = new FaultyStorage();
  seedLegacy(storage);
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  const before = store.snapshot();

  storage.failOnceKey = LEGACY_FINANCIAL_KEYS.BUDGETS;
  await assert.rejects(
    store.replaceState({
      expenses: [expense(88, 'Should never become authoritative')],
      budgets: [{ monthKey: '2026-10', startingAmount: 9999, updatedAt: NOW + 1 }],
      attachments: [],
      currencyCode: 'EUR',
    }),
    /WP32_INJECTED_STORAGE_FAILURE/
  );

  assert.deepEqual(store.snapshot(), before);
  assert.deepEqual(readLegacyFinancialState(storage), before);

  const restarted = new LocalDataStoreImpl();
  await restarted.init(storage);
  assert.deepEqual(restarted.snapshot(), before);
});

test('Backup restore DB failure rolls structured state back and deletes staged media', async () => {
  const backup = await fullBackup(1);
  const oldState: FinancialState = {
    expenses: [expense(90, 'Existing protected ledger')],
    budgets: [{ monthKey: '2026-10', startingAmount: 500, updatedAt: NOW }],
    attachments: [],
    currencyCode: 'USD',
  };
  let current = structuredClone(oldState);
  let currentSettings = { ...settings };
  let replaceCalls = 0;
  const cleaned: string[] = [];

  await assert.rejects(
    restoreBackupV2WithAdapters(backup, true, {
      getState: () => current,
      getSettings: () => currentSettings,
      replaceState: async (next) => {
        current = structuredClone(next);
        replaceCalls += 1;
        if (replaceCalls === 1) throw new Error('WP32_INJECTED_DB_COMMIT_FAILURE');
      },
      setSettings: async (next) => { currentSettings = { ...next }; },
      stageMedia: async (source, targetExpenseId, blob) => staged(source, targetExpenseId, blob),
      deleteFiles: async (items) => { cleaned.push(...items.map((item) => item.id)); },
    }),
    /WP32_INJECTED_DB_COMMIT_FAILURE/
  );

  assert.deepEqual(current, oldState);
  assert.deepEqual(currentSettings, settings);
  assert.deepEqual(cleaned, ['staged-photo-1']);
});

test('partial staged-media failure never mutates the current ledger and cleans completed staging', async () => {
  const backup = await fullBackup(2);
  const oldState: FinancialState = {
    expenses: [expense(91, 'Ledger before media fault')],
    budgets: [],
    attachments: [],
    currencyCode: 'USD',
  };
  let current = structuredClone(oldState);
  let stageCalls = 0;
  const cleaned: string[] = [];

  await assert.rejects(
    restoreBackupV2WithAdapters(backup, true, {
      getState: () => current,
      getSettings: () => settings,
      replaceState: async (next) => { current = structuredClone(next); },
      setSettings: async () => {},
      stageMedia: async (source, targetExpenseId, blob) => {
        stageCalls += 1;
        if (stageCalls === 2) throw new Error('WP32_INJECTED_MEDIA_STAGE_FAILURE');
        return staged(source, targetExpenseId, blob);
      },
      deleteFiles: async (items) => { cleaned.push(...items.map((item) => item.id)); },
    }),
    /WP32_INJECTED_MEDIA_STAGE_FAILURE/
  );

  assert.deepEqual(current, oldState);
  assert.deepEqual(cleaned, ['staged-photo-1']);
});

test('settings failure after restore commit rolls financial state and settings back together', async () => {
  const backup = await fullBackup(1);
  const oldState: FinancialState = {
    expenses: [expense(92, 'Ledger before settings fault')],
    budgets: [],
    attachments: [],
    currencyCode: 'USD',
  };
  const oldSettings = { currencyCode: 'USD', themeMode: 'DARK' as const, language: 'fr' as const };
  let current = structuredClone(oldState);
  let currentSettings = { ...oldSettings };
  let settingCalls = 0;

  await assert.rejects(
    restoreBackupV2WithAdapters(backup, true, {
      getState: () => current,
      getSettings: () => currentSettings,
      replaceState: async (next) => { current = structuredClone(next); },
      setSettings: async (next) => {
        currentSettings = { ...next };
        settingCalls += 1;
        if (settingCalls === 1) throw new Error('WP32_INJECTED_SETTINGS_FAILURE');
      },
      stageMedia: async (source, targetExpenseId, blob) => staged(source, targetExpenseId, blob),
      deleteFiles: async () => {},
    }),
    /WP32_INJECTED_SETTINGS_FAILURE/
  );

  assert.deepEqual(current, oldState);
  assert.deepEqual(currentSettings, oldSettings);
});

class KeyStatusAdapter extends AndroidSecurityAdapter {
  constructor(
    private readonly keyStatus: NativeKeyResult['status'],
    private readonly verification: NativeAuthenticationResult['status'] = 'success'
  ) {
    super();
  }

  override isAvailable(): boolean {
    return true;
  }

  override async getKeyStatus(
    keyVersion: number,
    authenticationRequired: boolean
  ): Promise<NativeKeyResult> {
    return {
      status: this.keyStatus,
      alias: `spendwise-key-v${keyVersion}`,
      keyVersion,
      authenticationRequired,
    };
  }

  override async verifyKey(): Promise<NativeAuthenticationResult & { keyStatus?: NativeKeyResult['status'] }> {
    return {
      status: this.verification,
      keyStatus: this.keyStatus,
      code: this.verification === 'cancelled' ? 'USER_CANCELLED' : undefined,
    };
  }
}

function securityStoreWithProtectedSecret(): SecurityStateStore {
  const storage = new FaultyStorage();
  const store = new SecurityStateStore(storage);
  store.setActiveKey({ version: 1, keyVersion: 7, authenticationRequired: true });
  store.setWrappedSecret('database', {
    format: 'spendwise-wrap-v1',
    keyVersion: 7,
    alias: 'spendwise-key-v7',
    purpose: 'database',
    nonceBase64: 'fixture',
    ciphertextBase64: 'fixture',
  });
  return store;
}

test('invalidated Android key fails closed without discarding protected key metadata', async () => {
  const stateStore = securityStoreWithProtectedSecret();
  const service = new AndroidSecureKeyService(new KeyStatusAdapter('invalidated'), stateStore);
  const result = await service.establish(true, 'WP32 invalidation fixture');

  assert.equal(result.ok, false);
  if (result.ok) assert.fail('invalidated key unexpectedly succeeded');
  assert.equal(result.kind, 'invalidated');
  assert.equal(stateStore.getActiveKey()?.keyVersion, 7);
  assert.equal(stateStore.hasWrappedSecrets(), true);
});

test('cancelled Android authentication fails closed and preserves protected state for retry', async () => {
  const stateStore = securityStoreWithProtectedSecret();
  const service = new AndroidSecureKeyService(new KeyStatusAdapter('present', 'cancelled'), stateStore);
  const result = await service.establish(true, 'WP32 cancellation fixture');

  assert.equal(result.ok, false);
  if (result.ok) assert.fail('cancelled authentication unexpectedly succeeded');
  assert.equal(result.kind, 'cancelled');
  assert.equal(stateStore.getActiveKey()?.keyVersion, 7);
  assert.equal(stateStore.hasWrappedSecrets(), true);
});
