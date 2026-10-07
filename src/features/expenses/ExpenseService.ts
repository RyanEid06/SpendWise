import { Expense, MonthlyBudget } from '../../types';
import { normalizeCategoryName } from '../../utils/categories';
import { AttachmentEditPayload } from '../../utils/attachmentStorage';
import {
  convertCurrencyAmount,
  isValidConversionRate,
  SUPPORTED_CURRENCIES,
} from '../../utils/currency';
import { getMonthKey, getMonthYearFromTimestamp } from '../../utils/date';
import { analysisCacheService } from '../../services/AnalysisCacheService';
import { budgetRepository, BudgetRepository } from '../../data/BudgetRepository';
import { expenseRepository, ExpenseRepository } from '../../data/ExpenseRepository';
import { mediaService, MediaService } from '../../services/MediaService';

export interface ExpenseCreateInput {
  amount: number;
  description: string;
  category: string;
  date: number;
  note: string | null;
}

export interface CurrencyConversionResult {
  sourceCurrencyCode: string;
  targetCurrencyCode: string;
  expensesConverted: number;
  budgetsConverted: number;
}

export class ExpenseService {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly budgets: BudgetRepository,
    private readonly media: MediaService,
  ) {}

  listExpenses(): Expense[] {
    return this.expenses.list();
  }

  listBudgets(): MonthlyBudget[] {
    return this.budgets.list();
  }

  getCurrencyCode(): string {
    return this.expenses.getCurrencyCode();
  }

  async create(
    input: ExpenseCreateInput,
    attachmentChanges: AttachmentEditPayload
  ): Promise<Expense> {
    const expense: Expense = {
      ...input,
      category: normalizeCategoryName(input.category),
      id: this.expenses.nextId(),
      createdAt: Date.now(),
    };
    const prepared = await this.media.prepareExpenseAttachmentChanges(
      expense.id,
      attachmentChanges.newAttachments,
      []
    );

    try {
      await this.expenses.createWithAttachments(expense, prepared.nextAttachments);
    } catch (error) {
      await this.media.deleteDetachedFiles(prepared.stagedAttachments);
      throw error;
    }

    this.invalidateExpenseMonths([expense.date]);
    return expense;
  }

  async update(
    updated: Expense,
    attachmentChanges: AttachmentEditPayload
  ): Promise<void> {
    updated = { ...updated, category: normalizeCategoryName(updated.category) };
    const previous = this.expenses.list().find((expense) => expense.id === updated.id);
    if (!previous) return;

    const prepared = await this.media.prepareExpenseAttachmentChanges(
      updated.id,
      attachmentChanges.newAttachments,
      attachmentChanges.removedAttachmentIds
    );

    try {
      await this.expenses.updateWithAttachments(updated, prepared.nextAttachments);
    } catch (error) {
      await this.media.deleteDetachedFiles(prepared.stagedAttachments);
      throw error;
    }

    await this.media.deleteDetachedFiles(prepared.removedAttachments);
    this.invalidateExpenseMonths([previous.date, updated.date]);
  }

  async permanentDelete(ids: number[]): Promise<void> {
    const idSet = new Set(ids);
    const deleted = this.expenses.list().filter((expense) => idSet.has(expense.id));
    if (deleted.length === 0) return;

    const detached = await this.expenses.deleteMany(deleted.map((expense) => expense.id));
    await this.media.deleteDetachedFiles(detached);
    this.invalidateExpenseMonths(deleted.map((expense) => expense.date));
  }

  async upsertBudget(monthKey: string, startingAmount: number): Promise<void> {
    await this.budgets.upsert(monthKey, startingAmount, Date.now());
  }

  async changeCurrency(
    targetCurrencyCode: string,
    targetUnitsPerSourceUnit?: number
  ): Promise<CurrencyConversionResult> {
    const sourceCurrencyCode = this.getCurrencyCode().toUpperCase();
    const target = targetCurrencyCode.toUpperCase();
    const isSupported = (code: string) =>
      SUPPORTED_CURRENCIES.some((currency) => currency.code === code);

    if (!isSupported(sourceCurrencyCode) || !isSupported(target)) {
      throw new Error('Unsupported source or target currency.');
    }
    if (sourceCurrencyCode === target) {
      return {
        sourceCurrencyCode,
        targetCurrencyCode: target,
        expensesConverted: 0,
        budgetsConverted: 0,
      };
    }

    const currentExpenses = this.expenses.list();
    const currentBudgets = this.budgets.list();
    const hasFinancialData = currentExpenses.length > 0 || currentBudgets.length > 0;

    if (!hasFinancialData) {
      await this.expenses.setCurrencyCode(target);
      analysisCacheService.clear();
      return {
        sourceCurrencyCode,
        targetCurrencyCode: target,
        expensesConverted: 0,
        budgetsConverted: 0,
      };
    }

    if (targetUnitsPerSourceUnit === undefined) {
      throw new Error('A conversion rate is required for an existing financial ledger.');
    }
    if (!isValidConversionRate(targetUnitsPerSourceUnit)) {
      throw new Error('Invalid currency conversion rate.');
    }

    const convertedExpenses = currentExpenses.map((expense) => ({
      ...expense,
      amount: convertCurrencyAmount(expense.amount, targetUnitsPerSourceUnit),
    }));
    const convertedBudgets = currentBudgets.map((budget) => ({
      ...budget,
      startingAmount: convertCurrencyAmount(budget.startingAmount, targetUnitsPerSourceUnit),
    }));

    await this.expenses.replaceLedgerAmountsAndCurrency(
      convertedExpenses,
      convertedBudgets,
      target
    );
    analysisCacheService.clear();

    return {
      sourceCurrencyCode,
      targetCurrencyCode: target,
      expensesConverted: convertedExpenses.length,
      budgetsConverted: convertedBudgets.length,
    };
  }

  async clearAllData(): Promise<void> {
    const detached = await this.expenses.clearFinancialData();
    analysisCacheService.clear();
    await this.media.deleteDetachedFiles(detached);
  }

  clearAnalysisCache(): void {
    analysisCacheService.clear();
  }

  private invalidateExpenseMonths(timestamps: number[]): void {
    new Set(
      timestamps.map((timestamp) => getMonthKey(getMonthYearFromTimestamp(timestamp)))
    ).forEach((monthKey) => analysisCacheService.invalidate(monthKey));
  }
}

export const expenseService = new ExpenseService(
  expenseRepository,
  budgetRepository,
  mediaService
);
