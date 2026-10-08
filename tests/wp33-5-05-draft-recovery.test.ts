import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { LocalDataStoreImpl } from '../src/utils/localDataStore';
import { applySpendWiseSchema, assertSpendWiseDatabaseIntegrity } from '../src/data/databaseSchema';
import { ExpenseDraftRecoveryService } from '../src/services/ExpenseDraftRecoveryService';
import { type ExpenseEditorDraft, NATIVE_EXPENSE_DRAFT_KEY, WEB_EXPENSE_DRAFT_KEY, validateStoredDraft } from '../src/data/ExpenseDraft';
import { persistWebFinancialState, recoverWebFinancialTransaction } from '../src/utils/financialState';
import type { Expense } from '../src/types';

const expense: Expense = { id: 1, amount: 5, description: 'Original', category: 'Food', date: 1791000000000, note: 'Original note', createdAt: 1791000000000 };
const draft = (overrides: Partial<ExpenseEditorDraft> = {}): ExpenseEditorDraft => ({
  version: 1, id: 'draft-1', expenseId: null, expenseCreatedAt: null, currencyCode: 'USD',
  amountText: '12.', descriptionText: 'Private merchant', category: 'Food', date: expense.date,
  noteText: 'Unfinished note', activeTool: null, attachments: [], removedAttachmentIds: [], smart: null, receipt: null, ...overrides,
});
const photo = () => ({ blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
  mimeType: 'image/jpeg', kind: 'purchase' as const, width: 2, height: 2, byteSize: 4, originalFilename: 'private.jpg' });

// Real SQLite statements/transactions exercise the production store. These are
// contract tests; SQLCipher and real process death are verified separately on Android.
async function harness(sql = new DatabaseSync(':memory:')) {
  let failure: string | null = null;
  const connection = {
    query: async (statement: string, values: any[] = []) => ({ values: sql.prepare(statement).all(...values) }),
    run: async (statement: string, values: any[] = []) => {
      if (failure && statement.includes(failure)) throw new Error('INJECTED_DISK_FAILURE');
      return { changes: sql.prepare(statement).run(...values) };
    },
    execute: async (statement: string) => { sql.exec(statement); },
    beginTransaction: async () => { sql.exec('BEGIN'); },
    commitTransaction: async () => { sql.exec('COMMIT'); },
    rollbackTransaction: async () => { sql.exec('ROLLBACK'); },
    isTransactionActive: async () => ({ result: sql.isTransaction }),
  } as unknown as SQLiteDBConnection;
  await applySpendWiseSchema(connection);
  sql.exec("INSERT OR IGNORE INTO app_meta VALUES ('ledger_currency','USD')");
  const store = new LocalDataStoreImpl();
  const internals = store as any;
  internals.native = true;
  internals.db = connection;
  internals.initialized = true;
  internals.state = await internals.loadNativeState();
  const raw = sql.prepare('SELECT value FROM app_meta WHERE key=?').get(NATIVE_EXPENSE_DRAFT_KEY) as { value: string } | undefined;
  internals.expenseDraft = raw ? validateStoredDraft(JSON.parse(raw.value)) : null;
  internals.draftMediaIds = new Set(internals.expenseDraft?.photos.map((p: any) => p.id) ?? []);
  return { sql, connection, store, service: new ExpenseDraftRecoveryService(store), fail: (value: string | null) => { failure = value; } };
}

test('raw unfinished Add fields survive a reconstructed service/store', async () => {
  const h = await harness();
  await h.service.persist(draft());
  const reopened = await harness(h.sql);
  assert.deepEqual(await reopened.service.restore(), draft());
  assert.equal(reopened.store.getExpenses().length, 0);
});

test('photo recovery retains bytes and shared Smart Capture ownership without duplication', async () => {
  const h = await harness();
  const p = photo();
  await h.service.persist(draft({ attachments: [p], smart: { photo: p, result: null, interrupted: true, language: 'en', currencyCode: 'USD' } }));
  const reopened = await harness(h.sql);
  const restored = (await reopened.service.restore())!;
  assert.deepEqual(new Uint8Array(await restored.attachments[0].blob.arrayBuffer()), new Uint8Array([1,2,3,4]));
  assert.equal(restored.attachments[0], restored.smart?.photo);
  assert.equal(restored.smart?.interrupted, true);
  await reopened.service.persist(restored);
  assert.equal((h.sql.prepare('SELECT COUNT(*) n FROM expense_draft_media').get() as any).n, 1);
});

test('removing a draft photo deletes only its encrypted draft row', async () => {
  const h = await harness();
  await h.service.persist(draft({ attachments: [photo()] }));
  await h.service.persist(draft());
  assert.equal((h.sql.prepare('SELECT COUNT(*) n FROM expense_draft_media').get() as any).n, 0);
  assert.equal(h.store.getAttachments().length, 0);
});

test('recovered Save clears draft and its photos atomically with the ledger commit', async () => {
  const h = await harness();
  await h.service.persist(draft({ attachments: [photo()] }));
  h.fail('DELETE FROM expense_draft_media');
  await assert.rejects(h.store.createExpenseWithAttachments(expense, [], 'draft-1'), /INJECTED/);
  assert.equal(h.store.getExpenses().length, 0);
  assert.equal((await (await harness(h.sql)).service.restore())?.attachments.length, 1);
  h.fail(null);
  await h.store.createExpenseWithAttachments(expense, [], 'draft-1');
  const reopened = await harness(h.sql);
  assert.equal(await reopened.service.restore(), null);
  assert.equal(reopened.store.getExpenses().length, 1);
  assert.equal((h.sql.prepare('SELECT COUNT(*) n FROM expense_draft_media').get() as any).n, 0);
});

test('confirmed Discard deletes recovered fields and photos and is idempotent', async () => {
  const h = await harness();
  await h.service.persist(draft({ attachments: [photo()] }));
  await h.service.discard('draft-1');
  await h.service.discard('draft-1');
  assert.equal(await (await harness(h.sql)).service.restore(), null);
  assert.equal((h.sql.prepare('SELECT COUNT(*) n FROM expense_draft_media').get() as any).n, 0);
});

test('failed draft write retains the last committed snapshot and can retry', async () => {
  const h = await harness();
  await h.service.persist(draft());
  h.fail('INSERT INTO expense_draft_media');
  await assert.rejects(h.service.persist(draft({ amountText: '99', attachments: [photo()] })), /INJECTED/);
  assert.equal((await (await harness(h.sql)).service.restore())?.amountText, '12.');
  h.fail(null);
  await h.service.persist(draft({ amountText: '99' }));
  assert.equal((await h.service.restore())?.amountText, '99');
});

test('serialized rapid writes and Discard do not resurrect a queued draft', async () => {
  const h = await harness();
  const writes = Array.from({ length: 12 }, (_, i) => h.service.persist(draft({ amountText: String(i) })));
  const discarded = h.service.discard('draft-1');
  await Promise.all([...writes, discarded]);
  assert.equal(await (await harness(h.sql)).service.restore(), null);
});

test('unlock during pending recovered Save waits for commit and cannot resurrect the editor', async () => {
  const h = await harness();
  await h.service.persist(draft({ attachments: [photo()] }));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const saving = h.service.commit(draft(), async () => {
    await pending;
    await h.store.createExpenseWithAttachments(expense, [], 'draft-1');
  });
  let restored = false;
  const reopening = h.service.restore().then(value => { restored = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(restored, false);
  release();
  await saving;
  assert.equal(await reopening, null);
  await h.service.persist(draft({ amountText: 'late unmounted callback' }));
  assert.equal(await h.service.restore(), null);
});

test('near-quota protected browser photo does not get duplicated into the Save journal', () => {
  const ciphertext = 'x'.repeat(700_000);
  const values = new Map<string, string>([[WEB_EXPENSE_DRAFT_KEY, ciphertext]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      const bytes = [...values].filter(([k]) => k !== key).reduce((n, [, v]) => n + v.length, value.length);
      if (bytes > 900_000) throw new Error('QUOTA_EXCEEDED');
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
  };
  persistWebFinancialState(storage, { expenses: [expense], budgets: [], attachments: [], currencyCode: 'USD' }, true);
  assert.equal(storage.getItem(WEB_EXPENSE_DRAFT_KEY), null);
  assert.equal(JSON.parse(storage.getItem('spendwise_expenses')!)[0].id, expense.id);
});

test('malformed recovery data leaves valid ledger usable and opaque work explicitly discardable', async () => {
  const values = new Map<string, string>([['spendwise_expenses', JSON.stringify([expense])], [WEB_EXPENSE_DRAFT_KEY, '{broken']]);
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k,v); }, removeItem: (k: string) => { values.delete(k); } };
  const store = new LocalDataStoreImpl();
  await store.init(storage);
  assert.equal(store.getExpenses()[0].description, 'Original');
  const service = new ExpenseDraftRecoveryService(store);
  await assert.rejects(service.restore());
  assert.equal(values.get(WEB_EXPENSE_DRAFT_KEY), '{broken');
  await service.discard();
  assert.equal(await service.restore(), null);
  assert.equal(store.getExpenses().length, 1);
});

test('camera/picker ownership survives editor destruction and unlock waits for encrypted handoff', async () => {
  const h = await harness();
  await h.service.persist(draft());
  let release!: (photos: ReturnType<typeof photo>[]) => void;
  const pending = new Promise<ReturnType<typeof photo>[]>(resolve => { release = resolve; });
  const acquiring = h.service.acquire(draft(), 'photos', 'en', () => pending);
  const staleEffect = h.service.persist(draft({ amountText: '13.' }));
  let finished = false;
  const unlock = h.service.restore().then(value => { finished = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(finished, false);
  release([photo()]);
  await Promise.all([acquiring, staleEffect]);
  const recovered = (await unlock)!;
  assert.equal(recovered.amountText, '13.');
  assert.equal(recovered.attachments.length, 1);
  assert.equal((h.sql.prepare('SELECT COUNT(*) n FROM expense_draft_media').get() as any).n, 1);
  const cancellation = await h.service.acquire(recovered, 'photos', 'en', async () => []);
  assert.equal(cancellation.length, 0);
  assert.equal((await h.service.restore())?.attachments.length, 1);
});

test('failed acquisition protects edits made while preparing and never acknowledges them early', async () => {
  const h = await harness();
  let reject!: (error: Error) => void;
  const pending = new Promise<ReturnType<typeof photo>[]>((_, fail) => { reject = fail; });
  const acquiring = h.service.acquire(draft(), 'photos', 'en', () => pending);
  let acknowledged = false;
  const writing = h.service.persist(draft({ amountText: '99' })).then(() => { acknowledged = true; });
  const writingFailure = assert.rejects(writing, /PICKER_READ_FAILED/);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(acknowledged, false);
  reject(new Error('PICKER_READ_FAILED'));
  await assert.rejects(acquiring, /PICKER_READ_FAILED/);
  await writingFailure;
  assert.equal((await h.service.restore())?.amountText, '99');
});

test('draft-wide acquisition single-flight preserves its owner across tools', async () => {
  const h = await harness();
  let release!: (photos: ReturnType<typeof photo>[]) => void;
  const pending = new Promise<ReturnType<typeof photo>[]>(resolve => { release = resolve; });
  const first = h.service.acquire(draft(), 'smart', 'en', () => pending);
  await assert.rejects(h.service.acquire(draft(), 'receipt', 'en', async () => [photo()]), /ACQUISITION_IN_PROGRESS/);
  release([photo()]);
  await first;
  const restored = (await h.service.restore())!;
  assert.notEqual(restored.smart?.photo, null);
  assert.equal(restored.receipt, null);
});

for (const cancel of [false, true]) test(`final acquisition write drains newer edits${cancel ? ' and explicit photo cancellation' : ''}`, async () => {
  const h = await harness();
  const write = h.store.writeExpenseDraft.bind(h.store);
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  let paused = false, accepted = true;
  h.store.writeExpenseDraft = async input => {
    if (input.draft.photos.length && !paused) { paused = true; started(); await gate; }
    await write(input);
  };
  const acquisition = h.service.acquire(draft(), 'smart', 'en', async () => [photo()], () => accepted);
  await entered;
  const latest = h.service.persist(draft({ amountText: '99' }));
  if (cancel) accepted = false;
  const unlock = h.service.restore();
  release();
  await Promise.all([acquisition, latest]);
  const restored = (await unlock)!;
  assert.equal(restored.amountText, '99');
  assert.equal(Boolean(restored.smart?.photo), !cancel);
});

test('interrupted Edit preserves identity and removals; failed Update leaves recovery intact', async () => {
  const h = await harness();
  await h.store.createExpenseWithAttachments(expense, []);
  const edit = draft({ expenseId: expense.id, expenseCreatedAt: expense.createdAt, descriptionText: 'Edited merchant', removedAttachmentIds: ['historical-proof'] });
  await h.service.persist(edit);
  assert.deepEqual(await (await harness(h.sql)).service.restore(), edit);
  h.fail('UPDATE expenses');
  await assert.rejects(h.store.updateExpenseWithAttachments({ ...expense, description: edit.descriptionText }, [], edit.id), /INJECTED/);
  assert.equal((await h.service.restore())?.descriptionText, 'Edited merchant');
  h.fail(null);
  await h.store.updateExpenseWithAttachments({ ...expense, description: edit.descriptionText }, [], edit.id);
  assert.equal(await h.service.restore(), null);
  assert.equal(h.store.getExpenses()[0].description, 'Edited merchant');
});

test('deleting the edited expense clears its recovery but unrelated deletion preserves Add', async () => {
  const h = await harness();
  await h.store.createExpenseWithAttachments(expense, []);
  await h.service.persist(draft({ expenseId: 1, expenseCreatedAt: expense.createdAt, attachments: [photo()] }));
  await h.store.deleteExpense(1);
  assert.equal(await h.service.restore(), null);
  await h.store.createExpenseWithAttachments(expense, []);
  await h.service.persist(draft());
  await h.store.deleteExpense(1);
  assert.notEqual(await h.service.restore(), null);
});

test('Clear All Data deletes draft fields and media alongside the ledger', async () => {
  const h = await harness();
  await h.service.persist(draft({ attachments: [photo()] }));
  await h.store.clearFinancialData();
  assert.equal(await (await harness(h.sql)).service.restore(), null);
  assert.equal((h.sql.prepare('SELECT COUNT(*) n FROM expense_draft_media').get() as any).n, 0);
});

test('failed Discard retains recoverable data and does not report success', async () => {
  const h = await harness();
  await h.service.persist(draft());
  h.fail('DELETE FROM app_meta');
  await assert.rejects(h.service.discard('draft-1'), /INJECTED/);
  assert.notEqual(await (await harness(h.sql)).service.restore(), null);
});

test('draft validation rejects missing photo references and excessive media', () => {
  assert.throws(() => validateStoredDraft({ ...draft(), attachmentIds: ['missing'], photos: [] }), /MEDIA_MISSING/);
  assert.throws(() => validateStoredDraft({ ...draft(), attachmentIds: [], photos: Array(11).fill({}) }), /DRAFT_INVALID/);
});

test('schema upgrade from v1 retains ledger and is idempotent', async () => {
  const h = await harness();
  await h.store.createExpenseWithAttachments(expense, []);
  h.sql.exec('DROP TABLE expense_draft_media; PRAGMA user_version=1');
  await applySpendWiseSchema(h.connection);
  await applySpendWiseSchema(h.connection);
  await assertSpendWiseDatabaseIntegrity(h.connection);
  assert.equal((h.sql.prepare('SELECT COUNT(*) n FROM expenses').get() as any).n, 1);
});

test('browser ledger transaction rolls back or forward the encrypted draft with Save', () => {
  const values = new Map<string,string>([[WEB_EXPENSE_DRAFT_KEY, 'ciphertext-only']]);
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => {values.set(k,v);}, removeItem: (k: string) => {values.delete(k);} };
  persistWebFinancialState(storage, { expenses: [expense], budgets: [], attachments: [], currencyCode: 'USD' }, true);
  assert.equal(storage.getItem(WEB_EXPENSE_DRAFT_KEY), null);
  const journal = { version: 1, phase: 'prepared', original: { expenses: '[]', budgets: '[]', attachments: null, currency: 'USD', draft: 'ciphertext-only' }, target: { expenses: JSON.stringify([expense]), budgets: '[]', attachments: null, currency: 'USD', draft: null } };
  storage.setItem('spendwise_financial_txn_v2', JSON.stringify(journal));
  recoverWebFinancialTransaction(storage);
  assert.equal(storage.getItem(WEB_EXPENSE_DRAFT_KEY), 'ciphertext-only');
  storage.setItem('spendwise_financial_txn_v2', JSON.stringify({ ...journal, phase: 'committed' }));
  recoverWebFinancialTransaction(storage);
  assert.equal(storage.getItem(WEB_EXPENSE_DRAFT_KEY), null);
});
