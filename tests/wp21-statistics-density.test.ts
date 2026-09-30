import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Expense, MonthlyBudget } from '../src/types';
import { StatisticsEngine } from '../src/utils/statisticsEngine';
import { t } from '../src/utils/translations';

const statisticsSource = readFileSync('src/screens/StatisticsScreen.tsx', 'utf8');

const expense = (
  id: number,
  amount: number,
  year: number,
  monthIndex: number,
  description: string
): Expense => {
  const date = new Date(year, monthIndex, 15, 12).getTime();
  return {
    id,
    amount,
    description,
    category: 'Food',
    date,
    note: null,
    createdAt: date + id,
  };
};

test('WP21 renders exactly four compact statistic cells in a true 2x2 grid', () => {
  assert.match(statisticsSource, /data-statistics-summary-grid="2x2"/);
  assert.match(statisticsSource, /className="grid grid-cols-2 gap-px/);
  assert.equal((statisticsSource.match(/data-stat-summary-cell="true"/g) || []).length, 4);

  for (const key of ['statTotalSpent', 'statAvgExpense', 'statFrequency', 'statLargestExpense']) {
    assert.match(statisticsSource, new RegExp(`t\\(language, '${key}'\\)`));
  }
});

test('WP21 uses human-readable transaction and largest-expense wording in all languages', () => {
  assert.equal(t('en', 'txnsLabel'), 'transactions');
  assert.equal(t('fr', 'txnsLabel'), 'transactions');
  assert.equal(t('ar', 'txnsLabel'), 'معاملات');

  assert.equal(t('en', 'topLabel'), 'Largest: ');
  assert.equal(t('fr', 'topLabel'), 'Plus grande : ');
  assert.equal(t('ar', 'topLabel'), 'الأكبر: ');

  assert.doesNotMatch(statisticsSource, />\\s*txns\\s*</i);
  assert.doesNotMatch(statisticsSource, /Top:/);
});

test('WP21 presentation changes preserve StatisticsEngine summary mappings', () => {
  const expenses: Expense[] = [
    expense(1, 10, 2026, 6, 'July item'),
    expense(2, 20, 2026, 7, 'August item'),
    expense(3, 30, 2026, 8, 'September item'),
  ];
  const budgets: MonthlyBudget[] = [
    { monthKey: '2026-07', startingAmount: 100 },
    { monthKey: '2026-08', startingAmount: 100 },
    { monthKey: '2026-09', startingAmount: 100 },
  ];

  const stats = StatisticsEngine.calculateStatistics(
    expenses,
    budgets,
    'LAST_3_MONTHS',
    { year: 2026, month: 9 }
  );

  assert.equal(stats.totalSpent, 60);
  assert.equal(stats.totalTransactions, 3);
  assert.equal(stats.averageTransactionAmount, 20);
  assert.equal(stats.averageTransactionsPerMonth, 1);
  assert.equal(stats.overallLargestExpense?.id, 3);
  assert.equal(stats.overallLargestExpense?.amount, 30);
  assert.deepEqual(stats.monthlyStats.map((month) => month.transactionCount), [1, 1, 1]);
});
