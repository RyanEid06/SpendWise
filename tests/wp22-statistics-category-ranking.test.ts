import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Expense, MonthlySpendingStat } from '../src/types';
import { currentMonthYear, previousMonth } from '../src/utils/date';
import { StatisticsEngine } from '../src/utils/statisticsEngine';
import { rankLargestExpensesByMonth } from '../src/utils/statisticsRanking';
import { wp17Copy } from '../src/utils/wp17Copy';

const homeCategorySource = readFileSync('src/components/CategoryBreakdownSection.tsx', 'utf8');
const statisticsCategorySource = readFileSync('src/components/CategoryStatisticsSection.tsx', 'utf8');
const sharedCategorySource = readFileSync('src/components/CategorySpendRow.tsx', 'utf8');
const statisticsScreenSource = readFileSync('src/screens/StatisticsScreen.tsx', 'utf8');

const makeExpense = (
  id: number,
  amount: number,
  year: number,
  month: number,
  description = 'Item',
  category = 'Food'
): Expense => {
  const date = new Date(year, month - 1, 15, 12).getTime();
  return {
    id,
    amount,
    description,
    category,
    date,
    note: null,
    createdAt: date + id,
  };
};

const makeMonth = (
  monthKey: string,
  amount: number | null,
  id: number
): MonthlySpendingStat => ({
  monthKey,
  monthDisplayName: monthKey,
  totalSpent: amount ?? 0,
  startingBudget: 0,
  isBudgetSet: false,
  remainingMoney: 0,
  transactionCount: amount == null ? 0 : 1,
  isPartialMonth: false,
  largestExpense: amount == null
    ? null
    : makeExpense(id, amount, Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 'Expense ' + id),
});

test('WP22 Home and Statistics consume one shared category base while Home stays simple', () => {
  assert.match(homeCategorySource, /import \{ CategorySpendRow \} from '\.\/CategorySpendRow'/);
  assert.match(statisticsCategorySource, /import \{ CategorySpendRow \} from '\.\/CategorySpendRow'/);
  assert.match(homeCategorySource, /<CategorySpendRow/);
  assert.match(statisticsCategorySource, /<CategorySpendRow/);
  assert.match(sharedCategorySource, /data-category-spend-base="true"/);
  assert.match(sharedCategorySource, /role="progressbar"/);

  assert.doesNotMatch(homeCategorySource, /TrendingUp|TrendingDown|hasComparableHistory|ChevronDown|ChevronUp/);
});

test('WP22 Statistics layers expansion, monthly history, and non-color-only trend states', () => {
  assert.match(statisticsCategorySource, /aria-expanded=\{isExpanded\}/);
  assert.match(statisticsCategorySource, /catTrend\.monthlyData\.map/);
  assert.match(statisticsCategorySource, /data-trend-state=\{trendState\}/);

  for (const marker of ['TrendingUp', 'TrendingDown', 'Minus', 'Info']) {
    assert.match(statisticsCategorySource, new RegExp(marker));
  }

  assert.equal(wp17Copy('en', 'trendUnavailable'), 'Not enough history');
  assert.equal(wp17Copy('fr', 'trendUnavailable'), 'Historique insuffisant');
  assert.equal(wp17Copy('ar', 'trendUnavailable'), 'لا يوجد سجل كافٍ');
  assert.equal(wp17Copy('en', 'trendUp'), 'Up');
  assert.equal(wp17Copy('fr', 'trendDown'), 'Baisse');
  assert.equal(wp17Copy('ar', 'trendStable'), 'مستقر');
});

test('WP22 engine distinguishes comparable stable history from insufficient history', () => {
  const comparable = StatisticsEngine.calculateStatistics(
    [
      makeExpense(1, 100, 2000, 1),
      makeExpense(2, 100, 2000, 2),
      makeExpense(3, 105, 2000, 3),
    ],
    [],
    'LAST_3_MONTHS',
    { year: 2000, month: 3 }
  ).categoryTrends[0];

  assert.equal(comparable?.hasComparableHistory, true);
  assert.equal(comparable?.trendDirection, 'STABLE');

  const insufficient = StatisticsEngine.calculateStatistics(
    [makeExpense(4, 100, 2000, 3)],
    [],
    'CURRENT_MONTH',
    { year: 2000, month: 3 }
  ).categoryTrends[0];

  assert.equal(insufficient?.hasComparableHistory, false);
  assert.equal(insufficient?.trendDirection, 'STABLE');
  assert.equal(insufficient?.trendPercent, 0);
});

test('WP22 excludes the live incomplete month from category trend comparison', () => {
  const now = currentMonthYear();
  const prior = previousMonth(now);
  const twoBack = previousMonth(prior);

  const stats = StatisticsEngine.calculateStatistics(
    [
      makeExpense(10, 100, twoBack.year, twoBack.month),
      makeExpense(11, 150, prior.year, prior.month),
      makeExpense(12, 1, now.year, now.month),
    ],
    [],
    'LAST_3_MONTHS',
    now
  );

  const trend = stats.categoryTrends[0];
  assert.equal(trend?.hasComparableHistory, true);
  assert.equal(trend?.trendDirection, 'UP');
  assert.equal(Math.round(trend?.trendPercent ?? 0), 50);
});

test('WP22 ranks Largest Expense by Month by amount without mutating source statistics', () => {
  const source = [
    makeMonth('2026-01', 500, 1),
    makeMonth('2026-02', 900, 2),
    makeMonth('2026-03', 500, 3),
    makeMonth('2026-04', 100, 4),
    makeMonth('2026-05', null, 5),
  ];
  const before = JSON.stringify(source);

  const ranked = rankLargestExpensesByMonth(source);

  assert.deepEqual(ranked.map((item) => item.expense.amount), [900, 500, 500, 100]);
  assert.deepEqual(ranked.map((item) => item.rank), [1, 2, 3, 4]);
  assert.deepEqual(ranked.map((item) => item.month.monthKey), ['2026-02', '2026-03', '2026-01', '2026-04']);
  assert.equal(JSON.stringify(source), before);
});

test('WP22 tie ordering is deterministic: newer month first, then expense id', () => {
  const tied = [
    makeMonth('2025-12', 250, 8),
    makeMonth('2026-01', 250, 7),
  ];

  const ranked = rankLargestExpensesByMonth(tied);
  assert.deepEqual(ranked.map((item) => item.month.monthKey), ['2026-01', '2025-12']);
});

test('WP22 ranked month cards preserve rank, month, category, amount hierarchy, and navigation', () => {
  assert.match(statisticsScreenSource, /rankLargestExpensesByMonth\(stats\.monthlyStats\)/);
  assert.match(statisticsScreenSource, /rankedLargestExpenses\.map/);
  assert.match(statisticsScreenSource, /getLocalizedMonthName/);
  assert.match(statisticsScreenSource, /getLocalizedCategoryName\(expense\.category, language\)/);
  assert.match(statisticsScreenSource, /formatCurrency\(expense\.amount, currencyCode\)/);
  assert.match(statisticsScreenSource, /rank === 1/);
  assert.match(statisticsScreenSource, /rank === 2/);
  assert.match(statisticsScreenSource, /rank === 3/);
  assert.match(statisticsScreenSource, /onNavigateToExpense\(expense\)/);
});
