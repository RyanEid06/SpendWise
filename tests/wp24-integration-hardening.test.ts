import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Expense, MonthlySpendingStat } from '../src/types';
import { currentMonthYear, previousMonth } from '../src/utils/date';
import { StatisticsEngine } from '../src/utils/statisticsEngine';
import { rankLargestExpensesByMonth } from '../src/utils/statisticsRanking';
import { t } from '../src/utils/translations';
import {
  ExpenseDeleteUndoController,
  UNDO_DELETE_WINDOW_MS,
} from '../src/utils/undoDeleteBatch';

const read = (path: string) => readFileSync(path, 'utf8');

const appShell = read('src/app/AppShell.tsx');
const deleteUndo = read('src/app/hooks/useExpenseDeleteUndo.ts');
const androidBack = read('src/app/navigation/useAndroidBack.ts');
const navigation = read('src/components/Navigation.tsx');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const topBar = read('src/components/AppTopBar.tsx');
const history = read('src/screens/HistoryScreen.tsx');
const swipeable = read('src/components/SwipeableExpenseCard.tsx');
const detail = read('src/components/ExpenseDetailModal.tsx');
const statistics = read('src/screens/StatisticsScreen.tsx');
const categoryHome = read('src/components/CategoryBreakdownSection.tsx');
const categoryStatistics = read('src/components/CategoryStatisticsSection.tsx');
const settings = read('src/screens/SettingsScreen.tsx');
const workflow = read('.github/workflows/android-build.yml');
const packageJson = JSON.parse(read('package.json')) as { version: string; scripts: Record<string, string> };
const versionJson = JSON.parse(read('version.json')) as { versionName: string; versionCode: number };

const makeExpense = (
  id: number,
  amount: number,
  year: number,
  month: number,
  description = 'Expense',
): Expense => {
  const date = new Date(year, month - 1, 15, 12).getTime();
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

const makeMonth = (monthKey: string, amount: number, id: number): MonthlySpendingStat => ({
  monthKey,
  monthDisplayName: monthKey,
  totalSpent: amount,
  startingBudget: 0,
  isBudgetSet: false,
  remainingMoney: 0,
  transactionCount: 1,
  isPartialMonth: false,
  largestExpense: makeExpense(
    id,
    amount,
    Number(monthKey.slice(0, 4)),
    Number(monthKey.slice(5, 7)),
    'Monthly expense ' + id,
  ),
});

test('WP24 preserves canonical launcher identity and exactly four primary destinations', () => {
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  assert.match(topBar, /src="\/spendwise-original-icon\.png"/);

  for (const screen of ['home', 'history', 'insights', 'statistics']) {
    assert.match(navigation, new RegExp("screen: '" + screen + "'"));
  }
  assert.equal((navigation.match(/screen: '/g) || []).length, 4);
  assert.doesNotMatch(navigation, /screen: 'settings'/);
});

test('WP24 keeps History delete swipe-first, accessible, staged, and non-duplicated', () => {
  assert.match(history, /<SwipeableExpenseCard/);
  assert.doesNotMatch(history, /<ConfirmationModal|expenseToDelete/);
  assert.match(swipeable, /className="sr-only/);
  assert.match(swipeable, /wp17Copy\(language, 'deleteAction'\)/);
  assert.doesNotMatch(detail, /Trash2|onDelete|deleteAction/);

  const stageDeleteStart = deleteUndo.indexOf('const stageDelete');
  const stageDeleteEnd = deleteUndo.indexOf('useEffect', stageDeleteStart);
  assert.ok(stageDeleteStart >= 0 && stageDeleteEnd > stageDeleteStart);
  const stageDelete = deleteUndo.slice(stageDeleteStart, stageDeleteEnd);
  assert.match(stageDelete, /controllerRef\.current\?\.stage/);
  assert.doesNotMatch(stageDelete, /StorageManager\.deleteExpenses/);
  assert.match(deleteUndo, /onCommit: async \(entries\) => \{[\s\S]*StorageManager\.deleteExpenses/);
});

test('WP24 staged deletion does not commit before the 5-second expiry and rapid deletes share one batch', () => {
  let scheduled: (() => void) | null = null;
  let scheduledDelay = 0;
  let committedIds: number[] = [];
  const snapshots: number[] = [];

  const controller = new ExpenseDeleteUndoController({
    onBatchChange: (snapshot) => snapshots.push(snapshot?.count ?? 0),
    onCommit: (entries) => {
      committedIds = entries.map((entry) => entry.expense.id);
    },
    schedule: (callback, delayMs) => {
      scheduled = callback;
      scheduledDelay = delayMs;
      return { callback };
    },
    cancel: () => {
      scheduled = null;
    },
  });

  assert.equal(controller.stage(makeExpense(1, 10, 2026, 8), 0), true);
  assert.equal(controller.stage(makeExpense(2, 20, 2026, 8), 0), true);
  assert.equal(scheduledDelay, UNDO_DELETE_WINDOW_MS);
  assert.equal(UNDO_DELETE_WINDOW_MS, 5_000);
  assert.deepEqual(committedIds, []);
  assert.deepEqual(controller.getPendingExpenseIds(), [1, 2]);
  assert.ok(snapshots.includes(2));

  const fire = scheduled;
  assert.ok(fire);
  fire();

  assert.deepEqual(committedIds, [1, 2]);
  assert.deepEqual(controller.getPendingExpenseIds(), []);
});

test('WP24 keeps every modal or preview surface rooted through ViewportPortal', () => {
  const portalFiles = [
    'src/components/ConfirmationModal.tsx',
    'src/components/ExpenseDetailModal.tsx',
    'src/components/UndoSnackbar.tsx',
    'src/components/AddEditExpenseModal.tsx',
    'src/components/SetBudgetModal.tsx',
    'src/components/ImportPreviewModal.tsx',
    'src/components/BackupV2ImportModal.tsx',
    'src/components/CurrencyConversionModal.tsx',
    'src/components/ExpenseAttachmentsEditor.tsx',
    'src/screens/MediaLibraryScreen.tsx',
  ];

  for (const path of portalFiles) {
    const source = read(path);
    assert.match(source, /ViewportPortal/, path + ' must use the viewport portal');
  }

  const css = read('src/index.css');
  const screenEntry = css.slice(css.indexOf('@keyframes fadeIn'), css.indexOf('@keyframes pulseSubtle'));
  assert.doesNotMatch(screenEntry, /transform|translateY|forwards/);
});

test('WP24 preserves Statistics density, terminology, shared category base, and trend semantics', () => {
  assert.match(statistics, /data-statistics-summary-grid="2x2"/);
  assert.equal((statistics.match(/data-stat-summary-cell="true"/g) || []).length, 4);
  assert.equal(t('en', 'txnsLabel'), 'transactions');
  assert.equal(t('fr', 'txnsLabel'), 'transactions');
  assert.equal(t('ar', 'txnsLabel'), 'معاملات');
  assert.doesNotMatch(statistics, />\s*txns\s*</i);

  assert.match(categoryHome, /CategorySpendRow/);
  assert.match(categoryStatistics, /CategorySpendRow/);
  assert.match(categoryStatistics, /data-trend-state=\{trendState\}/);
  assert.match(categoryStatistics, /aria-expanded=\{isExpanded\}/);

  const now = currentMonthYear();
  const prior = previousMonth(now);
  const twoBack = previousMonth(prior);
  const trend = StatisticsEngine.calculateStatistics(
    [
      makeExpense(10, 100, twoBack.year, twoBack.month),
      makeExpense(11, 150, prior.year, prior.month),
      makeExpense(12, 1, now.year, now.month),
    ],
    [],
    'LAST_3_MONTHS',
    now,
  ).categoryTrends[0];

  assert.equal(trend?.hasComparableHistory, true);
  assert.equal(trend?.trendDirection, 'UP');
  assert.equal(Math.round(trend?.trendPercent ?? 0), 50);
});

test('WP24 keeps Largest Expense by Month amount-ranked with deterministic hierarchy', () => {
  const ranked = rankLargestExpensesByMonth([
    makeMonth('2026-01', 500, 1),
    makeMonth('2026-02', 900, 2),
    makeMonth('2026-03', 500, 3),
    makeMonth('2026-04', 100, 4),
  ]);

  assert.deepEqual(ranked.map((entry) => entry.expense.amount), [900, 500, 500, 100]);
  assert.deepEqual(ranked.map((entry) => entry.month.monthKey), ['2026-02', '2026-03', '2026-01', '2026-04']);
  assert.deepEqual(ranked.map((entry) => entry.rank), [1, 2, 3, 4]);
  for (const rank of [1, 2, 3]) {
    assert.match(statistics, new RegExp('rank === ' + rank));
  }
});

test('WP24 keeps Settings progressive disclosure and nested native Back hierarchy intact', () => {
  const order = [
    'label={copy.appearance}',
    'label={copy.language}',
    'label={copy.currency}',
    'label={copy.appLock}',
    'label={copy.storage}',
    'label={copy.backup}',
    'label={copy.reviewSetup}',
    'label={copy.terms}',
    'label={copy.privacy}',
    'label={copy.clearData}',
  ].map((marker) => {
    const index = settings.indexOf(marker);
    assert.ok(index >= 0, 'missing Settings marker: ' + marker);
    return index;
  });
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(order[index - 1] < order[index], 'Settings order regressed');
  }

  assert.match(settings, /data-settings-overview="compact"/);
  assert.match(settings, /data-inline-settings="appearance"/);
  assert.match(settings, /data-inline-settings="language"/);
  assert.match(settings, /data-inline-settings="currency"/);
  assert.match(settings, /type SettingsPage = 'overview' \| 'app-lock' \| 'storage-media' \| 'backup-restore'/);
  assert.match(settings, /data-native-back-layer=\{modalLayerOpen \? 'true' : undefined\}/);

  const backMarkers = [
    'state.attachmentViewerOpen',
    'state.nativeBackLayerOpen',
    'state.expenseEditorOpen',
    'state.budgetModalOpen',
    "state.currentScreen === 'settings'",
    "state.currentScreen !== 'home'",
  ].map((marker) => androidBack.indexOf(marker));
  for (const index of backMarkers) assert.ok(index >= 0, 'missing Back marker');
  for (let index = 1; index < backMarkers.length; index += 1) {
    assert.ok(backMarkers[index - 1] < backMarkers[index], 'native Back priority regressed');
  }
});

test('WP24 fixes recent EN/FR/AR localization leaks and keeps all three languages represented', () => {
  for (const marker of ['en: {', 'fr: {', 'ar: {']) {
    assert.match(settings, new RegExp(marker.replace('{', '\\{')));
  }

  for (const forbidden of [
    "setErrorMessage('Export failed.')",
    "setErrorMessage('Backup v2 export failed.')",
    "setErrorMessage('CSV Export failed.')",
    "setErrorMessage('Invalid or unsupported backup file.')",
    'aria-label="Dismiss message"',
    'aria-label="Dismiss error"',
  ]) {
    assert.equal(settings.includes(forbidden), false, 'hard-coded Settings English regressed: ' + forbidden);
  }

  assert.match(settings, /copy\.exportFailed/);
  assert.match(settings, /copy\.backupWarning/);
  assert.match(settings, /copy\.dismissMessage/);
  assert.match(settings, /copy\.dismissError/);

  const backupModal = read('src/components/BackupV2ImportModal.tsx');
  assert.match(backupModal, /text\.expenses/);
  assert.match(backupModal, /text\.budgets/);
  assert.match(backupModal, /text\.mode/);

  const media = read('src/screens/MediaLibraryScreen.tsx');
  assert.match(media, /text\.date/);
  assert.match(media, /shareTitle: text\.shareTitle/);
  assert.match(media, /aria-label=\{text\.back\}/);
  assert.match(media, /aria-label=\{text\.close\}/);
});

test('WP24 recent interactive surfaces honor the 48dp target floor', () => {
  const audited = [
    'src/screens/HistoryScreen.tsx',
    'src/screens/StatisticsScreen.tsx',
    'src/components/BudgetSummaryCards.tsx',
    'src/components/AddEditExpenseModal.tsx',
    'src/components/ExpenseAttachmentsEditor.tsx',
    'src/components/ImportPreviewModal.tsx',
    'src/components/CurrencyConversionModal.tsx',
    'src/components/SetBudgetModal.tsx',
    'src/components/BackupV2ImportModal.tsx',
    'src/screens/MediaLibraryScreen.tsx',
  ];

  for (const path of audited) {
    const source = read(path);
    assert.doesNotMatch(source, /min-h-\[(?:40|44|46)px\]/, path + ' has a sub-48px target');
    assert.doesNotMatch(source, /min-w-\[(?:40|44|46)px\]/, path + ' has a sub-48px target');
  }
});

test('WP24 approved release gate is promoted to v1.4.0 with aligned metadata', () => {
  assert.equal(packageJson.version, '1.4.0');
  assert.equal(versionJson.versionName, '1.4.0');
  assert.equal(versionJson.versionCode, 5);
  assert.equal(packageJson.scripts['test:wp24'], 'tsx --test tests/wp24-integration-hardening.test.ts');

  const release = read('RELEASE.md');
  assert.match(release, /"versionName": "1\.4\.0"/);
  assert.match(release, /"versionCode": 5/);
});
test('WP24 is wired into Android CI immediately after WP23', () => {
  const wp23 = workflow.indexOf('Run WP23 Settings regression tests');
  const wp24 = workflow.indexOf('Run WP24 integration hardening regression tests');
  const sync = workflow.indexOf('Sync Capacitor Android');
  assert.ok(wp23 >= 0 && wp24 > wp23 && sync > wp24);
  assert.match(workflow, /run: npm run test:wp24/);
});
