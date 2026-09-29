import test from 'node:test';
import assert from 'node:assert/strict';
import { Expense, ExpenseAttachment, SpendWiseBackup } from '../src/types';
import {
  LEGACY_FINANCIAL_KEYS,
  KeyValueStore,
  readLegacyFinancialState,
  recoverWebFinancialTransaction,
} from '../src/utils/financialState';
import { LocalDataStoreImpl } from '../src/utils/localDataStore';

class MemoryStorage implements KeyValueStore {
  private values = new Map<string, string>();
  failOnceKey: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failOnceKey === key) {
      this.failOnceKey = null;
      throw new Error('SIMULATED_STORAGE_FAILURE');
    }
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const expense = (id = 1, amount = 12.5): Expense => ({
  id,
  amount,
  description: `Expense ${id}`,
  category: 'Food',
  date: 1_780_000_000_000 + id,
  note: null,
  createdAt: 1_780_000_100_000 + id,
});

const attachment = (expenseId = 1): ExpenseAttachment => ({
  id: `att-${expenseId}`,
  expenseId,
  storageKey: `expense-attachments/att-${expenseId}.jpg`,
  mimeType: 'image/jpeg',
  createdAt: 1_780_000_200_000 + expenseId,
  originalFilename: 'receipt.jpg',
  kind: 'receipt',
  byteSize: 1200,
  width: 800,
  height: 600,
});

function seed(storage: MemoryStorage) {
  storage.setItem(LEGACY_FINANCIAL_KEYS.EXPENSES, JSON.stringify([expense()]));
  storage.setItem(
    LEGACY_FINANCIAL_KEYS.BUDGETS,
    JSON.stringify([{ monthKey: '2026-09', startingAmount: 500, updatedAt: 1_780_000_300_000 }])
  );
  storage.setItem(LEGACY_FINANCIAL_KEYS.ATTACHMENTS, JSON.stringify([attachment()]));
  storage.setItem(LEGACY_FINANCIAL_KEYS.CURRENCY, 'USD');
}

test('fresh database initialization', async () => {
  const store = new LocalDataStoreImpl();
  await store.init(new MemoryStorage());
  assert.deepEqual(store.snapshot(), { expenses: [], budgets: [], attachments: [], currencyCode: 'USD' });
});

test('legacy empty installation migration input', () => {
  assert.deepEqual(readLegacyFinancialState(new MemoryStorage()), {
    expenses: [], budgets: [], attachments: [], currencyCode: 'USD',
  });
});

test('legacy populated installation migration preserves all structured data', () => {
  const storage = new MemoryStorage();
  seed(storage);
  const state = readLegacyFinancialState(storage);
  assert.equal(state.expenses.length, 1);
  assert.equal(state.budgets.length, 1);
  assert.equal(state.attachments.length, 1);
  assert.equal(state.attachments[0].expenseId, state.expenses[0].id);
});

test('migration/open is idempotent and does not duplicate records', async () => {
  const storage = new MemoryStorage();
  seed(storage);
  const first = new LocalDataStoreImpl();
  const second = new LocalDataStoreImpl();
  await first.init(storage);
  await second.init(storage);
  assert.deepEqual(second.snapshot(), first.snapshot());
  assert.equal(second.getExpenses().length, 1);
});

test('expense create read update delete', async () => {
  const store = new LocalDataStoreImpl();
  await store.init(new MemoryStorage());
  const created = expense();
  await store.createExpenseWithAttachments(created, []);
  assert.equal(store.getExpenses()[0].id, 1);
  await store.updateExpenseWithAttachments({ ...created, description: 'Updated' }, []);
  assert.equal(store.getExpenses()[0].description, 'Updated');
  await store.deleteExpense(1);
  assert.equal(store.getExpenses().length, 0);
});

test('budget persistence survives restart', async () => {
  const storage = new MemoryStorage();
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  await store.upsertBudget('2026-09', 900, 1_780_000_400_000);
  const restarted = new LocalDataStoreImpl();
  await restarted.init(storage);
  assert.equal(restarted.getBudgets()[0].startingAmount, 900);
});

test('attachment metadata survives migration', async () => {
  const storage = new MemoryStorage();
  seed(storage);
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  assert.deepEqual(store.getAttachments(), [attachment()]);
});

test('deleting an expense returns exactly its attachment metadata for file cleanup', async () => {
  const storage = new MemoryStorage();
  seed(storage);
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  assert.deepEqual(await store.deleteExpense(1), [attachment()]);
  assert.deepEqual(store.getAttachments(), []);
});

test('currency conversion replacement is atomic on persistence failure', async () => {
  const storage = new MemoryStorage();
  seed(storage);
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  const before = store.snapshot();
  storage.failOnceKey = LEGACY_FINANCIAL_KEYS.BUDGETS;
  await assert.rejects(
    store.replaceLedgerAmountsAndCurrency(
      before.expenses.map((item) => ({ ...item, amount: item.amount * 2 })),
      before.budgets.map((item) => ({ ...item, startingAmount: item.startingAmount * 2 })),
      'EUR'
    )
  );
  assert.deepEqual(store.snapshot(), before);
  assert.deepEqual(readLegacyFinancialState(storage), before);
});

test('backup-style merge state remains durable after migration', async () => {
  const storage = new MemoryStorage();
  seed(storage);
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  const next = store.snapshot();
  next.expenses.unshift(expense(2, 30));
  await store.replaceState(next);
  const restarted = new LocalDataStoreImpl();
  await restarted.init(storage);
  assert.equal(restarted.getExpenses().length, 2);
});

test('replace restore is atomic and replaces attachment ownership metadata', async () => {
  const storage = new MemoryStorage();
  seed(storage);
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  await store.replaceState({
    expenses: [expense(7, 45)],
    budgets: [{ monthKey: '2026-10', startingAmount: 1200, updatedAt: 1_780_000_500_000 }],
    attachments: [],
    currencyCode: 'EUR',
  });
  assert.equal(store.getExpenses()[0].id, 7);
  assert.equal(store.getAttachments().length, 0);
  assert.equal(store.getCurrencyCode(), 'EUR');
});

test('invalid legacy data remains untouched', () => {
  const storage = new MemoryStorage();
  const corrupt = '[{"id":';
  storage.setItem(LEGACY_FINANCIAL_KEYS.EXPENSES, corrupt);
  assert.throws(() => readLegacyFinancialState(storage), /LEGACY_EXPENSES_INVALID_JSON/);
  assert.equal(storage.getItem(LEGACY_FINANCIAL_KEYS.EXPENSES), corrupt);
});

test('interrupted prepared migration-style web transaction restores prior state', () => {
  const storage = new MemoryStorage();
  seed(storage);
  const original = {
    expenses: storage.getItem(LEGACY_FINANCIAL_KEYS.EXPENSES),
    budgets: storage.getItem(LEGACY_FINANCIAL_KEYS.BUDGETS),
    attachments: storage.getItem(LEGACY_FINANCIAL_KEYS.ATTACHMENTS),
    currency: storage.getItem(LEGACY_FINANCIAL_KEYS.CURRENCY),
  };
  const target = { expenses: JSON.stringify([expense(9, 99)]), budgets: '[]', attachments: null, currency: 'EUR' };
  storage.setItem(LEGACY_FINANCIAL_KEYS.EXPENSES, target.expenses);
  storage.setItem(
    LEGACY_FINANCIAL_KEYS.WEB_TXN,
    JSON.stringify({ version: 1, phase: 'prepared', original, target })
  );
  recoverWebFinancialTransaction(storage);
  assert.equal(storage.getItem(LEGACY_FINANCIAL_KEYS.EXPENSES), original.expenses);
  assert.equal(storage.getItem(LEGACY_FINANCIAL_KEYS.WEB_TXN), null);
});

test('restart returns identical durable state', async () => {
  const storage = new MemoryStorage();
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  await store.createExpenseWithAttachments(expense(), [attachment()]);
  await store.upsertBudget('2026-09', 777, 1_780_000_600_000);
  const expected = store.snapshot();
  const restarted = new LocalDataStoreImpl();
  await restarted.init(storage);
  assert.deepEqual(restarted.snapshot(), expected);
});

test('Backup v1 import and replace restore work after persistence initialization', async () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

  const { StorageManager } = await import('../src/utils/storage');
  await StorageManager.init();

  const backup: SpendWiseBackup = {
    metadata: {
      appVersion: '1.0.0',
      schemaVersion: 1,
      exportedAt: 1_780_000_700_000,
      exportedAtFormatted: '2026-09-29 12:00:00',
      totalExpenses: 1,
      totalBudgets: 1,
    },
    settings: { currencyCode: 'USD', themeMode: 'DARK', language: 'en' },
    expenses: [{ ...expense(5, 25), dateFormatted: '2026-09-29' }],
    monthlyBudgets: [{ monthKey: '2026-09', startingAmount: 650, updatedAt: 1_780_000_800_000 }],
  };

  const imported = await StorageManager.restoreBackup(backup, false);
  assert.equal(imported.expensesImported, 1);
  assert.equal(StorageManager.getExpenses().length, 1);

  const replaced = await StorageManager.restoreBackup(backup, true);
  assert.equal(replaced.wasReplaced, true);
  assert.equal(StorageManager.getExpenses()[0].id, 5);
  assert.equal(StorageManager.getBudgets()[0].startingAmount, 650);
});
