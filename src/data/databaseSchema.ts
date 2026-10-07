import type { SQLiteDBConnection } from '@capacitor-community/sqlite';

export const SPENDWISE_DATABASE_SCHEMA_VERSION = 2;

export const SPENDWISE_SCHEMA_MIGRATIONS: Array<{ version: number; statements: string[] }> = [
  // Version 1 is intentionally unchanged for existing installations.
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
  {
    version: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS expense_draft_media (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL
      )`,
    ],
  },
];

export async function readDatabaseUserVersion(db: SQLiteDBConnection): Promise<number> {
  const result = await db.query('PRAGMA user_version;');
  const value = Number(
    (result.values?.[0] as Record<string, unknown> | undefined)?.user_version ?? 0
  );
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('DATABASE_INVALID_SCHEMA_VERSION');
  }
  return value;
}

export async function applySpendWiseSchema(db: SQLiteDBConnection): Promise<void> {
  const current = await readDatabaseUserVersion(db);
  if (current > SPENDWISE_DATABASE_SCHEMA_VERSION) {
    throw new Error('UNSUPPORTED_DATABASE_SCHEMA');
  }

  for (const migration of SPENDWISE_SCHEMA_MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.beginTransaction();
    try {
      for (const statement of migration.statements) {
        await db.execute(`${statement};`, false);
      }
      await db.execute(`PRAGMA user_version = ${migration.version};`, false);
      await db.commitTransaction();
    } catch (error) {
      try {
        if ((await db.isTransactionActive()).result) await db.rollbackTransaction();
      } catch {
        // Preserve the original migration failure.
      }
      throw error;
    }
  }
}

export async function assertSpendWiseDatabaseIntegrity(
  db: SQLiteDBConnection,
  requireCurrentSchema = true
): Promise<void> {
  const version = await readDatabaseUserVersion(db);
  if (
    version < 0 ||
    version > SPENDWISE_DATABASE_SCHEMA_VERSION ||
    (requireCurrentSchema && version !== SPENDWISE_DATABASE_SCHEMA_VERSION)
  ) {
    throw new Error('UNSUPPORTED_DATABASE_SCHEMA');
  }

  const integrity = await db.query('PRAGMA integrity_check;');
  const first = integrity.values?.[0] as Record<string, unknown> | undefined;
  const integrityValue = first
    ? String(first.integrity_check ?? first['PRAGMA integrity_check'] ?? Object.values(first)[0] ?? '')
    : '';
  if (integrityValue.toLowerCase() !== 'ok') {
    throw new Error('DATABASE_INTEGRITY_CHECK_FAILED');
  }

  const foreignKeys = await db.query('PRAGMA foreign_key_check;');
  if ((foreignKeys.values?.length ?? 0) > 0) {
    throw new Error('DATABASE_FOREIGN_KEY_CHECK_FAILED');
  }

  const requiredTables = new Set([
    'expenses',
    'monthly_budgets',
    'expense_attachments',
    'app_meta',
  ]);
  const tableResult = await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  for (const raw of tableResult.values ?? []) {
    const name = String((raw as Record<string, unknown>).name ?? '');
    requiredTables.delete(name);
  }
  if (requiredTables.size > 0) {
    throw new Error('DATABASE_REQUIRED_TABLE_MISSING');
  }
}
