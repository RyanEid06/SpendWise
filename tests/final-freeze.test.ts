import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Expense } from '../src/types';
import { normalizeApiException, classifyApiFailure } from '../src/utils/apiErrors';
import { SpendingAnalyzer } from '../src/utils/spendingAnalyzer';
import { StatisticsEngine } from '../src/utils/statisticsEngine';

const navigation = readFileSync('src/components/Navigation.tsx', 'utf8');
const topBar = readFileSync('src/components/AppTopBar.tsx', 'utf8');
const app = readFileSync('src/app/AppShell.tsx', 'utf8');
const appNavigation = readFileSync('src/app/navigation/useAppNavigation.ts', 'utf8');
const themeLanguage = readFileSync('src/app/hooks/useThemeLanguage.ts', 'utf8');
const css = readFileSync('src/index.css', 'utf8');
const freeze = readFileSync('PRODUCT_FREEZE.md', 'utf8');

test('bottom navigation is frozen to exactly four primary destinations', () => {
  const entries = navigation.match(/\{ screen: '(home|history|insights|statistics)'/g) || [];
  assert.equal(entries.length, 4);
  assert.doesNotMatch(navigation, /screen: 'settings'/);
  assert.doesNotMatch(navigation, /\bSettings\b/);
  assert.match(navigation, /grid-cols-4/);
});

test('Settings is secondary in the top app bar and returns to its previous primary screen', () => {
  assert.match(topBar, /onOpenSettings/);
  assert.match(topBar, /onCloseSettings/);
  assert.match(topBar, /aria-label=\{copy\.settings\}/);
  assert.match(appNavigation, /settingsReturnScreen/);
  assert.match(appNavigation, /case 'close-settings':[\s\S]*currentScreen: state\.settingsReturnScreen/);
  assert.match(app, /navigation\.currentScreen !== 'settings' && \([\s\S]*<Navigation/);
});

test('app exposes a keyboard skip link and language direction remains explicit', () => {
  assert.match(app, /href="#main-content"/);
  assert.match(app, /id="main-content"/);
  assert.match(themeLanguage, /root\.setAttribute\('dir', directionForLanguage\(language\)\)/);
  assert.match(themeLanguage, /root\.setAttribute\('lang', language\)/);
});

test('accessibility baseline enforces 48px targets, visible focus and reduced motion', () => {
  assert.match(css, /min-height:\s*48px !important/);
  assert.match(css, /min-width:\s*48px !important/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('compact layout widens only modestly for larger screens', () => {
  assert.match(navigation, /max-w-md sm:max-w-lg/);
  assert.match(topBar, /max-w-md sm:max-w-lg/);
  assert.match(app, /max-w-md sm:max-w-lg/);
  assert.doesNotMatch(app, /max-w-7xl|max-w-screen-xl|grid-cols-12/);
});

test('offline and rate-limit AI failures retain stable user-facing categories', () => {
  assert.equal(normalizeApiException(new TypeError('offline')).kind, 'network');
  assert.equal(classifyApiFailure(429, null), 'rate_limited');
  assert.equal(classifyApiFailure(429, 'AI_RATE_LIMITED'), 'rate_limited');
});

test('large-ledger statistics and local analysis remain functional', () => {
  const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'];
  const expenses: Expense[] = Array.from({ length: 12000 }, (_, index) => {
    const monthOffset = index % 21;
    const year = 2025 + Math.floor(monthOffset / 12);
    const monthIndex = monthOffset % 12;
    return {
      id: index + 1,
      amount: (index % 250) + 1.25,
      description: `Ledger item ${index + 1}`,
      category: categories[index % categories.length],
      date: new Date(year, monthIndex, (index % 28) + 1, 12, 0, 0, 0).getTime(),
      note: null,
      createdAt: 1_735_689_600_000 + index,
    };
  });

  const started = Date.now();
  const stats = StatisticsEngine.calculateStatistics(
    expenses,
    [],
    'ALL_TIME',
    { year: 2026, month: 9 }
  );
  const summary = new SpendingAnalyzer().computeHistoricalSummary(expenses, { year: 2026, month: 9 });
  const elapsed = Date.now() - started;

  assert.equal(stats.totalTransactions, 12000);
  assert.equal(stats.categoryPercentages.length, categories.length);
  assert.ok(summary.totalMonthsRecorded >= 20);
  assert.ok(summary.currentMonthExpenses.length > 0);
  assert.ok(elapsed < 6000, `large-ledger regression took ${elapsed}ms`);
});

test('freeze document explicitly prevents roadmap creep after WP16', () => {
  assert.match(freeze, /Four primary destinations/);
  assert.match(freeze, /No social\/accounts system/);
  assert.match(freeze, /After WP16 acceptance/);
});
