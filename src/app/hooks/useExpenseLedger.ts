import { useCallback, useState } from 'react';
import { Expense, MonthlyBudget } from '../../types';
import { getMonthKey, MonthYear } from '../../utils/date';
import { AttachmentEditPayload } from '../../utils/attachmentStorage';
import { expenseService } from '../../features/expenses/ExpenseService';

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
  const [expenses, setExpenses] = useState<Expense[]>(() => expenseService.listExpenses());
  const [budgets, setBudgets] = useState<MonthlyBudget[]>(() => expenseService.listBudgets());
  const [currencyCode, setCurrencyCode] = useState<string>(() => expenseService.getCurrencyCode());

  const refreshExpenses = useCallback((hiddenExpenseIds: number[] = []) => {
    setExpenses(filterVisibleExpenses(expenseService.listExpenses(), hiddenExpenseIds));
  }, []);

  const refreshFromStorage = useCallback((hiddenExpenseIds: number[] = []) => {
    setExpenses(filterVisibleExpenses(expenseService.listExpenses(), hiddenExpenseIds));
    setBudgets(expenseService.listBudgets());
    setCurrencyCode(expenseService.getCurrencyCode());
  }, []);

  const addExpense = useCallback(async (
    input: ExpenseMutationInput,
    hiddenExpenseIds: number[] = []
  ) => {
    await expenseService.create(
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
    if (!existing) throw new Error('EXPENSE_NOT_FOUND');

    await expenseService.update(
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
    await expenseService.upsertBudget(getMonthKey(monthYear), amount);
    setBudgets(expenseService.listBudgets());
  }, []);

  const changeCurrency = useCallback(async (
    code: string,
    targetUnitsPerSourceUnit?: number
  ) => {
    await expenseService.changeCurrency(code, targetUnitsPerSourceUnit);
    refreshFromStorage();
  }, [refreshFromStorage]);

  const clearAllData = useCallback(async () => {
    await expenseService.clearAllData();
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
