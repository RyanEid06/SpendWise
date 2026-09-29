import { Capacitor } from '@capacitor/core';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Expense, ExpenseAttachment, MonthlyBudget } from '../types';
import {
  cloneFinancialState,
  FinancialState,
  financialStatesEqual,
  KeyValueStore,
  persistWebFinancialState,
  readLegacyFinancialState,
  recoverWebFinancialTransaction,
  validateFinancialState,
} from './financialState';

const DATABASE_NAME = 'spendwise';
const SCHEMA_VERSION = 1;
const LEGACY_MIGRATION_KEY = 'legacy_localstorage_migration_v1';
const LEGACY_MIGRATION_LOCAL_FLAG = 'spendwise_sqlite_migration_v1_complete';
const LEDGER_CURRENCY_KEY = 'ledger_currency';

const SCHEMA_MIGRATIONS: Array<{ version: number; statements: string[] }> = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY NOT NULL,
        amount REAL NOT NULL CHECK(amount > 0),
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        transaction_date INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS monthly_budgets (
        month_key TEXT PRIMARY KEY NOT NULL,
        starting_amount REAL NOT NULL CHECK(starting_amount > 0),
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS expense_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        expense_id INTEGER NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        original_filename TEXT,
        kind TEXT NOT NULL CHECK(kind IN ('purchase', 'receipt', 'proof')),
        byte_size INTEGER NOT NULL CHECK(byte_size > 0),
        width INTEGER NOT NULL CHECK(width > 0),
        height INTEGER NOT NULL CHECK(height > 0),
        FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_expenses_transaction_date ON expenses(transaction_date)',
      'CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense_id ON expense_attachments(expense_id)',
    ],
  },
];

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

  async init(storage: KeyValueStore): Promise<void> {
    if (this.initialized) return;
    this.storage = storage;
    this.native = Capacitor.getPlatform() === 'android';

    if (!this.native) {
      recoverWebFinancialTransaction(storage);
      this.state = readLegacyFinancialState(storage);
      this.initialized = true;
      return;
    }

    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const consistent = await sqlite.checkConnectionsConsistency();
    const hasConnection = (await sqlite.isConnection(DATABASE_NAME, false)).result === true;
    this.db = consistent.result && hasConnection
      ? await sqlite.retrieveConnection(DATABASE_NAME, false)
      : await sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', SCHEMA_VERSION, false);

    const isOpen = (await this.db.isDBOpen()).result === true;
    if (!isOpen) await this.db.open();
    await this.db.execute('PRAGMA foreign_keys = ON;', false);
    await this.applySchemaMigrations();
    await this.migrateLegacyLocalStorage(storage);
    this.state = await this.loadNativeState();
    this.initialized = true;
  }

  isNativeSqlite(): boolean {
    return this.native;
  }

  getExpenses(): Expense[] {
    this.requireInitialized();
    return this.state.expenses.map((item) => ({ ...item }));
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

  async createExpenseWithAttachments(expense: Expense, attachments: ExpenseAttachment[]): Promise<void> {
    await this.enqueueWrite(async () => {
      const next = cloneFinancialState(this.state);
      if (next.expenses.some((item) => item.id === expense.id)) throw new Error('EXPENSE_ID_EXISTS');
      next.expenses.unshift({ ...expense });
      next.attachments.push(...attachments.map((item) => ({ ...item })));
      validateFinancialState(next);

      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          await this.insertExpense(db, expense);
          for (const attachment of attachments) await this.insertAttachment(db, attachment);
        });
      } else {
        this.persistWeb(next);
      }
      this.state = next;
    });
  }

  async updateExpenseWithAttachments(expense: Expense, attachments: ExpenseAttachment[]): Promise<void> {
    await this.enqueueWrite(async () => {
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
        });
      } else {
        this.persistWeb(next);
      }
      this.state = next;
    });
  }

  async deleteExpense(id: number): Promise<ExpenseAttachment[]> {
    return this.enqueueWrite(async () => {
      const detached = this.state.attachments.filter((item) => item.expenseId === id).map((item) => ({ ...item }));
      const next = cloneFinancialState(this.state);
      next.expenses = next.expenses.filter((item) => item.id !== id);
      next.attachments = next.attachments.filter((item) => item.expenseId !== id);

      if (this.native) {
        await this.withNativeTransaction(async (db) => {
          await db.run('DELETE FROM expenses WHERE id = ?', [id], false);
        });
      } else {
        this.persistWeb(next);
      }
      this.state = next;
      return detached;
    });
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
        });
      } else {
        this.persistWeb(next);
      }
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

  private persistWeb(state: FinancialState): void {
    if (!this.storage) throw new Error('WEB_STORAGE_UNAVAILABLE');
    persistWebFinancialState(this.storage, state);
  }

  private enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const task = this.writeQueue.then(work, work);
    this.writeQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async applySchemaMigrations(): Promise<void> {
    const db = this.requireDb();
    const result = await db.query('PRAGMA user_version;');
    const current = Number((result.values?.[0] as Record<string, unknown> | undefined)?.user_version ?? 0);
    if (!Number.isInteger(current) || current < 0 || current > SCHEMA_VERSION) {
      throw new Error('UNSUPPORTED_DATABASE_SCHEMA');
    }

    for (const migration of SCHEMA_MIGRATIONS) {
      if (migration.version <= current) continue;
      await this.withNativeTransaction(async (connection) => {
        for (const statement of migration.statements) await connection.execute(`${statement};`, false);
        await connection.execute(`PRAGMA user_version = ${migration.version};`, false);
      });
    }
  }

  private async migrateLegacyLocalStorage(storage: KeyValueStore): Promise<void> {
    const db = this.requireDb();
    const marker = await this.getMeta(db, LEGACY_MIGRATION_KEY);
    if (marker === 'complete') {
      try { storage.setItem(LEGACY_MIGRATION_LOCAL_FLAG, 'complete'); } catch {}
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
