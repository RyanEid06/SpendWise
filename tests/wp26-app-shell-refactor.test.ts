import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Expense, MonthlyBudget, PrimaryScreen } from '../src/types';
import {
  INITIAL_APP_NAVIGATION,
  PRIMARY_SCREENS,
  reduceAppNavigation,
} from '../src/app/navigation/useAppNavigation';
import {
  AndroidBackState,
  resolveAndroidBackAction,
} from '../src/app/navigation/useAndroidBack';
import {
  subscribeBrowserVisibility,
  VisibilityTarget,
} from '../src/app/lifecycle/useAppLifecycle';
import { shouldLockAfterTimeout } from '../src/app/hooks/useAppLockLifecycle';
import {
  directionForLanguage,
  resolveDarkMode,
} from '../src/app/hooks/useThemeLanguage';
import { AiRequestGate } from '../src/app/hooks/aiRequestGate';
import { selectMonthlyLedger } from '../src/app/selectors/monthlyLedger';

const read = (path: string) => readFileSync(path, 'utf8');

const makeExpense = (
  id: number,
  amount: number,
  year: number,
  month: number,
  category = 'Food'
): Expense => {
  const date = new Date(year, month - 1, 15, 12).getTime();
  return {
    id,
    amount,
    description: `Expense ${id}`,
    category,
    date,
    note: null,
    createdAt: date + id,
  };
};

test('WP26 navigation keeps exactly four primary destinations and Settings returns to its opener', () => {
  assert.deepEqual(PRIMARY_SCREENS, ['home', 'history', 'insights', 'statistics']);

  for (const primary of PRIMARY_SCREENS) {
    let state = reduceAppNavigation(INITIAL_APP_NAVIGATION, {
      type: 'select-primary',
      screen: primary,
    });
    state = reduceAppNavigation(state, { type: 'open-settings' });
    assert.equal(state.currentScreen, 'settings');
    assert.equal(state.settingsReturnScreen, primary);

    state = reduceAppNavigation(state, { type: 'close-settings' });
    assert.equal(state.currentScreen, primary);
    assert.equal(state.settingsReturnScreen, primary);
  }
});

test('WP26 Android Back resolver preserves the transient-to-exit priority hierarchy', () => {
  const base: AndroidBackState = {
    attachmentViewerOpen: false,
    nativeBackLayerOpen: false,
    expenseEditorOpen: false,
    budgetModalOpen: false,
    currentScreen: 'home',
  };

  assert.equal(
    resolveAndroidBackAction({ ...base, attachmentViewerOpen: true, nativeBackLayerOpen: true }),
    'close-attachment-viewer'
  );
  assert.equal(
    resolveAndroidBackAction({ ...base, nativeBackLayerOpen: true, expenseEditorOpen: true }),
    'close-native-layer'
  );
  assert.equal(
    resolveAndroidBackAction({ ...base, expenseEditorOpen: true, budgetModalOpen: true }),
    'close-expense-editor'
  );
  assert.equal(
    resolveAndroidBackAction({ ...base, budgetModalOpen: true, currentScreen: 'settings' }),
    'close-budget'
  );
  assert.equal(
    resolveAndroidBackAction({ ...base, currentScreen: 'settings' }),
    'close-settings'
  );
  assert.equal(
    resolveAndroidBackAction({ ...base, currentScreen: 'history' }),
    'go-home'
  );
  assert.equal(resolveAndroidBackAction(base), 'exit-app');
});

test('WP26 browser lifecycle publishes background/foreground and removes its listener cleanly', () => {
  class FakeVisibilityTarget implements VisibilityTarget {
    hidden = false;
    listeners = new Set<() => void>();

    addEventListener(_type: 'visibilitychange', listener: () => void) {
      this.listeners.add(listener);
    }

    removeEventListener(_type: 'visibilitychange', listener: () => void) {
      this.listeners.delete(listener);
    }

    emit() {
      for (const listener of [...this.listeners]) listener();
    }
  }

  const target = new FakeVisibilityTarget();
  const events: string[] = [];
  const cleanup = subscribeBrowserVisibility(target, {
    onBackground: () => events.push('background'),
    onForeground: () => events.push('foreground'),
  });

  target.hidden = true;
  target.emit();
  target.hidden = false;
  target.emit();
  assert.deepEqual(events, ['background', 'foreground']);
  assert.equal(target.listeners.size, 1);

  cleanup();
  assert.equal(target.listeners.size, 0);
  target.hidden = true;
  target.emit();
  assert.deepEqual(events, ['background', 'foreground']);
});

test('WP26 App Lock timeout seam preserves before/after timeout behavior', () => {
  assert.equal(shouldLockAfterTimeout(0, 20_000, 5), false);
  assert.equal(shouldLockAfterTimeout(10_000, 14_999, 5), false);
  assert.equal(shouldLockAfterTimeout(10_000, 15_000, 5), true);
  assert.equal(shouldLockAfterTimeout(10_000, 25_000, 15), true);
});

test('WP26 theme and direction decisions remain deterministic for Light/Dark/System and EN/FR/AR', () => {
  assert.equal(resolveDarkMode('DARK', false), true);
  assert.equal(resolveDarkMode('LIGHT', true), false);
  assert.equal(resolveDarkMode('SYSTEM', true), true);
  assert.equal(resolveDarkMode('SYSTEM', false), false);

  assert.equal(directionForLanguage('ar'), 'rtl');
  assert.equal(directionForLanguage('en'), 'ltr');
  assert.equal(directionForLanguage('fr'), 'ltr');
});

test('WP26 monthly selector preserves current-month totals, ranking, budget, and category projection', () => {
  const expenses = [
    makeExpense(1, 50, 2026, 9, 'Food'),
    makeExpense(2, 100, 2026, 9, 'Travel'),
    makeExpense(3, 25, 2026, 9, 'Food'),
    makeExpense(4, 999, 2026, 8, 'Other'),
  ];
  const budgets: MonthlyBudget[] = [
    { monthKey: '2026-09', startingAmount: 500, updatedAt: 1 },
  ];

  const selection = selectMonthlyLedger(expenses, budgets, { year: 2026, month: 9 });
  assert.deepEqual(selection.monthlyExpenses.map((expense) => expense.id), [1, 2, 3]);
  assert.equal(selection.startingMoney, 500);
  assert.equal(selection.totalSpent, 175);
  assert.equal(selection.remainingMoney, 325);
  assert.equal(selection.progress, 0.35);
  assert.deepEqual(selection.topExpenses.map((expense) => expense.id), [2, 1, 3]);
  assert.equal(selection.categoryBreakdown[0]?.categoryName, 'Travel');
  assert.equal(selection.categoryBreakdown[0]?.amount, 100);
  assert.equal(selection.categoryBreakdown[1]?.categoryName, 'Food');
  assert.equal(selection.categoryBreakdown[1]?.amount, 75);
});

test('WP26 AI request gate rejects stale generations and permits a new request after invalidation', () => {
  const gate = new AiRequestGate();
  const first = gate.begin();
  assert.ok(first !== null);
  assert.equal(gate.begin(), null);

  gate.invalidate();
  const second = gate.begin();
  assert.ok(second !== null);
  assert.notEqual(first, second);
  assert.equal(gate.isCurrent(first as number), false);
  assert.equal(gate.isCurrent(second as number), true);
  assert.equal(gate.finish(first as number), false);
  assert.equal(gate.finish(second as number), true);

  const third = gate.begin();
  assert.ok(third !== null);
  assert.notEqual(third, second);
});

test('WP26 shell is composition-only and orchestration moved behind focused seams', () => {
  const appEntry = read('src/App.tsx').trim();
  const shell = read('src/app/AppShell.tsx');
  const ledger = read('src/app/hooks/useExpenseLedger.ts');
  const deleteUndo = read('src/app/hooks/useExpenseDeleteUndo.ts');
  const lifecycle = read('src/app/lifecycle/useAppLifecycle.ts');
  const themeLanguage = read('src/app/hooks/useThemeLanguage.ts');

  assert.equal(appEntry, "export { AppShell as App } from './app/AppShell';");

  for (const required of [
    'useAppNavigation()',
    'useAndroidBack({',
    'useExpenseLedger()',
    'useExpenseDeleteUndo({',
    'useAiAnalysis({',
    'useAppLockLifecycle({',
    'selectMonthlyLedger(',
  ]) {
    assert.ok(shell.includes(required), `missing AppShell seam: ${required}`);
  }

  for (const forbidden of [
    'StorageManager',
    'CapacitorApp',
    'apiFetchJson',
    'SpendingAnalyzer',
    'getStartOfMonthTimestamp',
    'getEndOfMonthTimestamp',
  ]) {
    assert.equal(shell.includes(forbidden), false, `AppShell still implements ${forbidden}`);
  }

  assert.match(shell, /onBackground: deleteUndo\.undoPending/);
  assert.match(lifecycle, /handle\.remove\(\)/);
  assert.match(themeLanguage, /removeEventListener\('change', applyTheme\)/);

  assert.match(ledger, /StorageManager\.addExpense[\s\S]*refreshExpenses/);
  assert.match(ledger, /StorageManager\.updateExpense[\s\S]*refreshExpenses/);
  assert.match(ledger, /StorageManager\.convertCurrency[\s\S]*refreshFromStorage/);

  assert.match(deleteUndo, /onCommit: async \(entries\)[\s\S]*StorageManager\.deleteExpenses/);
  const stageStart = deleteUndo.indexOf('const stageDelete');
  const stageEnd = deleteUndo.indexOf('useEffect', stageStart);
  const stageSource = deleteUndo.slice(stageStart, stageEnd);
  assert.doesNotMatch(stageSource, /deleteExpenses|deleteDetachedFiles/);
});

test('WP26 does not introduce later hardening behavior or version changes', () => {
  const packageJson = JSON.parse(read('package.json')) as { version: string };
  const versionJson = JSON.parse(read('version.json')) as { versionName: string; versionCode: number };
  const appLock = read('src/app/hooks/useAppLockLifecycle.ts');

  assert.equal(packageJson.version, '1.4.0');
  assert.equal(versionJson.versionName, '1.4.0');
  assert.equal(versionJson.versionCode, 5);

  for (const forbidden of [
    'BiometricPrompt',
    'Keystore',
    'SecureKeyService',
    'SQLCipher',
    'Privacy Shield',
    'Argon2',
    'AES-GCM',
  ]) {
    assert.equal(appLock.includes(forbidden), false, `WP28+ behavior leaked into WP26: ${forbidden}`);
  }
});
