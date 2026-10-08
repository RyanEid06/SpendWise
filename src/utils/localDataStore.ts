import { Capacitor } from '@capacitor/core';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Expense, ExpenseAttachment, MonthlyBudget } from '../types';
import { normalizeCategoryName } from './categories';
import { applySpendWiseSchema } from '../data/databaseSchema';
import { nativeEncryptedDatabaseService } from '../data/NativeEncryptedDatabaseService';
import { diagnostics, measureDiagnostic } from '../services/diagnostics/diagnostics';
import { type DraftWrite, type StoredExpenseDraft, NATIVE_EXPENSE_DRAFT_KEY, WEB_EXPENSE_DRAFT_KEY, validateStoredDraft } from '../data/ExpenseDraft';
import { clearWebDraft, decryptWebDraft, encryptWebDraft } from '../data/WebEncryptedDraft';
import {
  cloneFinancialState,
  FinancialState,
  financialStatesEqual,
  KeyValueStore,
  LEGACY_FINANCIAL_KEYS,
  persistWebFinancialState,
  readLegacyFinancialState,
  recoverWebFinancialTransaction,
  validateFinancialState,
} from './financialState';

const LEGACY_MIGRATION_KEY = 'legacy_localstorage_migration_v1';
const LEGACY_MIGRATION_LOCAL_FLAG = 'spendwise_sqlite_migration_v1_complete';
const LEDGER_CURRENCY_KEY = 'ledger_currency';

function clearLegacyFinancialSnapshot(storage: KeyValueStore): void {
  const keys = [
    LEGACY_FINANCIAL_KEYS.EXPENSES,
    LEGACY_FINANCIAL_KEYS.BUDGETS,
    LEGACY_FINANCIAL_KEYS.ATTACHMENTS,
    LEGACY_FINANCIAL_KEYS.CURRENCY,
    LEGACY_FINANCIAL_KEYS.WEB_TXN,
  ];

  try {
    for (const key of keys) storage.removeItem(key);
    for (const key of keys) {
      if (storage.getItem(key) !== null) {
        throw new Error('LEGACY_FINANCIAL_CLEANUP_INCOMPLETE');
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'LEGACY_FINANCIAL_CLEANUP_INCOMPLETE'
    ) {
      throw error;
    }
    throw new Error('LEGACY_FINANCIAL_CLEANUP_FAILED');
  }
}

function emptyState(): FinancialState {
  return { expenses: [], budgets: [], attachments: [], currencyCode: 'USD' };
}

function rowNumber(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new Error(`DATABASE_INVALID_${key}`);
  return value;
}

function rowString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`DATABASE_INVALID_${key}`);
  return value;
}

export class LocalDataStoreImpl {
  private initialized = false;
  private native = false;
  private db: SQLiteDBConnection | null = null;
  private storage: KeyValueStore | null = null;
  private state: FinancialState = emptyState();
  private writeQueue: Promise<void> = Promise.resolve();
  private expenseDraft: StoredExpenseDraft | null = null;
  private webDraftMedia: Record<string, string> = {};
  private draftMediaIds = new Set<string>();
  private draftReadError: unknown = null;

  async init(storage: KeyValueStore): Promise<void> {
    if (this.initialized) return;
    this.storage = storage;
    this.native = Capacitor.getPlatform() === 'android';
    diagnostics.setState({ platform: this.native ? 'android' : 'web', databaseOpen: false, databaseEncrypted: false });

    if (!this.native) {
      this.state = await measureDiagnostic('storage.init', async () => {
        recoverWebFinancialTransaction(storage);
        return readLegacyFinancialState(storage);
      });
      await this.loadExpenseDraft();
      this.initialized = true;
      diagnostics.setState({ databaseOpen: true });
      return;
    }

    this.db = await measureDiagnostic('storage.open', () => nativeEncryptedDatabaseService.open(storage));
    await measureDiagnostic('storage.schema', () => this.applySchemaMigrations());
    await measureDiagnostic('storage.migration', () => this.migrateLegacyLocalStorage(storage));
    this.state = await measureDiagnostic('storage.read', () => this.loadNativeState());
    await this.loadExpenseDraft();
    await measureDiagnostic('storage.migration', () => nativeEncryptedDatabaseService.finalizePlaintextSourceCleanup(storage));
    this.initialized = true;
    diagnostics.setState({ databaseOpen: true, databaseEncrypted: true });
  }

  isNativeSqlite(): boolean {
    return this.native;
  }

  getExpenses(): Expense[] {
    this.requireInitialized();
    return this.state.expenses.map((item) => ({ ...item, category: normalizeCategoryName(item.category) }));
  }

  getBudgets(): MonthlyBudget[] {
    this.requireInitialized();
    return this.state.budgets.map((item) => ({ ...item }));
  }

  getAttachments(): ExpenseAttachment[] {
    this.requireInitialized();
    return this.state.attachments.map((item) => ({ ...item }));
  }

  getCurrencyCode(): string {
    this.requireInitialized();
    return this.state.currencyCode;
  }

  nextExpenseId(): number {
    this.requireInitialized();
    return this.state.expenses.reduce((max, expense) => Math.max(max, expense.id), 0) + 1;
  }

  getExpenseDraft(): StoredExpenseDraft | null {
    this.requireInitialized();
    return this.expenseDraft ? structuredClone(this.expenseDraft) : null;
  }

  async readExpenseDraftMedia(): Promise<Record<string, string>> {
    this.requireInitialized();
    // Reads wait for outstanding writes, so unlock never sees half of a snapshot.
    await this.writeQueue;
    if (this.draftReadError) {
      await this.loadExpenseDraft();
      if (this.draftReadError) throw this.draftReadError;
    }
    if (!this.native) return { ...this.webDraftMedia };
    const rows = await this.requireDb().query('SELECT id, data FROM expense_draft_media');
    return Object.fromEntries((rows.values ?? []).map(row => [rowString(row, 'id'), rowString(row, 'data')]));
  }

  async writeExpenseDraft(input: DraftWrite): Promise<void> {
    await this.enqueueWrite(async () => {
      if (this.draftReadError) throw this.draftReadError;
      const draft = validateStoredDraft(input.draft);
      if (this.expenseDraft && this.expenseDraft.id !== draft.id) throw new Error('EXPENSE_DRAFT_CONFLICT');
      if (this.native) {
        await this.withNativeTransaction(async db => {
          for (const photo of draft.photos) {
            if (this.draftMediaIds.has(photo.id)) continue;
            if (!input.media[photo.id]) throw new Error('EXPENSE_DRAFT_MEDIA_MISSING');
            await db.run('INSERT INTO expense_draft_media(id, data) VALUES(?, ?)', [photo.id, input.media[photo.id]], false);
          }
          const ids = draft.photos.map(p => p.id);
          await db.run(ids.length ? `DELETE FROM expense_draft_media WHERE id NOT IN (${ids.map(() => '?').join(',')})` : 'DELETE FROM expense_draft_media', ids, false);
          await this.setMeta(db, NATIVE_EXPENSE_DRAFT_KEY, JSON.stringify(draft));
        });
      } else {
        const encrypted = await encryptWebDraft(input);
        this.storage!.setItem(WEB_EXPENSE_DRAFT_KEY, encrypted);
        this.webDraftMedia = { ...input.media };
      }
      this.expenseDraft = structuredClone(draft);
      this.draftMediaIds = new Set(draft.photos.map(p => p.id));
    });
  }

  async discardExpenseDraft(id?: string): Promise<void> {
    await this.enqueueWrite(async () => {
      if (!this.draftReadError && (!id || this.expenseDraft?.id !== id)) return;
      if (this.native) await this.withNativeTransaction(db => this.deleteDraftRows(db));
      else this.storage!.removeItem(WEB_EXPENSE_DRAFT_KEY);
      await this.forgetDraft();
    });
  }

  private async deleteDraftRows(db: SQLiteDBConnection): Promise<void> {
    await db.run('DELETE FROM app_meta WHERE key = ?', [NATIVE_EXPENSE_DRAFT_KEY], false);
    await db.run('DELETE FROM expense_draft_media', [], false);
  }

  private async forgetDraft(): Promise<void> {
    this.draftReadError = null;
    this.expenseDraft = null;
    this.webDraftMedia = {};
    this.draftMediaIds.clear();
    if (!this.native) await clearWebDraft().catch(() => undefined);
  }

  private async loadExpenseDraft(): Promise<void> {
    try {
      const raw = this.native ? await this.getMeta(this.requireDb(), NATIVE_EXPENSE_DRAFT_KEY) : this.storage!.getItem(WEB_EXPENSE_DRAFT_KEY);
      if (!raw) { await this.forgetDraft(); return; }
      if (this.native) this.expenseDraft = validateStoredDraft(JSON.parse(raw));
      else {
        const saved = await decryptWebDraft(raw) as DraftWrite;
        this.expenseDraft = validateStoredDraft(saved.draft);
        this.webDraftMedia = saved.media;
      }
      this.draftMediaIds = new Set(this.expenseDraft.photos.map(p => p.id));
      this.draftReadError = null;
    } catch (error) {
      // Preserve opaque bytes for authenticated Retry/Discard; a broken draft
      // must not block an independently validated financial ledger at startup.
      this.draftReadError = error;
    }
  }

  private assertSavingDraft(id?: string): boolean {
    if (!id) return false;
    if (this.expenseDraft?.id !== id) throw new Error('EXPENSE_DRAFT_CONFLICT');
    return true;
  }

  async createExpenseWithAttachments(expense: Expense, attachments: ExpenseAttachment[], draftId?: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const clearDraft = this.assertSavingDraft(draftId);
      const next = cloneFinancialState(this.state);
      if (next.expenses.some((item) => item.id === expense.id)) throw new Error('EXPENSE_ID_EXISTS');
      next.expenses.unshift({ ...expense });
      next.attachments.push(...attachments.map((item) => ({ ...item })));
      validateFinancialState(next);

      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          await this.insertExpense(db, expense);
          for (const attachment of attachments) await this.insertAttachment(db, attachment);
          if (clearDraft) await this.deleteDraftRows(db);
        });
      } else {
        this.persistWeb(next, clearDraft);
      }
      if (clearDraft) await this.forgetDraft();
      this.state = next;
    });
  }

  async updateExpenseWithAttachments(expense: Expense, attachments: ExpenseAttachment[], draftId?: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const clearDraft = this.assertSavingDraft(draftId);
      const next = cloneFinancialState(this.state);
      const index = next.expenses.findIndex((item) => item.id === expense.id);
      if (index < 0) throw new Error('EXPENSE_NOT_FOUND');
      next.expenses[index] = { ...expense };
      next.attachments = next.attachments
        .filter((item) => item.expenseId !== expense.id)
        .concat(attachments.map((item) => ({ ...item })));
      validateFinancialState(next);

      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          await db.run(
            `UPDATE expenses
             SET amount = ?, description = ?, category = ?, transaction_date = ?, note = ?, created_at = ?
             WHERE id = ?`,
            [expense.amount, expense.description, expense.category, expense.date, expense.note ?? null, expense.createdAt, expense.id],
            false
          );
          await db.run('DELETE FROM expense_attachments WHERE expense_id = ?', [expense.id], false);
          for (const attachment of attachments) await this.insertAttachment(db, attachment);
          if (clearDraft) await this.deleteDraftRows(db);
        });
      } else {
        this.persistWeb(next, clearDraft);
      }
      if (clearDraft) await this.forgetDraft();
      this.state = next;
    });
  }

  async deleteExpenses(ids: number[]): Promise<ExpenseAttachment[]> {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueIds.length === 0) return [];

    return this.enqueueWrite(async () => {
      const idSet = new Set(uniqueIds);
      const clearDraft = this.expenseDraft?.expenseId != null && idSet.has(this.expenseDraft.expenseId);
      const detached = this.state.attachments
        .filter((item) => idSet.has(item.expenseId))
        .map((item) => ({ ...item }));
      const next = cloneFinancialState(this.state);
      next.expenses = next.expenses.filter((item) => !idSet.has(item.id));
      next.attachments = next.attachments.filter((item) => !idSet.has(item.expenseId));
      validateFinancialState(next);

      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          const placeholders = uniqueIds.map(() => '?').join(', ');
          await db.run(`DELETE FROM expenses WHERE id IN (${placeholders})`, uniqueIds, false);
          if (clearDraft) await this.deleteDraftRows(db);
        });
      } else {
        this.persistWeb(next, clearDraft);
      }
      if (clearDraft) await this.forgetDraft();
      this.state = next;
      return detached;
    });
  }

  async deleteExpense(id: number): Promise<ExpenseAttachment[]> {
    return this.deleteExpenses([id]);
  }

  async upsertBudget(monthKey: string, startingAmount: number, updatedAt: number): Promise<void> {
    await this.enqueueWrite(async () => {
      const next = cloneFinancialState(this.state);
      const budget = { monthKey, startingAmount, updatedAt };
      const index = next.budgets.findIndex((item) => item.monthKey === monthKey);
      if (index >= 0) next.budgets[index] = budget;
      else next.budgets.push(budget);
      validateFinancialState(next);

      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          await db.run(
            `INSERT INTO monthly_budgets(month_key, starting_amount, updated_at)
             VALUES(?, ?, ?)
             ON CONFLICT(month_key) DO UPDATE SET starting_amount = excluded.starting_amount, updated_at = excluded.updated_at`,
            [monthKey, startingAmount, updatedAt],
            false
          );
        });
      } else {
        this.persistWeb(next);
      }
      this.state = next;
    });
  }

  async setCurrencyCode(currencyCode: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const next = cloneFinancialState(this.state);
      next.currencyCode = currencyCode.toUpperCase();
      validateFinancialState(next);
      if (this.native) {
        await this.withNativeTransaction((db) => this.setMeta(db, LEDGER_CURRENCY_KEY, next.currencyCode));
      } else {
        this.persistWeb(next);
      }
      this.state = next;
    });
  }

  async replaceLedgerAmountsAndCurrency(
    expenses: Expense[],
    budgets: MonthlyBudget[],
    currencyCode: string
  ): Promise<void> {
    const next = cloneFinancialState(this.state);
    next.expenses = expenses.map((item) => ({ ...item }));
    next.budgets = budgets.map((item) => ({ ...item }));
    next.currencyCode = currencyCode.toUpperCase();
    await this.replaceState(next);
  }

  async replaceState(input: FinancialState): Promise<void> {
    await this.enqueueWrite(async () => {
      const next = validateFinancialState(cloneFinancialState(input));
      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          await db.run('DELETE FROM expense_attachments', [], false);
          await db.run('DELETE FROM expenses', [], false);
          await db.run('DELETE FROM monthly_budgets', [], false);
          for (const expense of next.expenses) await this.insertExpense(db, expense);
          for (const budget of next.budgets) await this.insertBudget(db, budget);
          for (const attachment of next.attachments) await this.insertAttachment(db, attachment);
          await this.setMeta(db, LEDGER_CURRENCY_KEY, next.currencyCode);
        });
      } else {
        this.persistWeb(next);
      }
      this.state = next;
    });
  }

  async clearFinancialData(): Promise<ExpenseAttachment[]> {
    return this.enqueueWrite(async () => {
      const detached = this.state.attachments.map((item) => ({ ...item }));
      const next: FinancialState = {
        expenses: [],
        budgets: [],
        attachments: [],
        currencyCode: this.state.currencyCode,
      };
      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          await db.run('DELETE FROM expense_attachments', [], false);
          await db.run('DELETE FROM expenses', [], false);
          await db.run('DELETE FROM monthly_budgets', [], false);
          await this.deleteDraftRows(db);
        });
      } else {
        this.persistWeb(next, true);
      }
      await this.forgetDraft();
      this.state = next;
      return detached;
    });
  }

  snapshot(): FinancialState {
    this.requireInitialized();
    return cloneFinancialState(this.state);
  }

  private requireInitialized(): void {
    if (!this.initialized) throw new Error('LOCAL_DATA_STORE_NOT_INITIALIZED');
  }

  private persistWeb(state: FinancialState, clearDraft = false): void {
    if (!this.storage) throw new Error('WEB_STORAGE_UNAVAILABLE');
    persistWebFinancialState(this.storage, state, clearDraft);
  }

  private enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const task = this.writeQueue.then(work, work);
    this.writeQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async applySchemaMigrations(): Promise<void> {
    await applySpendWiseSchema(this.requireDb());
  }

  private async migrateLegacyLocalStorage(storage: KeyValueStore): Promise<void> {
    const db = this.requireDb();
    const marker = await this.getMeta(db, LEGACY_MIGRATION_KEY);
    if (marker === 'complete') {
      try { storage.setItem(LEGACY_MIGRATION_LOCAL_FLAG, 'complete'); } catch {}
      clearLegacyFinancialSnapshot(storage);
      return;
    }

    const databaseState = await this.loadNativeState(true);
    const hasDatabaseRows =
      databaseState.expenses.length > 0 ||
      databaseState.budgets.length > 0 ||
      databaseState.attachments.length > 0 ||
      (await this.getMeta(db, LEDGER_CURRENCY_KEY)) !== null;

    // Once SQLite has been verified and used, legacy localStorage is only a recovery snapshot.
    // Never silently replay that stale snapshot into an unexpectedly empty database.
    if (storage.getItem(LEGACY_MIGRATION_LOCAL_FLAG) === 'complete') {
      if (!hasDatabaseRows) throw new Error('SQLITE_DATABASE_MISSING_AFTER_MIGRATION');
      await this.withNativeTransaction((connection) =>
        this.setMeta(connection, LEGACY_MIGRATION_KEY, 'complete')
      );
      clearLegacyFinancialSnapshot(storage);
      return;
    }

    const legacy = readLegacyFinancialState(storage);
    if (hasDatabaseRows && !financialStatesEqual(databaseState, legacy)) {
      throw new Error('LEGACY_MIGRATION_STATE_CONFLICT');
    }

    await this.withNativeTransaction(async (connection) => {
      if (!hasDatabaseRows) {
        for (const expense of legacy.expenses) await this.insertExpense(connection, expense);
        for (const budget of legacy.budgets) await this.insertBudget(connection, budget);
        for (const attachment of legacy.attachments) await this.insertAttachment(connection, attachment);
        await this.setMeta(connection, LEDGER_CURRENCY_KEY, legacy.currencyCode);
      }

      const verified = await this.loadNativeState(true);
      if (!financialStatesEqual(verified, legacy)) throw new Error('LEGACY_MIGRATION_VERIFICATION_FAILED');
      await this.setMeta(connection, LEGACY_MIGRATION_KEY, 'complete');
    });

    try { storage.setItem(LEGACY_MIGRATION_LOCAL_FLAG, 'complete'); } catch {}
    clearLegacyFinancialSnapshot(storage);
  }

  private async loadNativeState(allowMissingCurrency = false): Promise<FinancialState> {
    const db = this.requireDb();
    const expenseRows = await db.query(
      'SELECT id, amount, description, category, transaction_date, note, created_at FROM expenses ORDER BY id DESC'
    );
    const budgetRows = await db.query(
      'SELECT month_key, starting_amount, updated_at FROM monthly_budgets ORDER BY month_key'
    );
    const attachmentRows = await db.query(
      'SELECT id, expense_id, storage_key, mime_type, created_at, original_filename, kind, byte_size, width, height FROM expense_attachments ORDER BY created_at'
    );
    const currency = await this.getMeta(db, LEDGER_CURRENCY_KEY);

    const expenses = (expenseRows.values ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        id: rowNumber(row, 'id'),
        amount: rowNumber(row, 'amount'),
        description: rowString(row, 'description'),
        category: rowString(row, 'category'),
        date: rowNumber(row, 'transaction_date'),
        note: row.note == null ? null : String(row.note),
        createdAt: rowNumber(row, 'created_at'),
      } satisfies Expense;
    });

    const budgets = (budgetRows.values ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        monthKey: rowString(row, 'month_key'),
        startingAmount: rowNumber(row, 'starting_amount'),
        updatedAt: rowNumber(row, 'updated_at'),
      } satisfies MonthlyBudget;
    });

    const attachments = (attachmentRows.values ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      return {
        id: rowString(row, 'id'),
        expenseId: rowNumber(row, 'expense_id'),
        storageKey: rowString(row, 'storage_key'),
        mimeType: rowString(row, 'mime_type'),
        createdAt: rowNumber(row, 'created_at'),
        originalFilename: row.original_filename == null ? null : String(row.original_filename),
        kind: rowString(row, 'kind') as ExpenseAttachment['kind'],
        byteSize: rowNumber(row, 'byte_size'),
        width: rowNumber(row, 'width'),
        height: rowNumber(row, 'height'),
      } satisfies ExpenseAttachment;
    });

    const state = {
      expenses,
      budgets,
      attachments,
      currencyCode: currency ?? (allowMissingCurrency ? 'USD' : ''),
    };
    if (!state.currencyCode) throw new Error('DATABASE_CURRENCY_MISSING');
    return validateFinancialState(state);
  }

  private async withNativeTransaction<T>(work: (db: SQLiteDBConnection) => Promise<T>): Promise<T> {
    const db = this.requireDb();
    await db.beginTransaction();
    try {
      const result = await work(db);
      await db.commitTransaction();
      return result;
    } catch (error) {
      try {
        if ((await db.isTransactionActive()).result) await db.rollbackTransaction();
      } catch {
        // Preserve the original failure. SQLite itself will recover an uncommitted transaction on reopen.
      }
      throw error;
    }
  }

  private requireDb(): SQLiteDBConnection {
    if (!this.db) throw new Error('SQLITE_DATABASE_NOT_OPEN');
    return this.db;
  }

  private async insertExpense(db: SQLiteDBConnection, expense: Expense): Promise<void> {
    await db.run(
      `INSERT INTO expenses(id, amount, description, category, transaction_date, note, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [expense.id, expense.amount, expense.description, expense.category, expense.date, expense.note ?? null, expense.createdAt],
      false
    );
  }

  private async insertBudget(db: SQLiteDBConnection, budget: MonthlyBudget): Promise<void> {
    await db.run(
      'INSERT INTO monthly_budgets(month_key, starting_amount, updated_at) VALUES(?, ?, ?)',
      [budget.monthKey, budget.startingAmount, budget.updatedAt],
      false
    );
  }

  private async insertAttachment(db: SQLiteDBConnection, attachment: ExpenseAttachment): Promise<void> {
    await db.run(
      `INSERT INTO expense_attachments(
        id, expense_id, storage_key, mime_type, created_at, original_filename, kind, byte_size, width, height
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachment.id,
        attachment.expenseId,
        attachment.storageKey,
        attachment.mimeType,
        attachment.createdAt,
        attachment.originalFilename ?? null,
        attachment.kind,
        attachment.byteSize,
        attachment.width,
        attachment.height,
      ],
      false
    );
  }

  private async getMeta(db: SQLiteDBConnection, key: string): Promise<string | null> {
    const result = await db.query('SELECT value FROM app_meta WHERE key = ? LIMIT 1', [key]);
    const value = (result.values?.[0] as Record<string, unknown> | undefined)?.value;
    return typeof value === 'string' ? value : null;
  }

  private async setMeta(db: SQLiteDBConnection, key: string, value: string): Promise<void> {
    await db.run(
      `INSERT INTO app_meta(key, value) VALUES(?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
      false
    );
  }
}

export const LocalDataStore = new LocalDataStoreImpl();
