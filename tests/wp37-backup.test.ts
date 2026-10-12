import test from 'node:test';
import assert from 'node:assert/strict';
import { BackupService } from '../src/features/backup/BackupService';
import { StorageManager } from '../src/utils/storage';
import { LocalDataStore, LocalDataStoreImpl } from '../src/utils/localDataStore';
import type { AiAnalysisResult, BackupSettings, SpendWiseBackup } from '../src/types';
import type { FinancialState } from '../src/utils/financialState';
import { createBackupV2Archive, restoreBackupV2WithAdapters, validateBackupV2Archive, type BackupV2RestoreAdapters } from '../src/utils/backupV2';
import { BackupRecoveryIncompleteError } from '../src/utils/backupRestore';
import { AttachmentStorage } from '../src/utils/attachmentStorage';
import { decryptBackupV3Envelope } from '../src/utils/backupV3';

// Use the real web financial transaction writer and preference storage. Only
// individual storage failures are injected; reopen constructs a fresh datastore.
class TestStorage {
  values = new Map<string, string>();
  beforeWrite: ((key: string, value: string) => void) | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    this.beforeWrite?.(key, value);
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const storage = new TestStorage();
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
await StorageManager.init();
const service = new BackupService();
const passphrase = 'wp37 synthetic backup passphrase';
const source: FinancialState = {
  expenses: [{ id: 37, amount: 20, description: 'Synthetic receipt', category: 'Food', date: 1_780_000_000_000, createdAt: 1_780_000_000_000, note: null }],
  budgets: [{ monthKey: '2026-09', startingAmount: 400, updatedAt: 1_780_000_000_000 }],
  attachments: [], currencyCode: 'EUR',
};
const current: FinancialState = {
  expenses: [{ ...source.expenses[0], id: 9, amount: 99, createdAt: 1_770_000_000_000 }],
  budgets: [], attachments: [], currencyCode: 'USD',
};
type Format = 1 | 2 | 3;
async function seed(state: FinancialState, settings: Pick<BackupSettings, 'themeMode' | 'language'>) {
  storage.beforeWrite = null;
  await LocalDataStore.replaceState(state);
  StorageManager.setThemeMode(settings.themeMode);
  StorageManager.setLanguage(settings.language);
}
async function backup(format: Format, settings: Pick<BackupSettings, 'themeMode' | 'language'> = { themeMode: 'DARK', language: 'ar' }) {
  await seed(source, settings);
  return format === 1 ? service.createLegacy() : format === 2 ? service.createV2(false) : service.createV3(false, passphrase);
}
function restore(format: Format, data: SpendWiseBackup | Blob, replace = true, options?: { restoreAppPreferences?: boolean }) {
  return format === 1 ? service.restoreLegacy(data as SpendWiseBackup, replace, options)
    : format === 2 ? service.restoreV2(data as Blob, replace, options)
      : service.restoreV3(data as Blob, passphrase, replace, options);
}
async function assertReopened(state: FinancialState, theme: string, language: string) {
  const reopened = new LocalDataStoreImpl();
  await reopened.init(storage);
  assert.deepEqual(reopened.snapshot(), state);
  assert.equal(StorageManager.getThemeMode(), theme);
  assert.equal(StorageManager.getLanguage(), language);
}

for (const format of [1, 2, 3] as const) {
  for (const device of [
    { themeMode: 'LIGHT', language: 'en' },
    { themeMode: 'DARK', language: 'ar' },
    { themeMode: 'SYSTEM', language: 'fr' },
  ] as const) {
    test(`V${format} default Replace preserves current ${device.themeMode}/${device.language}, adopts currency and reopens`, async () => {
      const data = await backup(format, device.themeMode === 'DARK' ? { themeMode: 'LIGHT', language: 'en' } : { themeMode: 'DARK', language: 'ar' });
      await seed(current, device);
      const summary = await restore(format, data);
      assert.equal(summary.currencyUpdated, 'EUR');
      await assertReopened(source, device.themeMode, device.language);
    });
  }
  test(`V${format} explicit preference restore applies backup language and SYSTEM appearance`, async () => {
    const data = await backup(format, { themeMode: 'SYSTEM', language: 'ar' });
    await seed(current, { themeMode: 'LIGHT', language: 'en' });
    await restore(format, data, true, { restoreAppPreferences: true });
    await assertReopened(source, 'SYSTEM', 'ar');
  });
  test(`V${format} default Replace performs no preference writes`, async () => {
    const data = await backup(format);
    await seed(current, { themeMode: 'SYSTEM', language: 'fr' });
    storage.beforeWrite = (key) => {
      if (key === 'spendwise_theme' || key === 'spendwise_language') throw new Error('UNEXPECTED_PREFERENCE_WRITE');
    };
    await restore(format, data);
    storage.beforeWrite = null;
    await assertReopened(source, 'SYSTEM', 'fr');
  });
  test(`V${format} Merge into an empty ledger adopts backup currency and preserves preferences`, async () => {
    const data = await backup(format);
    await seed({ expenses: [], budgets: [], attachments: [], currencyCode: 'USD' }, { themeMode: 'LIGHT', language: 'fr' });
    await restore(format, data, false, { restoreAppPreferences: true });
    const expected = format === 1 ? { ...source, expenses: source.expenses.map((item, index) => ({ ...item, id: index + 1 })) } : source;
    await assertReopened(expected, 'LIGHT', 'fr');
  });
  test(`V${format} Merge ignores opt-in, keeps preferences and currency mismatch safeguard`, async () => {
    const data = await backup(format);
    await seed(current, { themeMode: 'SYSTEM', language: 'fr' });
    await assert.rejects(() => restore(format, data, false, { restoreAppPreferences: true }), /BACKUP_CURRENCY_MISMATCH/);
    await assertReopened(current, 'SYSTEM', 'fr');
    await seed({ ...current, currencyCode: 'EUR' }, { themeMode: 'SYSTEM', language: 'fr' });
    await restore(format, data, false, { restoreAppPreferences: true });
    assert.equal(StorageManager.getThemeMode(), 'SYSTEM');
    assert.equal(StorageManager.getLanguage(), 'fr');
    assert.equal(LocalDataStore.getExpenses().length, 2);
  });
  test(`V${format} partial preference failure after financial commit restores prior persisted state`, async () => {
    const data = await backup(format);
    await seed(current, { themeMode: 'SYSTEM', language: 'en' });
    let injected = false;
    storage.beforeWrite = (key, value) => {
      if (!injected && key === 'spendwise_language' && value === 'ar') {
        injected = true;
        assert.deepEqual(LocalDataStore.snapshot(), source, 'financial commit precedes settings');
        assert.equal(StorageManager.getThemeMode(), 'DARK', 'theme write already persisted');
        throw new Error('SIMULATED_PREFERENCE_WRITE_FAILURE');
      }
    };
    await assert.rejects(() => restore(format, data, true, { restoreAppPreferences: true }), /SIMULATED_PREFERENCE_WRITE_FAILURE/);
    assert.ok(injected);
    storage.beforeWrite = null;
    await assertReopened(current, 'SYSTEM', 'en');
  });
  test(`V${format} failed preference rollback reports incomplete recovery and retains ledger on reopen`, async () => {
    const data = await backup(format);
    await seed(current, { themeMode: 'SYSTEM', language: 'en' });
    storage.beforeWrite = (key, value) => {
      if (key === 'spendwise_language' && value === 'ar') throw new Error('SIMULATED_PREFERENCE_WRITE_FAILURE');
      if (key === 'spendwise_theme' && value === 'SYSTEM') throw new Error('SIMULATED_ROLLBACK_FAILURE');
    };
    await assert.rejects(() => restore(format, data, true, { restoreAppPreferences: true }), /BACKUP_RESTORE_RECOVERY_INCOMPLETE/);
    storage.beforeWrite = null;
    await assertReopened(current, 'DARK', 'en');
  });
  test(`V${format} exports only allowed preference fields and never restores local security state`, async () => {
    storage.setItem('spendwise_app_lock_enabled', 'true');
    storage.setItem('spendwise_lock_timeout_seconds', '60');
    storage.setItem('spendwise_auth_token', 'synthetic-security-sentinel');
    const data = await backup(format);
    const payload = format === 1 ? data as SpendWiseBackup : (await validateBackupV2Archive(format === 3 ? await decryptBackupV3Envelope(data as Blob, passphrase) : data as Blob)).manifest;
    assert.deepEqual(Object.keys(payload.settings).sort(), ['currencyCode', 'language', 'themeMode']);
    assert.ok(!JSON.stringify(payload).includes('synthetic-security-sentinel'));
    await seed(current, { themeMode: 'LIGHT', language: 'en' });
    await restore(format, data, true, { restoreAppPreferences: true });
    assert.equal(storage.getItem('spendwise_app_lock_enabled'), 'true');
    assert.equal(storage.getItem('spendwise_lock_timeout_seconds'), '60');
    assert.equal(storage.getItem('spendwise_auth_token'), 'synthetic-security-sentinel');
  });
}

test('V2 verifies a silently unsuccessful financial rollback and retains potentially referenced staged media', async () => {
  const item = {
    id: 'source-photo', expenseId: 37, storageKey: 'expense-attachments/source-photo.jpg',
    mimeType: 'image/jpeg', createdAt: 1_780_000_000_000, kind: 'receipt' as const, byteSize: 4, width: 1, height: 1,
  };
  const data = await createBackupV2Archive({ appVersion: '2.1.2', state: { ...source, attachments: [item] }, settings: { currencyCode: 'EUR', themeMode: 'DARK', language: 'ar' }, includeMedia: true, readMedia: async () => new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' }) });
  await seed(current, { themeMode: 'SYSTEM', language: 'en' });
  let writes = 0;
  const deleted: string[] = [];
  const adapters: BackupV2RestoreAdapters = {
    getState: () => LocalDataStore.snapshot(),
    getSettings: () => ({ currencyCode: StorageManager.getCurrencyCode(), themeMode: StorageManager.getThemeMode(), language: StorageManager.getLanguage() }),
    replaceState: async (state) => { if (++writes === 1) await LocalDataStore.replaceState(state); },
    setSettings: async () => { throw new Error('SIMULATED_PREFERENCE_FAILURE'); },
    stageMedia: async () => ({ ...item, id: 'staged-photo', storageKey: 'expense-attachments/staged-photo.jpg' }),
    deleteFiles: async (items) => { deleted.push(...items.map((item) => item.id)); },
  };
  await assert.rejects(() => restoreBackupV2WithAdapters(data, true, adapters, { restoreAppPreferences: true }), (error) => {
    assert.ok(error instanceof BackupRecoveryIncompleteError);
    assert.equal(error.financialRecovered, false);
    assert.equal(error.preferencesRecovered, true);
    return true;
  });
  assert.deepEqual(deleted, []);
  const reopened = new LocalDataStoreImpl();
  await reopened.init(storage);
  assert.equal(reopened.getAttachments()[0].id, 'staged-photo');
});

test('V2 verifies a silently unsuccessful preference rollback', async () => {
  const data = await backup(2);
  await seed(current, { themeMode: 'SYSTEM', language: 'en' });
  let settingsWrites = 0;
  await assert.rejects(() => restoreBackupV2WithAdapters(data as Blob, true, {
    getState: () => LocalDataStore.snapshot(),
    getSettings: () => ({ currencyCode: StorageManager.getCurrencyCode(), themeMode: StorageManager.getThemeMode(), language: StorageManager.getLanguage() }),
    replaceState: (state) => LocalDataStore.replaceState(state),
    setSettings: async (settings) => {
      if (++settingsWrites === 1) {
        StorageManager.setThemeMode(settings.themeMode);
        throw new Error('SIMULATED_PARTIAL_PREFERENCE_WRITE');
      }
      // The rollback resolves but fails to persist its requested values.
    },
    stageMedia: async () => { throw new Error('UNEXPECTED_MEDIA'); },
    deleteFiles: async () => {},
  }, { restoreAppPreferences: true }), /BACKUP_RESTORE_RECOVERY_INCOMPLETE/);
  await assertReopened(current, 'DARK', 'en');
});

test('V1 post-commit media cleanup failure reports a warning with committed restore', async (context) => {
  const data = await backup(1);
  await seed({ ...current, attachments: [{ id: 'old-photo', expenseId: 9, storageKey: 'expense-attachments/old-photo.jpg', mimeType: 'image/jpeg', createdAt: 1_770_000_000_000, kind: 'receipt', byteSize: 4, width: 1, height: 1 }] }, { themeMode: 'LIGHT', language: 'en' });
  context.mock.method(AttachmentStorage, 'deleteDetachedFiles', async () => { throw new Error('SIMULATED_CLEANUP_FAILURE'); });
  const result = await restore(1, data);
  assert.deepEqual(result.warnings, ['POST_COMMIT_MEDIA_CLEANUP_FAILED']);
  await assertReopened(source, 'LIGHT', 'en');
});

for (const format of [1, 2, 3] as const) {
  for (const removalFails of [false, true]) {
    test(`V${format} incomplete financial recovery discards stale insights${removalFails ? ' even when cache removal fails' : ''}`, async (context) => {
      const data = await backup(format);
      await seed(current, { themeMode: 'SYSTEM', language: 'en' });
      const stale: AiAnalysisResult = { timestamp: 1_780_000_000_000, analyzedMonthKey: '2026-09', isAiGenerated: false, spendingOverview: 'Old ledger cached claim', historyContext: '', biggestChanges: [], unusualExpenses: [], recurringSpending: [], areasToReview: [] };
      StorageManager.cacheAnalysis(stale);
      assert.deepEqual(StorageManager.getCachedAnalysis('2026-09'), stale);
      const replaceState = LocalDataStore.replaceState.bind(LocalDataStore);
      context.mock.method(LocalDataStore, 'replaceState', async (state: FinancialState) => {
        if (state.currencyCode !== current.currencyCode) await replaceState(state);
      });
      storage.beforeWrite = (key, value) => {
        if (key === 'spendwise_language' && value === 'ar') throw new Error('SIMULATED_PREFERENCE_FAILURE');
      };
      if (removalFails) {
        const removeItem = storage.removeItem.bind(storage);
        context.mock.method(storage, 'removeItem', (key: string) => {
          if (key.startsWith('spendwise_ai_insights_cache_')) throw new Error('SIMULATED_CACHE_REMOVAL_FAILURE');
          removeItem(key);
        });
      }
      await assert.rejects(() => restore(format, data, true, { restoreAppPreferences: true }), (error) => {
        assert.ok(error instanceof BackupRecoveryIncompleteError);
        assert.equal(error.financialRecovered, false);
        return true;
      });
      assert.equal(LocalDataStore.getCurrencyCode(), 'EUR');
      assert.equal(StorageManager.getCachedAnalysis('2026-09'), null, 'old financial claims must not reload into reconciled UI');
      const fresh = { ...stale, timestamp: stale.timestamp + 1, spendingOverview: 'New ledger analysis' };
      StorageManager.cacheAnalysis(fresh);
      assert.deepEqual(StorageManager.getCachedAnalysis('2026-09'), fresh, 'fresh analysis may be cached after recovery failure');
      storage.beforeWrite = null;
    });
  }
}
