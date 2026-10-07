import assert from 'node:assert/strict';
import test from 'node:test';
import type { Expense } from '../src/types';
import { getCategoryInfo } from '../src/utils/categories';
import { getLocalizedCategoryName } from '../src/utils/translations';
import { validateFinancialState } from '../src/utils/financialState';
import { groupHistoryByCategory, searchHistoryExpenses } from '../src/utils/historyView';
import { StatisticsEngine } from '../src/utils/statisticsEngine';
import { SpendingAnalyzer } from '../src/utils/spendingAnalyzer';
import { selectMonthlyLedger } from '../src/app/selectors/monthlyLedger';
import { createBackupV2Archive, restoreBackupV2WithAdapters, type BackupV2AttachmentRecord } from '../src/utils/backupV2';
import { createBackupV3Envelope, restoreBackupV3WithAdapters } from '../src/utils/backupV3';
import { LocalDataStoreImpl } from '../src/utils/localDataStore';
import type { FinancialState } from '../src/utils/financialState';

const date = new Date(2026, 9, 3, 12).getTime();
const expenses: Expense[] = ['Food', 'Food & Beverage', 'Groceries'].map((category, index) => ({
  id: index + 1, amount: [10, 20, 40][index], category, description: 'Coffee', date, createdAt: date + index,
}));

test('old and new dining names share the historical storage key and translations', () => {
  assert.equal(getCategoryInfo('Food & Beverage').name, 'Food');
  assert.equal(getLocalizedCategoryName('Food', 'en'), 'Food & Beverage');
  assert.equal(getLocalizedCategoryName('Food & Beverage', 'fr'), 'Restauration et boissons');
  assert.equal(getLocalizedCategoryName('Food & Beverage', 'ar'), 'الطعام والمشروبات');
  const state = validateFinancialState({ expenses, budgets: [], attachments: [], currencyCode: 'USD' });
  assert.deepEqual(state.expenses.map(item => item.category), ['Food', 'Food', 'Groceries']);
  assert.equal(expenses[1].category, 'Food & Beverage');
});

test('History and monthly rankings combine dining aliases without combining groceries', () => {
  const history = groupHistoryByCategory(expenses);
  assert.deepEqual(history.map(group => [group.category, group.total]), [['Groceries', 40], ['Food', 30]]);
  const monthly = selectMonthlyLedger(expenses, [], { year: 2026, month: 10 });
  assert.deepEqual(monthly.categoryBreakdown.map(group => [group.categoryName, group.amount]), [['Groceries', 40], ['Food', 30]]);
});

test('History search finds legacy dining records by the displayed label in every language', () => {
  for (const [language, query] of [['en', 'beverage'], ['fr', 'boissons'], ['ar', 'المشروبات']] as const) {
    assert.deepEqual(searchHistoryExpenses(expenses, query, language).map(item => item.id), [2, 1]);
  }
});

test('Statistics and AI history use one dining category for mixed legacy/import records', () => {
  const stats = StatisticsEngine.calculateStatistics(expenses, [], 'CURRENT_MONTH', { year: 2026, month: 10 });
  assert.deepEqual(stats.categoryPercentages.map(group => [group.category, group.amount]), [['Groceries', 40], ['Food', 30]]);
  const summary = new SpendingAnalyzer().computeHistoricalSummary(expenses, { year: 2026, month: 10 });
  assert.equal(summary.categoryBaselines.filter(group => group.category === 'Food').length, 1);
  assert.equal(summary.categoryBaselines.find(group => group.category === 'Food')?.currentMonthTotal, 30);
});

test('local AI prose uses the new dining label while category payloads keep the stable key', () => {
  const dining = expenses.slice(0, 2);
  const stats = StatisticsEngine.calculateStatistics(dining, [], 'CURRENT_MONTH', { year: 2026, month: 10 });
  const trend = StatisticsEngine.generateLocalTrendExplanation(stats, 'USD');
  assert.match(trend.categoryHighlights.join(' '), /Food & Beverage/);
  const analyzer = new SpendingAnalyzer();
  const analysis = analyzer.generateStatisticalAnalysis(analyzer.computeHistoricalSummary(dining, { year: 2026, month: 10 }), 'USD');
  assert.match(analysis.areasToReview[0].title, /Food & Beverage/);
  assert.equal(analysis.areasToReview[0].category, 'Food');
});

test('legacy database read and repeated initialization alias new dining names without data loss', async () => {
  const values = new Map<string, string>([['spendwise_expenses', JSON.stringify(expenses)]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  for (let index = 0; index < 2; index++) {
    const store = new LocalDataStoreImpl();
    await store.init(storage);
    assert.deepEqual(store.getExpenses().map(item => [item.id, item.amount, item.category]), [[1, 10, 'Food'], [2, 20, 'Food'], [3, 40, 'Groceries']]);
  }
});

test('photo-inclusive encrypted backup preserves historical proof and aliases dining on restore/merge', async () => {
  const photo = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  const proof = { id: 'legacy-proof', expenseId: 2, storageKey: 'expense-attachments/legacy-proof.jpg',
    mimeType: 'image/jpeg', kind: 'proof' as const, createdAt: date, byteSize: 4, width: 1, height: 1, originalFilename: 'proof.jpg' };
  const settings = { currencyCode: 'USD', language: 'en' as const, themeMode: 'DARK' as const };
  const source: FinancialState = { expenses, attachments: [proof], budgets: [], currencyCode: 'USD' };
  const archive = await createBackupV2Archive({ appVersion: '2.0.0', state: source, settings, includeMedia: true, readMedia: async () => photo });
  const envelope = await createBackupV3Envelope({ payload: archive, passphrase: 'wp04-public-test-password', mediaIncluded: true });
  let restored: FinancialState = { expenses: [], attachments: [], budgets: [], currencyCode: 'USD' };
  const adapters = { getState: () => restored, getSettings: () => settings,
    replaceState: async (state: FinancialState) => { restored = state; }, setSettings: async () => {},
    stageMedia: async (item: BackupV2AttachmentRecord, expenseId: number, blob: Blob) => {
      assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
      return { ...item, expenseId };
    }, deleteFiles: async () => {} };
  await restoreBackupV3WithAdapters(envelope, 'wp04-public-test-password', true, adapters);
  assert.deepEqual(restored.expenses.map(item => item.category), ['Food', 'Food', 'Groceries']);
  assert.equal(restored.attachments[0].kind, 'proof');
  assert.equal(restored.attachments[0].expenseId, 2);
  const changedTimestamps = { ...source, expenses: source.expenses.map(item => ({ ...item, createdAt: item.createdAt + 10000 })) };
  const merge = await createBackupV2Archive({ appVersion: '2.0.0', state: changedTimestamps, settings, includeMedia: false, readMedia: async () => photo });
  const result = await restoreBackupV2WithAdapters(merge, false, adapters);
  assert.equal(result.expensesSkipped, 3);
  assert.equal(restored.expenses.length, 3);
});
