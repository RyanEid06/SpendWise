import { Expense, ExpenseAttachment, MonthlyBudget } from '../types';
import { LocalDataStore } from '../utils/localDataStore';

export interface ExpenseRepository {
  list(): Expense[];
  nextId(): number;
  createWithAttachments(expense: Expense, attachments: ExpenseAttachment[], draftId?: string): Promise<void>;
  updateWithAttachments(expense: Expense, attachments: ExpenseAttachment[], draftId?: string): Promise<void>;
  deleteMany(ids: number[]): Promise<ExpenseAttachment[]>;
  getCurrencyCode(): string;
  setCurrencyCode(currencyCode: string): Promise<void>;
  replaceLedgerAmountsAndCurrency(
    expenses: Expense[],
    budgets: MonthlyBudget[],
    currencyCode: string
  ): Promise<void>;
  clearFinancialData(): Promise<ExpenseAttachment[]>;
}

export class LocalExpenseRepository implements ExpenseRepository {
  list(): Expense[] {
    return LocalDataStore.getExpenses();
  }

  nextId(): number {
    return LocalDataStore.nextExpenseId();
  }

  createWithAttachments(expense: Expense, attachments: ExpenseAttachment[], draftId?: string): Promise<void> {
    return LocalDataStore.createExpenseWithAttachments(expense, attachments, draftId);
  }

  updateWithAttachments(expense: Expense, attachments: ExpenseAttachment[], draftId?: string): Promise<void> {
    return LocalDataStore.updateExpenseWithAttachments(expense, attachments, draftId);
  }

  deleteMany(ids: number[]): Promise<ExpenseAttachment[]> {
    return LocalDataStore.deleteExpenses(ids);
  }

  getCurrencyCode(): string {
    return LocalDataStore.getCurrencyCode();
  }

  setCurrencyCode(currencyCode: string): Promise<void> {
    return LocalDataStore.setCurrencyCode(currencyCode);
  }

  replaceLedgerAmountsAndCurrency(
    expenses: Expense[],
    budgets: MonthlyBudget[],
    currencyCode: string
  ): Promise<void> {
    return LocalDataStore.replaceLedgerAmountsAndCurrency(expenses, budgets, currencyCode);
  }

  clearFinancialData(): Promise<ExpenseAttachment[]> {
    return LocalDataStore.clearFinancialData();
  }
}

export const expenseRepository: ExpenseRepository = new LocalExpenseRepository();
