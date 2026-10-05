import type { BackupSettings, ExpenseAttachment } from '../../src/types';
import type { MonthYear } from '../../src/utils/date';
import { validateFinancialState, type FinancialState, type KeyValueStore } from '../../src/utils/financialState';
import type { BackupV2RestoreAdapters } from '../../src/utils/backupV2';
import type { MediaBinaryInventoryItem } from '../../src/utils/mediaIntegrity';

export const BENCHMARK_SIZES = [0, 100, 1000, 10000, 25000] as const;
export const BENCHMARK_ANCHOR: MonthYear = { year: 2026, month: 10 };
export const FIXTURE_SEED = 330026;
export const FIXTURE_CLOCK = Date.UTC(2026, 9, 5, 12);
const categories = ['Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Health', 'Bills & Utilities'];

/** Synthetic data only. Fixed UTC midday dates are stable across supported timezones. */
export function createSyntheticLedger(size: number, seed = FIXTURE_SEED): FinancialState {
  if (!Number.isInteger(size) || size < 0 || size > 25000 || !Number.isSafeInteger(seed)) throw new Error('INVALID_SYNTHETIC_FIXTURE');
  let value = seed >>> 0;
  const next = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value; };
  const expenses = Array.from({ length: size }, (_, index) => {
    const date = Date.UTC(2026, index % 10, 1 + (index % 28), 12);
    return { id: index + 1, amount: (1 + next() % 50000) / 100, description: `Fixture ${index + 1}`, category: categories[index % categories.length], date, createdAt: date + index, note: index % 7 === 0 ? `Synthetic note ${index}` : null };
  });
  const budgets = size === 0 ? [] : Array.from({ length: 10 }, (_, index) => ({ monthKey: `2026-${String(index + 1).padStart(2, '0')}`, startingAmount: 5000, updatedAt: FIXTURE_CLOCK }));
  return validateFinancialState({ expenses, budgets, attachments: [], currencyCode: 'USD' });
}

export function createMemoryStorage(): KeyValueStore {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}

/** Isolated in-memory restore adapter; production archive validation/KDF are unchanged. */
export function createRestoreHarness(initial: FinancialState) {
  let state = structuredClone(initial);
  let settings: BackupSettings = { currencyCode: initial.currencyCode, themeMode: 'SYSTEM', language: 'en' };
  const staged: string[] = []; const deleted: string[] = [];
  const adapters: BackupV2RestoreAdapters = {
    getState: () => structuredClone(state), getSettings: () => ({ ...settings }),
    replaceState: async (next) => { state = structuredClone(validateFinancialState(next)); },
    setSettings: async (next) => { settings = { ...next }; },
    stageMedia: async (source, targetExpenseId, blob) => {
      const id = `wp33-restored-${source.id}`; staged.push(id);
      return { id, expenseId: targetExpenseId, storageKey: `expense-attachments/${id}.jpg`, mimeType: 'image/jpeg', createdAt: source.createdAt, originalFilename: null, kind: source.kind, byteSize: blob.size, width: source.width, height: source.height };
    },
    deleteFiles: async (items) => { deleted.push(...items.map((item) => item.storageKey)); },
  };
  return { adapters, getState: () => structuredClone(state), getSettings: () => ({ ...settings }), staged, deleted };
}

/** Metadata/inventory workload. It does not claim to benchmark JPEG decoding. */
export function createSyntheticMedia(state: FinancialState, count: number) {
  if (!Number.isInteger(count) || count < 0 || count > Math.min(9999, state.expenses.length * 8)) throw new Error('INVALID_SYNTHETIC_MEDIA_COUNT');
  const attachments: ExpenseAttachment[] = Array.from({ length: count }, (_, index) => ({
    id: `wp33-${index}`, expenseId: state.expenses[Math.floor(index / 8)].id,
    storageKey: `expense-attachments/wp33-${index}.jpg`, mimeType: 'image/jpeg', createdAt: FIXTURE_CLOCK,
    originalFilename: null, kind: (['purchase', 'receipt', 'proof'] as const)[index % 3], byteSize: 4096, width: 64, height: 64,
  }));
  const binaries: MediaBinaryInventoryItem[] = attachments.map((item) => ({ storageKey: item.storageKey, byteSize: item.byteSize, valid: true }));
  return { attachments, binaries };
}
