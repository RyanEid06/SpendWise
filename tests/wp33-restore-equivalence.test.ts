import test from 'node:test';
import assert from 'node:assert/strict';
import type { Expense } from '../src/types';
import { createSyntheticLedger, FIXTURE_CLOCK } from '../scripts/wp33/fixtures';
import { planBackupV2Restore, type BackupV2Manifest } from '../src/utils/backupV2';
import type { FinancialState } from '../src/utils/financialState';
import { referencePlanBackupV2Restore } from './helpers/wp33-reference-planner';

function manifest(state: FinancialState): BackupV2Manifest {
  return { format: 'spendwise-backup-v2', backupSchemaVersion: 2, appVersion: '2.0.0', exportedAt: FIXTURE_CLOCK, exportedAtFormatted: '2026-10-05', mediaIncluded: false, counts: { expenses: state.expenses.length, budgets: state.budgets.length, attachments: 0, mediaFiles: 0, mediaBytes: 0 }, settings: { currencyCode: state.currencyCode, language: 'en', themeMode: 'SYSTEM' }, expenses: state.expenses.map((item) => ({ ...item, dateFormatted: 'synthetic' })), monthlyBudgets: state.budgets, attachments: [] };
}
function equivalent(source: FinancialState, existing: FinancialState, replace = false) {
  const input = manifest(source); const before = JSON.stringify({ input, existing });
  assert.deepEqual(planBackupV2Restore(input, existing, replace), referencePlanBackupV2Restore(input, existing, replace));
  assert.equal(JSON.stringify({ input, existing }), before);
}
for (const size of [0, 100, 1000, 5000]) {
  test(`indexed restore is equivalent to immutable original planner for seeded ${size}-entry merges`, () => {
    equivalent(createSyntheticLedger(size, 3), createSyntheticLedger(size, 4));
    equivalent(createSyntheticLedger(size, 3), createSyntheticLedger(size, 3));
  });
}
test('both duplicate predicates preserve strict tolerance across bucket boundaries and numeric scales', () => {
  const base = createSyntheticLedger(1).expenses[0];
  for (const amount of [0.01, 1, 1.0009999, 100, 10000, 1e10, Number.MAX_SAFE_INTEGER / 100 - 1]) {
    for (const delta of [-0.0010001, -0.001, -0.0009999, 0, 0.0009999, 0.001, 0.0010001]) {
      for (const predicate of ['createdAt', 'content'] as const) {
        const existing = { ...createSyntheticLedger(0), expenses: [{ ...base, amount }] };
        const incoming: Expense = { ...base, id: 2, amount: amount + delta, createdAt: predicate === 'createdAt' ? base.createdAt : base.createdAt + 1, date: predicate === 'content' ? base.date : base.date + 86400000, description: predicate === 'content' ? `  ${base.description.toUpperCase()}  ` : 'Different', category: ` ${base.category.toUpperCase()} ` };
        const source = { ...createSyntheticLedger(0), expenses: [incoming] };
        equivalent(source, existing);
        assert.equal(planBackupV2Restore(manifest(source), existing, false).expensesSkipped, Math.abs(incoming.amount - amount) < 0.001 ? 1 : 0);
      }
    }
  }
});
test('duplicates within import, trimming, conflicting IDs and skipped media mappings preserve order', () => {
  const source = createSyntheticLedger(200);
  source.expenses = source.expenses.map((item, index) => ({ ...item, amount: 12 + (index % 5) * 0.0004, date: source.expenses[0].date, createdAt: source.expenses[0].createdAt + index % 3, description: index % 2 ? ' Fixture ' : 'fixture', category: index % 2 ? ' FOOD ' : 'food', note: '  synthetic  ' }));
  const existing = createSyntheticLedger(100);
  existing.expenses[0].id = 2000;
  equivalent(source, existing); equivalent(source, existing, true);
  const plan = planBackupV2Restore(manifest(source), existing, false);
  for (const id of plan.skippedExpenseIds) assert.equal(plan.expenseIdMap.has(id), false);
  assert.equal(new Set(plan.nextExpenses.map((item) => item.id)).size, plan.nextExpenses.length);
});
test('non-duplicate imports sharing timestamps remain equivalent at large collision density', () => {
  const source = createSyntheticLedger(1000);
  source.expenses = source.expenses.map((item, index) => ({ ...item, amount: index + 1, date: FIXTURE_CLOCK, createdAt: FIXTURE_CLOCK, description: 'Same', category: 'Same' }));
  equivalent(source, createSyntheticLedger(0));
});
test('currency mismatch rejection and empty/replace adoption match original planner', () => {
  const source = createSyntheticLedger(100); source.currencyCode = 'EUR';
  const existing = createSyntheticLedger(1000);
  assert.throws(() => planBackupV2Restore(manifest(source), existing, false), /BACKUP_CURRENCY_MISMATCH/);
  assert.throws(() => referencePlanBackupV2Restore(manifest(source), existing, false), /BACKUP_CURRENCY_MISMATCH/);
  equivalent(source, existing, true); equivalent(source, createSyntheticLedger(0));
});
