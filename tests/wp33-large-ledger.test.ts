import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticLedger, BENCHMARK_SIZES, BENCHMARK_ANCHOR, createRestoreHarness, createSyntheticMedia } from '../scripts/wp33/fixtures';
import { validateFinancialState, financialStatesEqual, persistWebFinancialState, readLegacyFinancialState } from '../src/utils/financialState';
import { searchHistoryExpenses, filterHistoryByDay, groupHistoryByCategory, groupHistoryByDay } from '../src/utils/historyView';
import { selectMonthlyLedger } from '../src/app/selectors/monthlyLedger';
import { currentMonthYear, getMonthKey } from '../src/utils/date';
import { StatisticsEngine } from '../src/utils/statisticsEngine';
import { rankLargestExpensesByMonth } from '../src/utils/statisticsRanking';
import { SpendingAnalyzer } from '../src/utils/spendingAnalyzer';
import { createBackupV2Archive } from '../src/utils/backupV2';
import { createBackupV3Envelope, restoreBackupV3WithAdapters } from '../src/utils/backupV3';
import { analyzeMediaIntegrity } from '../src/utils/mediaIntegrity';
import { convertCurrencyAmount } from '../src/utils/currency';
import { ExpenseDeleteUndoController, restorePendingExpenses } from '../src/utils/undoDeleteBatch';

const dayKey = (stamp: number) => { const date = new Date(stamp); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };
const monthKey = (stamp: number) => { const date = new Date(stamp); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
const cents = (items: { amount: number }[]) => items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);

for (const size of BENCHMARK_SIZES) {
  test(`WP33 fixture ${size}: deterministic valid ledger, independent history/statistics/currency totals`, () => {
    const state = createSyntheticLedger(size); const again = createSyntheticLedger(size);
    assert.deepEqual(state, again); assert.equal(validateFinancialState(state).expenses.length, size);
    assert.equal(state.expenses.length, size); const original = JSON.stringify(state);
    const stats = StatisticsEngine.calculateStatistics(state.expenses, state.budgets, 'ALL_TIME', BENCHMARK_ANCHOR);
    assert.equal(stats.totalTransactions, size); assert.ok(Math.abs(stats.totalSpent - cents(state.expenses) / 100) < 0.00001);
    for (const group of groupHistoryByCategory(state.expenses)) {
      const expected = state.expenses.filter((item) => item.category === group.category);
      assert.deepEqual(group.expenses.map((item) => item.id).sort((a, b) => a - b), expected.map((item) => item.id).sort((a, b) => a - b));
      assert.ok(Math.abs(group.total - cents(expected) / 100) < 0.00001);
    }
    const query = 'fixture 17'; const expectedSearch = state.expenses.filter((item) => `${item.description.toLowerCase()} ${item.category.toLowerCase()} ${item.note?.toLowerCase() ?? ''}`.includes(query));
    assert.deepEqual(searchHistoryExpenses(state.expenses, query).map((item) => item.id).sort((a, b) => a - b), expectedSearch.map((item) => item.id).sort((a, b) => a - b));
    if (size) {
      const day = state.expenses[0].date;
      assert.deepEqual(filterHistoryByDay(state.expenses, day).map((item) => item.id).sort((a, b) => a - b), state.expenses.filter((item) => dayKey(item.date) === dayKey(day)).map((item) => item.id).sort((a, b) => a - b));
      const summary = new SpendingAnalyzer().computeHistoricalSummary(state.expenses, BENCHMARK_ANCHOR);
      const anchorKey = `${BENCHMARK_ANCHOR.year}-${String(BENCHMARK_ANCHOR.month).padStart(2, '0')}`;
      assert.ok(Math.abs(summary.currentMonthTotal - cents(state.expenses.filter((item) => monthKey(item.date) === anchorKey)) / 100) < 0.00001);
    }
    assert.equal(groupHistoryByDay(state.expenses).reduce((sum, group) => sum + group.expenses.length, 0), size);
    for (const month of stats.monthlyStats) {
      const entries = state.expenses.filter((item) => monthKey(item.date) === month.monthKey);
      assert.equal(month.transactionCount, entries.length); assert.ok(Math.abs(month.totalSpent - cents(entries) / 100) < 0.00001);
      const largest = entries.reduce<(typeof entries)[number] | null>((best, item) => !best || item.amount > best.amount ? item : best, null);
      assert.deepEqual(month.largestExpense, largest);
    }
    for (const trend of stats.categoryTrends) {
      const categoryEntries = state.expenses.filter((item) => item.category === trend.category);
      assert.ok(Math.abs(trend.totalSpent - cents(categoryEntries) / 100) < 0.00001);
      for (const month of trend.monthlyData) {
        const entries = categoryEntries.filter((item) => monthKey(item.date) === month.monthKey);
        assert.equal(month.count, entries.length); assert.ok(Math.abs(month.amount - cents(entries) / 100) < 0.00001);
      }
      const complete = trend.monthlyData.filter((item) => item.monthKey !== getMonthKey(currentMonthYear()));
      const previous = complete.at(-2)?.amount ?? 0; const latest = complete.at(-1)?.amount ?? 0;
      assert.equal(trend.hasComparableHistory, complete.length >= 2 && previous > 0);
      if (trend.hasComparableHistory) {
        const percentage = (latest - previous) / previous * 100;
        assert.equal(trend.trendPercent, percentage);
        assert.equal(trend.trendDirection, percentage > 10 ? 'UP' : percentage < -10 ? 'DOWN' : 'STABLE');
      }
    }
    const selected = selectMonthlyLedger(state.expenses, state.budgets, BENCHMARK_ANCHOR);
    const anchorKey = `${BENCHMARK_ANCHOR.year}-${String(BENCHMARK_ANCHOR.month).padStart(2, '0')}`;
    assert.ok(Math.abs(selected.totalSpent - cents(state.expenses.filter((item) => monthKey(item.date) === anchorKey)) / 100) < 0.00001);
    const ranked = rankLargestExpensesByMonth(stats.monthlyStats);
    for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].expense.amount >= ranked[i].expense.amount);
    assert.deepEqual(rankLargestExpensesByMonth(stats.monthlyStats), ranked);
    // Storage preserves fractional cents; independent rational arithmetic avoids display rounding.
    for (const item of state.expenses.slice(0, 200)) assert.equal(convertCurrencyAmount(item.amount, 1.25), Math.round(item.amount * 100) * 5 / 400);
    assert.equal(JSON.stringify(state), original);
  });
  test(`WP33 fixture ${size}: isolated persistence restart and Backup v3 replace round trip`, async () => {
    const state = createSyntheticLedger(size); const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
    persistWebFinancialState(storage, state); assert.ok(financialStatesEqual(readLegacyFinancialState(storage), state));
    const payload = await createBackupV2Archive({ appVersion: '2.0.0', state, settings: { currencyCode: 'USD', themeMode: 'SYSTEM', language: 'en' }, includeMedia: false, readMedia: async () => { throw new Error('no media in data-only fixture'); } });
    const backup = await createBackupV3Envelope({ payload, passphrase: 'WP33 synthetic benchmark passphrase', mediaIncluded: false });
    const harness = createRestoreHarness(createSyntheticLedger(0));
    const restored = await restoreBackupV3WithAdapters(backup, 'WP33 synthetic benchmark passphrase', true, harness.adapters);
    assert.equal(restored.expensesImported, size); assert.ok(financialStatesEqual(harness.getState(), state));
  });
}

test('large synthetic ledger Undo restores ordered entries without committing data', () => {
  const state = createSyntheticLedger(10000); let commits = 0;
  const controller = new ExpenseDeleteUndoController({ onBatchChange: () => {}, onCommit: () => { commits++; }, schedule: () => 1, cancel: () => {} });
  // stage receives the index in the currently visible list after earlier deletions.
  for (const [removedCount, index] of [0, 5000, 9999].entries()) controller.stage(state.expenses[index], index - removedCount);
  const removed = new Set([1, 5001, 10000]);
  const remaining = state.expenses.filter((item) => !removed.has(item.id));
  assert.deepEqual(restorePendingExpenses(remaining, controller.undo()), state.expenses); assert.equal(commits, 0); controller.dispose();
});

test('generated representative media inventory stays correct at scale', () => {
  const state = createSyntheticLedger(10000); const media = createSyntheticMedia(state, 1000);
  const report = analyzeMediaIntegrity(state.expenses, media.attachments, media.binaries, 1_800_000_000_000);
  assert.equal(report.totalMetadataRecords, 1000); assert.equal(report.totalBinaryFiles, 1000); assert.equal(report.issues.length, 0);
  const broken = analyzeMediaIntegrity(state.expenses, media.attachments, media.binaries.slice(1), 1_800_000_000_000);
  assert.equal(broken.missingFileCount, 1); assert.equal(broken.healthy, false);
});
