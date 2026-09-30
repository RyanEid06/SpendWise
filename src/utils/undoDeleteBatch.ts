import { Expense } from '../types';

export const UNDO_DELETE_WINDOW_MS = 5_000;

export interface PendingExpenseDelete {
  expense: Expense;
  originalIndex: number;
}

export interface ExpenseDeleteBatchSnapshot {
  count: number;
  expenseIds: number[];
}

type TimerHandle = unknown;

interface ExpenseDeleteUndoControllerOptions {
  onBatchChange: (snapshot: ExpenseDeleteBatchSnapshot | null) => void;
  onCommit: (entries: PendingExpenseDelete[]) => void | Promise<void>;
  onCommitError?: (entries: PendingExpenseDelete[], error: unknown) => void;
  timeoutMs?: number;
  schedule?: (callback: () => void, delayMs: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
}

export function restorePendingExpenses(current: Expense[], entries: PendingExpenseDelete[]): Expense[] {
  const next = [...current];
  const knownIds = new Set(next.map((expense) => expense.id));
  for (const entry of [...entries].sort((a, b) => a.originalIndex - b.originalIndex)) {
    if (knownIds.has(entry.expense.id)) continue;
    const insertAt = Math.max(0, Math.min(entry.originalIndex, next.length));
    next.splice(insertAt, 0, entry.expense);
    knownIds.add(entry.expense.id);
  }
  return next;
}

export class ExpenseDeleteUndoController {
  private entries: PendingExpenseDelete[] = [];
  private timer: TimerHandle | null = null;
  private readonly timeoutMs: number;
  private readonly schedule: (callback: () => void, delayMs: number) => TimerHandle;
  private readonly cancel: (handle: TimerHandle) => void;
  private readonly onBatchChange: ExpenseDeleteUndoControllerOptions['onBatchChange'];
  private readonly onCommit: ExpenseDeleteUndoControllerOptions['onCommit'];
  private readonly onCommitError?: ExpenseDeleteUndoControllerOptions['onCommitError'];

  constructor(options: ExpenseDeleteUndoControllerOptions) {
    this.timeoutMs = options.timeoutMs ?? UNDO_DELETE_WINDOW_MS;
    this.schedule = options.schedule ?? ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
    this.cancel = options.cancel ?? ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.onBatchChange = options.onBatchChange;
    this.onCommit = options.onCommit;
    this.onCommitError = options.onCommitError;
  }

  stage(expense: Expense, currentIndex: number): boolean {
    if (this.entries.some((entry) => entry.expense.id === expense.id)) return false;
    let originalIndex = Math.max(0, currentIndex);
    for (const entry of [...this.entries].sort((a, b) => a.originalIndex - b.originalIndex)) {
      if (entry.originalIndex <= originalIndex) originalIndex += 1;
    }
    this.entries.push({ expense, originalIndex });
    this.resetTimer();
    this.emit();
    return true;
  }

  undo(): PendingExpenseDelete[] {
    const entries = this.takePending();
    this.onBatchChange(null);
    return entries;
  }

  dispose(): PendingExpenseDelete[] {
    const entries = this.takePending();
    this.onBatchChange(null);
    return entries;
  }

  getPendingExpenseIds(): number[] {
    return this.entries.map((entry) => entry.expense.id);
  }

  private emit(): void {
    this.onBatchChange({ count: this.entries.length, expenseIds: this.getPendingExpenseIds() });
  }

  private resetTimer(): void {
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.commitCurrentBatch();
    }, this.timeoutMs);
  }

  private takePending(): PendingExpenseDelete[] {
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
    const entries = this.entries;
    this.entries = [];
    return entries;
  }

  private async commitCurrentBatch(): Promise<void> {
    const entries = this.takePending();
    if (entries.length === 0) return;
    this.onBatchChange(null);
    try {
      await this.onCommit(entries);
    } catch (error) {
      this.onCommitError?.(entries, error);
    }
  }
}
