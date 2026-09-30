import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Expense } from '../src/types';
import {
  ExpenseDeleteUndoController,
  restorePendingExpenses,
  UNDO_DELETE_WINDOW_MS,
} from '../src/utils/undoDeleteBatch';

const history = readFileSync('src/screens/HistoryScreen.tsx', 'utf8');
const card = readFileSync('src/components/ExpenseItemCard.tsx', 'utf8');
const swipe = readFileSync('src/components/SwipeableExpenseCard.tsx', 'utf8');
const detail = readFileSync('src/components/ExpenseDetailModal.tsx', 'utf8');
const appShell = readFileSync('src/app/AppShell.tsx', 'utf8');
const deleteUndo = readFileSync('src/app/hooks/useExpenseDeleteUndo.ts', 'utf8');
const androidBack = readFileSync('src/app/navigation/useAndroidBack.ts', 'utf8');
const css = readFileSync('src/index.css', 'utf8');
const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
const confirmation = readFileSync('src/components/ConfirmationModal.tsx', 'utf8');
const storage = readFileSync('src/utils/storage.ts', 'utf8');

const expense = (id: number): Expense => ({
  id,
  amount: 10 * id,
  description: `Expense ${id}`,
  category: 'Food',
  date: 1_780_000_000_000 + id,
  note: null,
  createdAt: 1_780_000_000_000 + id,
});

class FakeScheduler {
  now = 0;
  nextId = 1;
  tasks = new Map<number, { at: number; callback: () => void }>();

  schedule = (callback: () => void, delayMs: number): number => {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + delayMs, callback });
    return id;
  };

  cancel = (handle: unknown) => {
    this.tasks.delete(Number(handle));
  };

  advance(ms: number) {
    this.now += ms;
    const due = [...this.tasks.entries()]
      .filter(([, task]) => task.at <= this.now)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, task] of due) {
      this.tasks.delete(id);
      task.callback();
    }
  }
}

test('WP20 removes visible overflow deletion and keeps a nonvisual accessible delete action', () => {
  assert.doesNotMatch(card, /EllipsisVertical|role="menu"|role="menuitem"|onDeleteClick/);
  assert.match(swipe, /sr-only focus:not-sr-only/);
  assert.match(swipe, /requestDeleteOnce/);
  assert.match(swipe, /wp17Copy\(language, 'deleteAction'\)/);
});

test('swipe deletion is immediate and routine History confirmation is gone', () => {
  assert.match(history, /onRequestDelete=\{\(\) => onDeleteExpense\(expense\)\}/);
  assert.doesNotMatch(history, /ConfirmationModal|expenseToDelete|deleteExpenseTitle/);
  assert.match(swipe, /Math\.abs\(dy\) >= 8/);
  assert.match(swipe, /deleteRequestedRef/);
});

test('rapid deletes share one batch and reset the five-second timer', () => {
  assert.equal(UNDO_DELETE_WINDOW_MS, 5_000);
  const scheduler = new FakeScheduler();
  const snapshots: number[] = [];
  const commits: number[][] = [];
  const controller = new ExpenseDeleteUndoController({
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
    onBatchChange: (snapshot) => snapshots.push(snapshot?.count ?? 0),
    onCommit: (entries) => commits.push(entries.map((entry) => entry.expense.id)),
  });

  controller.stage(expense(1), 0);
  scheduler.advance(3_000);
  controller.stage(expense(2), 0);
  scheduler.advance(4_999);
  assert.deepEqual(commits, []);
  scheduler.advance(1);

  assert.deepEqual(commits, [[1, 2]]);
  assert.deepEqual(snapshots, [1, 2, 0]);
});

test('Undo restores the entire batch and prevents commit', () => {
  const scheduler = new FakeScheduler();
  const commits: number[][] = [];
  const controller = new ExpenseDeleteUndoController({
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
    onBatchChange: () => {},
    onCommit: (entries) => commits.push(entries.map((entry) => entry.expense.id)),
  });

  const original = [expense(1), expense(2), expense(3)];
  controller.stage(original[0], 0);
  controller.stage(original[1], 0);
  const restored = restorePendingExpenses([original[2]], controller.undo());
  scheduler.advance(10_000);

  assert.deepEqual(restored.map((item) => item.id), [1, 2, 3]);
  assert.deepEqual(commits, []);
});

test('dispose is conservative and never commits pending in-memory deletes', () => {
  const scheduler = new FakeScheduler();
  let committed = false;
  const controller = new ExpenseDeleteUndoController({
    schedule: scheduler.schedule,
    cancel: scheduler.cancel,
    onBatchChange: () => {},
    onCommit: () => { committed = true; },
  });
  controller.stage(expense(1), 0);
  assert.equal(controller.dispose().length, 1);
  scheduler.advance(10_000);
  assert.equal(committed, false);
});

test('attachment destruction only occurs after persistence commit', () => {
  assert.match(storage, /LocalDataStore\.deleteExpenses[\s\S]*AttachmentStorage\.deleteDetachedFiles/);
  assert.match(deleteUndo, /onCommit: async \(entries\)[\s\S]*StorageManager\.deleteExpenses/);
  const stageDelete = deleteUndo.slice(deleteUndo.indexOf('const stageDelete'), deleteUndo.indexOf('useEffect', deleteUndo.indexOf('const stageDelete')));
  assert.doesNotMatch(stageDelete, /deleteExpenses|deleteDetachedFiles/);
});

test('read-only detail includes full date/time and photos without edit/delete controls', () => {
  assert.match(detail, /dateStyle: 'full'/);
  assert.match(detail, /timeStyle: 'short'/);
  assert.match(detail, /AttachmentStorage\.getAttachmentsForExpense/);
  assert.match(detail, /attachments\.length/);
  assert.match(detail, /data-attachment-viewer="true"/);
  assert.doesNotMatch(detail, /onEdit|Edit2|Trash2|onDelete/);
});

test('screen entry animation no longer leaves a transformed containing block', () => {
  const animation = css.slice(css.indexOf('@keyframes fadeIn'), css.indexOf('@keyframes pulseSubtle'));
  assert.doesNotMatch(animation, /transform|translateY|forwards/);
  assert.match(confirmation, /ViewportPortal/);
  assert.match(detail, /ViewportPortal/);
});

test('destructive global confirmations remain and Android Back closes modal layers first', () => {
  assert.match(settings, /<ConfirmationModal/);
  assert.match(confirmation, /data-native-back-layer="true"/);
  assert.match(confirmation, /spendwise-native-back/);
  assert.match(androidBack, /document\.querySelector\('\[data-native-back-layer="true"\]'\)/);
  assert.match(appShell, /<UndoSnackbar/);
});
