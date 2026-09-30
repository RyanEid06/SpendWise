import test from 'node:test';
import assert from 'node:assert/strict';
import { Expense } from '../src/types';
import {
  filterHistoryByDay,
  formatHistoryGroupLabel,
  groupHistoryByCategory,
  groupHistoryByDay,
  isSwipeDeleteArmed,
  searchHistoryExpenses,
} from '../src/utils/historyView';
import { selectPrimaryInsights } from '../src/utils/insightSelection';
import { StatisticsEngine } from '../src/utils/statisticsEngine';

const expense = (id: number, amount: number, date: number, category = 'Food', description = 'Item'): Expense => ({
  id,
  amount,
  description,
  category,
  date,
  note: null,
  createdAt: date + id,
});

test('chronological day grouping keeps newest transaction first', () => {
  const day1 = new Date(2026, 8, 28, 10).getTime();
  const day2 = new Date(2026, 8, 29, 9).getTime();
  const groups = groupHistoryByDay([expense(1, 4, day1), expense(2, 5, day2)]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].expenses[0].id, 2);
});

test('Today and Yesterday labels are localized', () => {
  const now = new Date(2026, 8, 30, 12).getTime();
  const yesterday = new Date(2026, 8, 29, 12).getTime();
  assert.equal(formatHistoryGroupLabel(now, 'en', now), 'Today');
  assert.equal(formatHistoryGroupLabel(yesterday, 'fr', now), 'Hier');
  assert.equal(formatHistoryGroupLabel(now, 'ar', now), 'اليوم');
});

test('day filtering and search compose without changing source array', () => {
  const selected = new Date(2026, 8, 30, 12).getTime();
  const items = [
    expense(1, 10, new Date(2026, 8, 30, 9).getTime(), 'Food', 'Coffee'),
    expense(2, 20, new Date(2026, 8, 29, 9).getTime(), 'Food', 'Lunch'),
  ];
  const searched = searchHistoryExpenses(items, 'coffee');
  assert.equal(filterHistoryByDay(searched, selected).length, 1);
  assert.equal(items.length, 2);
});

test('category grouping reports totals and counts', () => {
  const now = Date.now();
  const groups = groupHistoryByCategory([
    expense(1, 10, now, 'Food'),
    expense(2, 15, now + 1, 'Food'),
    expense(3, 40, now + 2, 'Travel'),
  ]);
  const food = groups.find((group) => group.category === 'Food');
  assert.equal(food?.count, 2);
  assert.equal(food?.total, 25);
});

test('swipe delete arms only in the semantic destructive direction', () => {
  assert.equal(isSwipeDeleteArmed(-120, 320, false), true);
  assert.equal(isSwipeDeleteArmed(120, 320, false), false);
  assert.equal(isSwipeDeleteArmed(120, 320, true), true);
  assert.equal(isSwipeDeleteArmed(-120, 320, true), false);
});

test('primary insights are capped at three', () => {
  const item = (title: string) => ({ title, explanation: 'x', numbers: '', severity: 'NOTABLE' as const });
  const selected = selectPrimaryInsights({
    timestamp: 1,
    analyzedMonthKey: '2026-09',
    isAiGenerated: false,
    spendingOverview: 'x',
    historyContext: 'x',
    biggestChanges: [item('a'), item('b')],
    unusualExpenses: [item('c'), item('d')],
    recurringSpending: [item('e')],
    areasToReview: [item('f')],
  });
  assert.equal(selected.length, 3);
});

test('category trend is stable when comparable completed history is insufficient', () => {
  const now = new Date();
  const overview = StatisticsEngine.calculateStatistics(
    [expense(1, 10, new Date(now.getFullYear(), now.getMonth(), 2).getTime(), 'Food')],
    [],
    'CURRENT_MONTH',
    { year: now.getFullYear(), month: now.getMonth() + 1 }
  );
  assert.equal(overview.categoryTrends[0]?.trendDirection, 'STABLE');
  assert.equal(overview.categoryTrends[0]?.trendPercent, 0);
});
