// Immutable WP33 reference: original planner at a146675, preserved before optimization.
import type { Expense, ExpenseBackupItem, MonthlyBudget } from '../../src/types';
import { validateFinancialState, type FinancialState } from '../../src/utils/financialState';
import type { BackupV2Manifest, BackupV2RestorePlan } from '../../src/utils/backupV2';
function normalizeBackupExpense(item: ExpenseBackupItem): Expense {
  return {
    id: item.id,
    amount: item.amount,
    description: item.description.trim(),
    category: item.category.trim(),
    date: item.date,
    note: item.note?.trim() || null,
    createdAt: item.createdAt,
  };
}

function isDuplicateExpense(incoming: ExpenseBackupItem, existing: Expense[]): boolean {
  return existing.some(
    (expense) =>
      (incoming.createdAt === expense.createdAt && Math.abs(incoming.amount - expense.amount) < 0.001) ||
      (incoming.date === expense.date &&
        Math.abs(incoming.amount - expense.amount) < 0.001 &&
        expense.description.trim().toLowerCase() === incoming.description.trim().toLowerCase() &&
        expense.category.trim().toLowerCase() === incoming.category.trim().toLowerCase())
  );
}
export function referencePlanBackupV2Restore(
  manifest: BackupV2Manifest,
  existingState: FinancialState,
  replaceExisting: boolean
): BackupV2RestorePlan {
  const current = validateFinancialState(existingState);
  const currentHasFinancialData = current.expenses.length > 0 || current.budgets.length > 0;
  const backupHasFinancialData = manifest.expenses.length > 0 || manifest.monthlyBudgets.length > 0;

  if (
    !replaceExisting &&
    currentHasFinancialData &&
    backupHasFinancialData &&
    manifest.settings.currencyCode !== current.currencyCode
  ) {
    throw new Error('BACKUP_CURRENCY_MISMATCH');
  }

  const expenseIdMap = new Map<number, number>();
  const skippedExpenseIds = new Set<number>();
  const importedExpenses: Expense[] = [];
  const knownExpenses = replaceExisting ? [] : current.expenses.map((item) => ({ ...item }));
  let maxId = knownExpenses.reduce((max, expense) => Math.max(max, expense.id), 0);

  for (const incoming of manifest.expenses) {
    if (!replaceExisting && isDuplicateExpense(incoming, knownExpenses)) {
      skippedExpenseIds.add(incoming.id);
      continue;
    }

    let targetId = incoming.id;
    if (!replaceExisting) {
      const conflict = knownExpenses.some((expense) => expense.id === targetId);
      if (conflict) {
        targetId = ++maxId;
      } else {
        maxId = Math.max(maxId, targetId);
      }
    }

    const imported = { ...normalizeBackupExpense(incoming), id: targetId };
    expenseIdMap.set(incoming.id, targetId);
    importedExpenses.push(imported);
    knownExpenses.push(imported);
  }

  const nextExpenses = replaceExisting
    ? importedExpenses
    : [...importedExpenses, ...current.expenses.map((item) => ({ ...item }))];

  const budgetMap = new Map<string, MonthlyBudget>();
  if (!replaceExisting) current.budgets.forEach((budget) => budgetMap.set(budget.monthKey, { ...budget }));
  let budgetsImported = 0;
  for (const incoming of manifest.monthlyBudgets) {
    if (!replaceExisting && budgetMap.has(incoming.monthKey)) continue;
    budgetMap.set(incoming.monthKey, { ...incoming });
    budgetsImported++;
  }

  const adoptBackupCurrency = replaceExisting || (!currentHasFinancialData && backupHasFinancialData);
  return {
    nextExpenses,
    nextBudgets: Array.from(budgetMap.values()),
    expenseIdMap,
    skippedExpenseIds,
    expensesImported: importedExpenses.length,
    expensesSkipped: skippedExpenseIds.size,
    budgetsImported,
    currencyCode: adoptBackupCurrency ? manifest.settings.currencyCode : current.currencyCode,
    currencyUpdated: adoptBackupCurrency ? manifest.settings.currencyCode : null,
  };
}
