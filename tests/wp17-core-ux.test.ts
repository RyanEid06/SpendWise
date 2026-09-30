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
import { readFileSync } from 'node:fs';

const historySource = readFileSync('src/screens/HistoryScreen.tsx', 'utf8');
const cardSource = readFileSync('src/components/ExpenseItemCard.tsx', 'utf8');
const detailSource = readFileSync('src/components/ExpenseDetailModal.tsx', 'utf8');
const navSource = readFileSync('src/components/Navigation.tsx', 'utf8');
const topBarSource = readFileSync('src/components/AppTopBar.tsx', 'utf8');
const manifestSource = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

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


test('History exposes All, Day, and Category controls while keeping All as initial mode', () => {
  assert.match(historySource, /useState<HistoryViewMode>\('ALL'\)/);
  assert.match(historySource, /\['ALL',[\s\S]*\['DAY',[\s\S]*\['CATEGORY'/);
});

test('History metadata is positive-only and attachment counts are derived once per ledger change', () => {
  assert.match(historySource, /AttachmentStorage\.getAllAttachments\(\)/);
  assert.match(cardSource, /attachmentCount\s*>\s*0/);
  assert.match(cardSource, /Boolean\(expense\.note\?\.trim\(\)\)/);
  assert.doesNotMatch(cardSource, /No photos|No note/);
});

test('approved WP20 Undo policy supersedes routine confirmation while detail remains read-only', () => {
  assert.doesNotMatch(historySource, /<ConfirmationModal|expenseToDelete/);
  assert.match(historySource, /onRequestDelete=\{\(\) => onDeleteExpense\(expense\)\}/);
  assert.doesNotMatch(detailSource, /onEdit|Edit2|Trash2|onDelete/);
});

test('WP17 keeps exactly four primary destinations', () => {
  const entries = navSource.match(/\{ screen: '(home|history|insights|statistics)'/g) || [];
  assert.equal(entries.length, 4);
  assert.doesNotMatch(navSource, /screen: 'settings'/);
});

test('header and Android launcher both use SpendWise artwork rather than the Capacitor placeholder', () => {
  assert.match(topBarSource, /src="\/app-icon\.jpg"/);
  assert.match(manifestSource, /android:icon="@drawable\/spendwise_app_icon"/);
  assert.match(manifestSource, /android:roundIcon="@drawable\/spendwise_app_icon"/);
});
