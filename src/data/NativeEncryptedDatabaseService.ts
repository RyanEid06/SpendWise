import type {
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { Expense, ExpenseAttachment, MonthlyBudget } from '../types';
import {
  secureKeyService,
  type SecureKeyService,
} from '../security/SecureKeyService';
import {
  financialStatesEqual,
  type FinancialState,
  type KeyValueStore,
  validateFinancialState,
} from '../utils/financialState';
import {
  applySpendWiseSchema,
  assertSpendWiseDatabaseIntegrity,
  readDatabaseUserVersion,
  SPENDWISE_DATABASE_SCHEMA_VERSION,
} from './databaseSchema';

import { diagnostics } from '../services/diagnostics/diagnostics';

const PLAINTEXT_DATABASE_NAME = 'spendwise';
export const ENCRYPTED_DATABASE_NAME = 'spendwise_secure_v1';
export const DATABASE_KEY_PURPOSE = 'spendwise.db.v1';
export const DATABASE_MIGRATION_STORAGE_KEY = 'spendwise_db_encryption_migration_v1';
const LEDGER_CURRENCY_KEY = 'ledger_currency';

export type DatabaseMigrationPhase =
  | 'copying'
  | 'copied'
  | 'verified'
  | 'active'
  | 'complete';

export interface DatabaseMigrationCounts {
  expenses: number;
  budgets: number;
  attachments: number;
  meta: number;
}

export interface DatabaseMigrationRecord {
  version: 1;
  phase: DatabaseMigrationPhase;
  sourceSchemaVersion: number;
  expectedCounts: DatabaseMigrationCounts;
  updatedAt: number;
}

export type DatabaseRecoveryAction =
  | 'create-encrypted'
  | 'migrate-plaintext'
  | 'restart-migration'
  | 'resume-active-cleanup'
  | 'open-encrypted'
  | 'fail-unencrypted-destination';

export function decideDatabaseRecovery(input: {
  sourceExists: boolean;
  destinationExists: boolean;
  destinationEncrypted: boolean;
  migrationPhase: DatabaseMigrationPhase | null;
}): DatabaseRecoveryAction {
  if (!input.destinationExists) {
    return input.sourceExists ? 'migrate-plaintext' : 'create-encrypted';
  }
  if (!input.destinationEncrypted) {
    return input.sourceExists
      ? 'restart-migration'
      : 'fail-unencrypted-destination';
  }
  if (!input.sourceExists) return 'open-encrypted';
  return input.migrationPhase === 'active' || input.migrationPhase === 'complete'
    ? 'resume-active-cleanup'
    : 'restart-migration';
}

interface DatabaseSnapshot {
  state: FinancialState;
  meta: Record<string, string>;
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

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }
  return btoa(binary);
}

function safeReadMigration(storage: KeyValueStore): DatabaseMigrationRecord | null {
  const raw = storage.getItem(DATABASE_MIGRATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DatabaseMigrationRecord;
    if (
      parsed.version !== 1 ||
      !['copying', 'copied', 'verified', 'active', 'complete'].includes(parsed.phase) ||
      !Number.isInteger(parsed.sourceSchemaVersion) ||
      !parsed.expectedCounts ||
      !Object.values(parsed.expectedCounts).every(
        (value) => Number.isInteger(value) && value >= 0
      )
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeMigration(
  storage: KeyValueStore,
  phase: DatabaseMigrationPhase,
  sourceSchemaVersion: number,
  expectedCounts: DatabaseMigrationCounts
): void {
  storage.setItem(
    DATABASE_MIGRATION_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      phase,
      sourceSchemaVersion,
      expectedCounts,
      updatedAt: Date.now(),
    } satisfies DatabaseMigrationRecord)
  );
  diagnostics.setState({ migration: phase });
}

async function readSnapshot(db: SQLiteDBConnection): Promise<DatabaseSnapshot> {
  const expenseRows = await db.query(
    'SELECT id, amount, description, category, transaction_date, note, created_at FROM expenses ORDER BY id'
  );
  const budgetRows = await db.query(
    'SELECT month_key, starting_amount, updated_at FROM monthly_budgets ORDER BY month_key'
  );
  const attachmentRows = await db.query(
    'SELECT id, expense_id, storage_key, mime_type, created_at, original_filename, kind, byte_size, width, height FROM expense_attachments ORDER BY id'
  );
  const metaRows = await db.query('SELECT key, value FROM app_meta ORDER BY key');

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
      originalFilename:
        row.original_filename == null ? null : String(row.original_filename),
      kind: rowString(row, 'kind') as ExpenseAttachment['kind'],
      byteSize: rowNumber(row, 'byte_size'),
      width: rowNumber(row, 'width'),
      height: rowNumber(row, 'height'),
    } satisfies ExpenseAttachment;
  });

  const meta: Record<string, string> = {};
  for (const raw of metaRows.values ?? []) {
    const row = raw as Record<string, unknown>;
    const key = rowString(row, 'key');
    const value = rowString(row, 'value');
    meta[key] = value;
  }

  const hasRows =
    expenses.length > 0 || budgets.length > 0 || attachments.length > 0;
  const currencyCode = meta[LEDGER_CURRENCY_KEY] ?? (hasRows ? '' : 'USD');
  if (!currencyCode) throw new Error('DATABASE_CURRENCY_MISSING');

  return {
    state: validateFinancialState({
      expenses,
      budgets,
      attachments,
      currencyCode,
    }),
    meta,
  };
}

async function replaceSnapshot(
  db: SQLiteDBConnection,
  snapshot: DatabaseSnapshot
): Promise<void> {
  await db.beginTransaction();
  try {
    await db.run('DELETE FROM expense_attachments', [], false);
    await db.run('DELETE FROM expenses', [], false);
    await db.run('DELETE FROM monthly_budgets', [], false);
    await db.run('DELETE FROM app_meta', [], false);

    for (const expense of snapshot.state.expenses) {
      await db.run(
        `INSERT INTO expenses(
          id, amount, description, category, transaction_date, note, created_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.id,
          expense.amount,
          expense.description,
          expense.category,
          expense.date,
          expense.note ?? null,
          expense.createdAt,
        ],
        false
      );
    }

    for (const budget of snapshot.state.budgets) {
      await db.run(
        'INSERT INTO monthly_budgets(month_key, starting_amount, updated_at) VALUES(?, ?, ?)',
        [budget.monthKey, budget.startingAmount, budget.updatedAt],
        false
      );
    }

    for (const attachment of snapshot.state.attachments) {
      await db.run(
        `INSERT INTO expense_attachments(
          id, expense_id, storage_key, mime_type, created_at, original_filename,
          kind, byte_size, width, height
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

    const meta = {
      ...snapshot.meta,
      [LEDGER_CURRENCY_KEY]: snapshot.state.currencyCode,
    };
    for (const [key, value] of Object.entries(meta)) {
      await db.run(
        'INSERT INTO app_meta(key, value) VALUES(?, ?)',
        [key, value],
        false
      );
    }

    await db.commitTransaction();
  } catch (error) {
    try {
      if ((await db.isTransactionActive()).result) {
        await db.rollbackTransaction();
      }
    } catch {
      // Preserve the original copy failure.
    }
    throw error;
  }
}

function snapshotCounts(snapshot: DatabaseSnapshot): DatabaseMigrationCounts {
  return {
    expenses: snapshot.state.expenses.length,
    budgets: snapshot.state.budgets.length,
    attachments: snapshot.state.attachments.length,
    meta: Object.keys(snapshot.meta).length,
  };
}

function metadataEqual(
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  const normalize = (value: Record<string, string>) =>
    Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

async function assertSnapshotMatches(
  source: DatabaseSnapshot,
  destination: DatabaseSnapshot
): Promise<void> {
  if (!financialStatesEqual(source.state, destination.state)) {
    throw new Error('DATABASE_MIGRATION_STATE_MISMATCH');
  }

  const expectedMeta = {
    ...source.meta,
    [LEDGER_CURRENCY_KEY]: source.state.currencyCode,
  };
  if (!metadataEqual(expectedMeta, destination.meta)) {
    throw new Error('DATABASE_MIGRATION_META_MISMATCH');
  }

  // Representative reads are intentionally explicit, even though readSnapshot
  // already consumed every row. They catch a destination that cannot service
  // the normal indexed access patterns after the copy.
  await destinationReadProbe(destination);
}

async function destinationReadProbe(snapshot: DatabaseSnapshot): Promise<void> {
  validateFinancialState(snapshot.state);
  if (
    snapshot.state.expenses.length > 0 &&
    !Number.isInteger(snapshot.state.expenses[0].id)
  ) {
    throw new Error('DATABASE_MIGRATION_REPRESENTATIVE_READ_FAILED');
  }
}

async function countRows(
  db: SQLiteDBConnection
): Promise<DatabaseMigrationCounts> {
  const queryCount = async (table: string) => {
    const result = await db.query(`SELECT COUNT(*) AS count FROM ${table}`);
    return Number(
      (result.values?.[0] as Record<string, unknown> | undefined)?.count ?? -1
    );
  };
  const counts = {
    expenses: await queryCount('expenses'),
    budgets: await queryCount('monthly_budgets'),
    attachments: await queryCount('expense_attachments'),
    meta: await queryCount('app_meta'),
  };
  if (!Object.values(counts).every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error('DATABASE_MIGRATION_COUNT_FAILED');
  }
  return counts;
}

function countsEqual(
  left: DatabaseMigrationCounts,
  right: DatabaseMigrationCounts
): boolean {
  return (
    left.expenses === right.expenses &&
    left.budgets === right.budgets &&
    left.attachments === right.attachments &&
    left.meta === right.meta
  );
}

async function openConnection(
  sqlite: SQLiteConnection,
  database: string,
  encrypted: boolean,
  mode: string
): Promise<SQLiteDBConnection> {
  const consistent = await sqlite.checkConnectionsConsistency();
  const hasConnection =
    (await sqlite.isConnection(database, false)).result === true;
  const db =
    consistent.result && hasConnection
      ? await sqlite.retrieveConnection(database, false)
      : await sqlite.createConnection(
          database,
          encrypted,
          mode,
          SPENDWISE_DATABASE_SCHEMA_VERSION,
          false
        );
  if (!(await db.isDBOpen()).result) await db.open();
  await db.execute('PRAGMA foreign_keys = ON;', false);
  return db;
}

async function closeConnection(
  sqlite: SQLiteConnection,
  database: string
): Promise<void> {
  try {
    if ((await sqlite.isConnection(database, false)).result) {
      const db = await sqlite.retrieveConnection(database, false);
      try {
        if ((await db.isDBOpen()).result) await db.close();
      } finally {
        await sqlite.closeConnection(database, false);
      }
    }
  } catch {
    // The caller is about to retry/delete. A missing stale connection is fine.
  }
}

async function deleteDatabase(
  sqlite: SQLiteConnection,
  database: string,
  encrypted: boolean
): Promise<void> {
  await closeConnection(sqlite, database);
  const db = await sqlite.createConnection(
    database,
    encrypted,
    encrypted ? 'secret' : 'no-encryption',
    SPENDWISE_DATABASE_SCHEMA_VERSION,
    false
  );
  try {
    if ((await db.isExists()).result) await db.delete();
  } finally {
    await closeConnection(sqlite, database);
  }
}

async function ensureSqlCipherSecret(
  sqlite: SQLiteConnection,
  passphrase: string
): Promise<void> {
  if (!(await sqlite.isInConfigEncryption()).result) {
    throw new Error('SQLCIPHER_NOT_ENABLED_IN_CAPACITOR_CONFIG');
  }

  const stored = (await sqlite.isSecretStored()).result;
  if (!stored) {
    await sqlite.setEncryptionSecret(passphrase);
    return;
  }

  if ((await sqlite.checkEncryptionSecret(passphrase)).result) return;

  // SecureKeyService is the source of truth. The plugin keeps only an
  // operational Android-encrypted mirror so SQLCipher can open the DB.
  await sqlite.clearEncryptionSecret();
  await sqlite.setEncryptionSecret(passphrase);
}

export class NativeEncryptedDatabaseService {
  private sqlite: SQLiteConnection | null = null;

  constructor(
    private readonly keyService: SecureKeyService = secureKeyService
  ) {}

  async open(storage: KeyValueStore): Promise<SQLiteDBConnection> {
    const { CapacitorSQLite, SQLiteConnection } = await import(
      '@capacitor-community/sqlite'
    );
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    this.sqlite = sqlite;

    const destinationExists =
      (await sqlite.isDatabase(ENCRYPTED_DATABASE_NAME)).result === true;
    if (
      destinationExists &&
      !this.keyService.hasWrappedSecret(DATABASE_KEY_PURPOSE)
    ) {
      throw new Error('DATABASE_KEY_MISSING');
    }

    if (!this.keyService.hasWrappedSecret(DATABASE_KEY_PURPOSE)) {
      const created = await this.keyService.ensureWrappedSecret(
        DATABASE_KEY_PURPOSE,
        32
      );
      if (!created.ok) {
        throw new Error(`DATABASE_KEY_SETUP_${created.code ?? created.kind}`);
      }
    }

    const opened = await this.keyService.withUnwrappedSecret(
      DATABASE_KEY_PURPOSE,
      async (secret) => {
        const passphrase = encodeBase64(secret);
        await ensureSqlCipherSecret(sqlite, passphrase);
        return this.openWithConfiguredSecret(sqlite, storage);
      }
    );

    if (!opened.ok) {
      throw new Error(`DATABASE_KEY_UNWRAP_${opened.code ?? opened.kind}`);
    }
    return opened.value;
  }

  private async openWithConfiguredSecret(
    sqlite: SQLiteConnection,
    storage: KeyValueStore
  ): Promise<SQLiteDBConnection> {
    let sourceExists =
      (await sqlite.isDatabase(PLAINTEXT_DATABASE_NAME)).result === true;
    let destinationExists =
      (await sqlite.isDatabase(ENCRYPTED_DATABASE_NAME)).result === true;
    let destinationEncrypted = false;

    if (destinationExists) {
      try {
        destinationEncrypted =
          (await sqlite.isDatabaseEncrypted(ENCRYPTED_DATABASE_NAME)).result ===
          true;
      } catch {
        throw new Error('ENCRYPTED_DATABASE_KEY_OR_FORMAT_INVALID');
      }
    }

    const journal = safeReadMigration(storage);
    const action = decideDatabaseRecovery({
      sourceExists,
      destinationExists,
      destinationEncrypted,
      migrationPhase: journal?.phase ?? null,
    });

    if (action === 'fail-unencrypted-destination') {
      throw new Error('ENCRYPTED_DATABASE_EXPECTED');
    }

    if (action === 'restart-migration') {
      if (!sourceExists) throw new Error('PLAINTEXT_DATABASE_SOURCE_MISSING');

      // Validate the recovery source before destroying any staged destination.
      // A crash must never turn a previously recoverable encrypted copy into
      // collateral damage if the old source has since become unreadable.
      const source = await openConnection(
        sqlite,
        PLAINTEXT_DATABASE_NAME,
        false,
        'no-encryption'
      );
      await assertSpendWiseDatabaseIntegrity(source);
      const sourceVersion = await readDatabaseUserVersion(source);
      if (sourceVersion !== SPENDWISE_DATABASE_SCHEMA_VERSION) {
        throw new Error('PLAINTEXT_DATABASE_SCHEMA_UNSUPPORTED');
      }
      const sourceSnapshot = await readSnapshot(source);
      const sourceCounts = snapshotCounts(sourceSnapshot);

      let reusableDestination: SQLiteDBConnection | null = null;
      if (
        destinationEncrypted &&
        journal &&
        (journal.phase === 'copied' || journal.phase === 'verified')
      ) {
        try {
          let candidate = await openConnection(
            sqlite,
            ENCRYPTED_DATABASE_NAME,
            true,
            'secret'
          );
          await assertSpendWiseDatabaseIntegrity(candidate);
          const candidateSnapshot = await readSnapshot(candidate);
          await assertSnapshotMatches(sourceSnapshot, candidateSnapshot);
          const candidateCounts = await countRows(candidate);
          if (!countsEqual(candidateCounts, sourceCounts)) {
            throw new Error('DATABASE_MIGRATION_COUNT_MISMATCH');
          }

          await closeConnection(sqlite, ENCRYPTED_DATABASE_NAME);
          candidate = await openConnection(
            sqlite,
            ENCRYPTED_DATABASE_NAME,
            true,
            'secret'
          );
          await assertSpendWiseDatabaseIntegrity(candidate);
          const reopenedSnapshot = await readSnapshot(candidate);
          await assertSnapshotMatches(sourceSnapshot, reopenedSnapshot);
          reusableDestination = candidate;
        } catch {
          await closeConnection(sqlite, ENCRYPTED_DATABASE_NAME);
          reusableDestination = null;
        }
      }

      if (reusableDestination) {
        // Journal writes happen only after validation. If localStorage itself
        // fails here, both source and verified destination remain recoverable.
        writeMigration(storage, 'active', sourceVersion, sourceCounts);
        return reusableDestination;
      }

      await deleteDatabase(
        sqlite,
        ENCRYPTED_DATABASE_NAME,
        destinationEncrypted
      );
      destinationExists = false;
      destinationEncrypted = false;
      return this.migrateFromPlaintext(sqlite, storage);
    }

    if (action === 'migrate-plaintext') {
      return this.migrateFromPlaintext(sqlite, storage);
    }

    if (action === 'resume-active-cleanup') {
      if (!journal) throw new Error('DATABASE_MIGRATION_JOURNAL_MISSING');
      const destination = await openConnection(
        sqlite,
        ENCRYPTED_DATABASE_NAME,
        true,
        'secret'
      );
      await assertSpendWiseDatabaseIntegrity(destination);
      const snapshot = await readSnapshot(destination);
      validateFinancialState(snapshot.state);

      // Do not delete the plaintext source here. LocalDataStore may still need
      // to reconcile a valid v1.4 localStorage recovery snapshot. The caller
      // explicitly finalizes source cleanup only after that recovery succeeds.
      return destination;
    }

    if (action === 'open-encrypted') {
      const destination = await openConnection(
        sqlite,
        ENCRYPTED_DATABASE_NAME,
        true,
        'secret'
      );
      await applySpendWiseSchema(destination);
      await assertSpendWiseDatabaseIntegrity(destination);
      const snapshot = await readSnapshot(destination);
      validateFinancialState(snapshot.state);
      const cleanupAlreadyComplete = journal?.phase === 'complete' && !sourceExists;
      if (journal?.phase !== 'active' && !cleanupAlreadyComplete) {
        writeMigration(
          storage,
          'active',
          SPENDWISE_DATABASE_SCHEMA_VERSION,
          snapshotCounts(snapshot)
        );
      }
      return destination;
    }

    const destination = await openConnection(
      sqlite,
      ENCRYPTED_DATABASE_NAME,
      true,
      'secret'
    );
    await applySpendWiseSchema(destination);
    await assertSpendWiseDatabaseIntegrity(destination);
    await closeConnection(sqlite, ENCRYPTED_DATABASE_NAME);
    const reopened = await openConnection(
      sqlite,
      ENCRYPTED_DATABASE_NAME,
      true,
      'secret'
    );
    await assertSpendWiseDatabaseIntegrity(reopened);
    writeMigration(
      storage,
      'active',
      SPENDWISE_DATABASE_SCHEMA_VERSION,
      { expenses: 0, budgets: 0, attachments: 0, meta: 0 }
    );
    return reopened;
  }

  async finalizePlaintextSourceCleanup(
    storage: KeyValueStore
  ): Promise<void> {
    const sqlite = this.sqlite;
    if (!sqlite) throw new Error('DATABASE_SERVICE_NOT_OPEN');

    const journal = safeReadMigration(storage);
    const sourceExists =
      (await sqlite.isDatabase(PLAINTEXT_DATABASE_NAME)).result === true;

    // Normal steady-state startup has already opened, schema-checked, integrity-
    // checked and validated the encrypted destination in open(). Once cleanup is
    // durably complete and the plaintext source is gone, repeating a second full
    // integrity scan + snapshot read here only adds unlock latency.
    if (journal?.phase === 'complete' && !sourceExists) {
      diagnostics.setState({ migration: 'complete' });
      return;
    }

    const destinationExists =
      (await sqlite.isDatabase(ENCRYPTED_DATABASE_NAME)).result === true;
    if (!destinationExists) throw new Error('ENCRYPTED_DATABASE_MISSING');
    const destinationEncrypted =
      (await sqlite.isDatabaseEncrypted(ENCRYPTED_DATABASE_NAME)).result === true;
    if (!destinationEncrypted) throw new Error('ENCRYPTED_DATABASE_EXPECTED');

    const destination = await openConnection(
      sqlite,
      ENCRYPTED_DATABASE_NAME,
      true,
      'secret'
    );
    await assertSpendWiseDatabaseIntegrity(destination);
    const snapshot = await readSnapshot(destination);
    validateFinancialState(snapshot.state);

    if (
      !journal ||
      (journal.phase !== 'active' && journal.phase !== 'complete')
    ) {
      throw new Error('DATABASE_MIGRATION_NOT_ACTIVE');
    }

    if (sourceExists) {
      try {
        await deleteDatabase(sqlite, PLAINTEXT_DATABASE_NAME, false);
      } catch {
        throw new Error('PLAINTEXT_DATABASE_CLEANUP_FAILED');
      }
    }

    writeMigration(
      storage,
      'complete',
      journal?.sourceSchemaVersion ?? SPENDWISE_DATABASE_SCHEMA_VERSION,
      snapshotCounts(snapshot)
    );
  }

  private async migrateFromPlaintext(
    sqlite: SQLiteConnection,
    storage: KeyValueStore
  ): Promise<SQLiteDBConnection> {
    const source = await openConnection(
      sqlite,
      PLAINTEXT_DATABASE_NAME,
      false,
      'no-encryption'
    );

    await assertSpendWiseDatabaseIntegrity(source);
    const sourceVersion = await readDatabaseUserVersion(source);
    if (sourceVersion !== SPENDWISE_DATABASE_SCHEMA_VERSION) {
      throw new Error('PLAINTEXT_DATABASE_SCHEMA_UNSUPPORTED');
    }

    const sourceSnapshot = await readSnapshot(source);
    const expectedCounts = snapshotCounts(sourceSnapshot);
    writeMigration(
      storage,
      'copying',
      sourceVersion,
      expectedCounts
    );

    let destination: SQLiteDBConnection | null = null;
    try {
      destination = await openConnection(
        sqlite,
        ENCRYPTED_DATABASE_NAME,
        true,
        'secret'
      );
      await applySpendWiseSchema(destination);
      await replaceSnapshot(destination, sourceSnapshot);
      writeMigration(
        storage,
        'copied',
        sourceVersion,
        expectedCounts
      );

      await assertSpendWiseDatabaseIntegrity(destination);
      const copiedSnapshot = await readSnapshot(destination);
      await assertSnapshotMatches(sourceSnapshot, copiedSnapshot);
      const copiedCounts = await countRows(destination);
      if (!countsEqual(copiedCounts, expectedCounts)) {
        throw new Error('DATABASE_MIGRATION_COUNT_MISMATCH');
      }
      writeMigration(
        storage,
        'verified',
        sourceVersion,
        expectedCounts
      );

      await closeConnection(sqlite, ENCRYPTED_DATABASE_NAME);
      destination = await openConnection(
        sqlite,
        ENCRYPTED_DATABASE_NAME,
        true,
        'secret'
      );
      await assertSpendWiseDatabaseIntegrity(destination);
      const reopenedSnapshot = await readSnapshot(destination);
      await assertSnapshotMatches(sourceSnapshot, reopenedSnapshot);
      const reopenedCounts = await countRows(destination);
      if (!countsEqual(reopenedCounts, expectedCounts)) {
        throw new Error('DATABASE_MIGRATION_REOPEN_COUNT_MISMATCH');
      }

      writeMigration(
        storage,
        'active',
        sourceVersion,
        expectedCounts
      );

      // Activation is deliberately separate from destruction. The caller must
      // finish legacy localStorage recovery before deleting the v1.4 source.
      return destination;
    } catch (error) {
      // Never delete the plaintext source here. Any failure before cleanup keeps
      // the v1.4 DB recoverable; the next startup can discard/rebuild staging.
      throw error;
    }
  }
}

export const nativeEncryptedDatabaseService =
  new NativeEncryptedDatabaseService();
