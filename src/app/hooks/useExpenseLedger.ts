import { useCallback, useState } from 'react';
import { Expense, MonthlyBudget } from '../../types';
import { getMonthKey, MonthYear } from '../../utils/date';
import { AttachmentEditPayload } from '../../utils/attachmentStorage';
import { StorageManager } from '../../utils/storage';

export interface ExpenseMutationInput {
  amount: number;
  description: string;
  category: string;
  date: number;
  note: string | null;
  attachmentChanges: AttachmentEditPayload;
}

export function filterVisibleExpenses(expenses: Expense[], hiddenExpenseIds: number[]): Expense[] {
  if (hiddenExpenseIds.length === 0) return expenses;
  const hidden = new Set(hiddenExpenseIds);
  return expenses.filter((expense) => !hidden.has(expense.id));
}

export function useExpenseLedger() {
  const [expenses, setExpenses] = useState<Expense[]>(() => StorageManager.getExpenses());
  const [budgets, setBudgets] = useState<MonthlyBudget[]>(() => StorageManager.getBudgets());
  const [currencyCode, setCurrencyCode] = useState<string>(() => StorageManager.getCurrencyCode());

  const refreshExpenses = useCallback((hiddenExpenseIds: number[] = []) => {
    setExpenses(filterVisibleExpenses(StorageManager.getExpenses(), hiddenExpenseIds));
  }, []);

  const refreshFromStorage = useCallback((hiddenExpenseIds: number[] = []) => {
    setExpenses(filterVisibleExpenses(StorageManager.getExpenses(), hiddenExpenseIds));
    setBudgets(StorageManager.getBudgets());
    setCurrencyCode(StorageManager.getCurrencyCode());
  }, []);

  const addExpense = useCallback(async (
    input: ExpenseMutationInput,
    hiddenExpenseIds: number[] = []
  ) => {
    await StorageManager.addExpense(
      {
        amount: input.amount,
        description: input.description,
        category: input.category,
        date: input.date,
        note: input.note,
      },
      input.attachmentChanges
    );
    refreshExpenses(hiddenExpenseIds);
  }, [refreshExpenses]);

  const updateExpense = useCallback(async (
    id: number,
    input: ExpenseMutationInput,
    hiddenExpenseIds: number[] = []
  ) => {
    const existing = expenses.find((expense) => expense.id === id);
    if (!existing) return;

    await StorageManager.updateExpense(
      {
        ...existing,
        amount: input.amount,
        description: input.description,
        category: input.category,
        date: input.date,
        note: input.note,
      },
      input.attachmentChanges
    );
    refreshExpenses(hiddenExpenseIds);
  }, [expenses, refreshExpenses]);

  const setStartingMoney = useCallback(async (monthYear: MonthYear, amount: number) => {
    await StorageManager.setBudget(getMonthKey(monthYear), amount);
    setBudgets(StorageManager.getBudgets());
  }, []);

  const changeCurrency = useCallback(async (
    code: string,
    targetUnitsPerSourceUnit?: number
  ) => {
    const storedExpenses = StorageManager.getExpenses();
    const storedBudgets = StorageManager.getBudgets();
    const hasFinancialData = storedExpenses.length > 0 || storedBudgets.length > 0;

    if (code === StorageManager.getCurrencyCode()) return;

    if (hasFinancialData) {
      if (targetUnitsPerSourceUnit === undefined) {
        throw new Error('A conversion rate is required for an existing financial ledger.');
      }
      await StorageManager.convertCurrency(code, targetUnitsPerSourceUnit);
    } else {
      await StorageManager.setCurrencyCode(code);
      StorageManager.clearAnalysisCache();
    }

    refreshFromStorage();
  }, [refreshFromStorage]);

  const clearAllData = useCallback(async () => {
    await StorageManager.clearAllData();
    setExpenses([]);
    setBudgets([]);
  }, []);

  return {
    expenses,
    budgets,
    currencyCode,
    setExpenses,
    refreshExpenses,
    refreshFromStorage,
    addExpense,
    updateExpense,
    setStartingMoney,
    changeCurrency,
    clearAllData,
  };
}
