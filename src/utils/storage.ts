import {
  AiAnalysisResult,
  Expense,
  ImportSummary,
  MonthlyBudget,
  SpendWiseBackup,
  ThemeMode,
} from '../types';
import { currentMonthYear, formatDate, getMonthKey, MonthYear, previousMonth } from './date';
import { DEFAULT_CURRENCY_CODE } from './currency';

const STORAGE_KEYS = {
  EXPENSES: 'spendwise_expenses',
  BUDGETS: 'spendwise_budgets',
  CURRENCY: 'spendwise_currency',
  THEME: 'spendwise_theme',
  APP_LOCK: 'spendwise_app_lock_enabled',
  LOCK_TIMEOUT: 'spendwise_lock_timeout_seconds',
  LOCK_PIN: 'spendwise_lock_pin',
  AI_CACHE: 'spendwise_ai_insights_cache',
  INITIALIZED: 'spendwise_initialized_v2',
};

// Seed realistic data for the user so they can immediately see the dashboard and AI insights
function getInitialSeedData(): { expenses: Expense[]; budgets: MonthlyBudget[] } {
  const current = currentMonthYear();
  const prev1 = previousMonth(current);
  const prev2 = previousMonth(prev1);

  const curKey = getMonthKey(current);
  const prev1Key = getMonthKey(prev1);
  const prev2Key = getMonthKey(prev2);

  const budgets: MonthlyBudget[] = [
    { monthKey: curKey, startingAmount: 2500, updatedAt: Date.now() },
    { monthKey: prev1Key, startingAmount: 2400, updatedAt: Date.now() - 30 * 86400000 },
    { monthKey: prev2Key, startingAmount: 2400, updatedAt: Date.now() - 60 * 86400000 },
  ];

  // Helper to make dates within a month
  const makeDate = (my: MonthYear, day: number) => new Date(my.year, my.month - 1, day, 14, 0).getTime();

  let idCounter = 1;
  const expenses: Expense[] = [
    // Current Month expenses
    { id: idCounter++, amount: 78.50, description: 'Whole Foods Market', category: 'Groceries', date: makeDate(current, 3), note: 'Fresh produce, milk, cereal', createdAt: Date.now() },
    { id: idCounter++, amount: 14.25, description: 'Starbucks Coffee', category: 'Food', date: makeDate(current, 4), note: 'Morning latte & pastry', createdAt: Date.now() },
    { id: idCounter++, amount: 45.00, description: 'Shell Gas Station', category: 'Transportation', date: makeDate(current, 5), note: 'Fuel refill', createdAt: Date.now() },
    { id: idCounter++, amount: 15.99, description: 'Netflix Subscription', category: 'Subscriptions', date: makeDate(current, 8), note: 'Monthly 4K streaming plan', createdAt: Date.now() },
    { id: idCounter++, amount: 124.80, description: 'Carrefour Supermarket', category: 'Groceries', date: makeDate(current, 10), note: 'Bi-weekly family supplies', createdAt: Date.now() },
    { id: idCounter++, amount: 14.50, description: 'Starbucks Coffee', category: 'Food', date: makeDate(current, 12), note: 'Cold brew & snack', createdAt: Date.now() },
    { id: idCounter++, amount: 89.00, description: 'City Water & Power', category: 'Bills', date: makeDate(current, 14), note: 'Monthly utility bill', createdAt: Date.now() },
    { id: idCounter++, amount: 32.50, description: 'Cinema City Tickets', category: 'Entertainment', date: makeDate(current, 16), note: 'Weekend movie night', createdAt: Date.now() },
    { id: idCounter++, amount: 13.90, description: 'Starbucks Coffee', category: 'Food', date: makeDate(current, 18), note: 'Afternoon coffee', createdAt: Date.now() },
    { id: idCounter++, amount: 280.00, description: 'Apple Store', category: 'Electronics', date: makeDate(current, 19), note: 'AirPods Pro replacement', createdAt: Date.now() },
    { id: idCounter++, amount: 56.40, description: 'Trader Joe\'s', category: 'Groceries', date: makeDate(current, 21), note: 'Snacks and fruits', createdAt: Date.now() },
    { id: idCounter++, amount: 65.00, description: 'Pharmacy Prescription', category: 'Health', date: makeDate(current, 22), note: 'Vitamins and prescription', createdAt: Date.now() },

    // Previous Month 1 expenses
    { id: idCounter++, amount: 110.00, description: 'Costco Wholesale', category: 'Groceries', date: makeDate(prev1, 2), note: 'Bulk goods', createdAt: Date.now() - 30 * 86400000 },
    { id: idCounter++, amount: 48.00, description: 'Shell Gas Station', category: 'Transportation', date: makeDate(prev1, 5), note: 'Gasoline', createdAt: Date.now() - 30 * 86400000 },
    { id: idCounter++, amount: 15.99, description: 'Netflix Subscription', category: 'Subscriptions', date: makeDate(prev1, 8), note: 'Subscription', createdAt: Date.now() - 30 * 86400000 },
    { id: idCounter++, amount: 92.50, description: 'Carrefour Supermarket', category: 'Groceries', date: makeDate(prev1, 12), note: 'Groceries', createdAt: Date.now() - 30 * 86400000 },
    { id: idCounter++, amount: 84.00, description: 'City Water & Power', category: 'Bills', date: makeDate(prev1, 15), note: 'Electricity', createdAt: Date.now() - 30 * 86400000 },
    { id: idCounter++, amount: 45.00, description: 'Dinner with Colleagues', category: 'Food', date: makeDate(prev1, 18), note: 'Italian dinner', createdAt: Date.now() - 30 * 86400000 },
    { id: idCounter++, amount: 120.00, description: 'Running Shoes', category: 'Shopping', date: makeDate(prev1, 24), note: 'Sports shoes', createdAt: Date.now() - 30 * 86400000 },

    // Previous Month 2 expenses
    { id: idCounter++, amount: 130.00, description: 'Supermarket Groceries', category: 'Groceries', date: makeDate(prev2, 4), note: 'Monthly groceries', createdAt: Date.now() - 60 * 86400000 },
    { id: idCounter++, amount: 80.00, description: 'Internet Fiber', category: 'Bills', date: makeDate(prev2, 10), note: 'High speed internet', createdAt: Date.now() - 60 * 86400000 },
    { id: idCounter++, amount: 15.99, description: 'Netflix Subscription', category: 'Subscriptions', date: makeDate(prev2, 8), note: 'Streaming', createdAt: Date.now() - 60 * 86400000 },
    { id: idCounter++, amount: 55.00, description: 'Commuter Train Pass', category: 'Transportation', date: makeDate(prev2, 15), note: 'Monthly transit card', createdAt: Date.now() - 60 * 86400000 },
  ];

  return { expenses, budgets };
}

export class StorageManager {
  static init() {
    if (typeof window === 'undefined') return;
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInit) {
      const seed = getInitialSeedData();
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(seed.expenses));
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(seed.budgets));
      localStorage.setItem(STORAGE_KEYS.CURRENCY, DEFAULT_CURRENCY_CODE);
      localStorage.setItem(STORAGE_KEYS.THEME, 'SYSTEM');
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  }

  static getExpenses(): Expense[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveExpenses(expenses: Expense[]) {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  }

  static addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
    const expenses = this.getExpenses();
    const newId = expenses.length > 0 ? Math.max(...expenses.map((e) => e.id)) + 1 : 1;
    const newExpense: Expense = {
      ...expense,
      id: newId,
      createdAt: Date.now(),
    };
    expenses.unshift(newExpense);
    this.saveExpenses(expenses);
    return newExpense;
  }

  static updateExpense(updated: Expense) {
    const expenses = this.getExpenses();
    const index = expenses.findIndex((e) => e.id === updated.id);
    if (index !== -1) {
      expenses[index] = updated;
      this.saveExpenses(expenses);
    }
  }

  static deleteExpense(id: number) {
    const expenses = this.getExpenses();
    const filtered = expenses.filter((e) => e.id !== id);
    this.saveExpenses(filtered);
  }

  static getBudgets(): MonthlyBudget[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveBudgets(budgets: MonthlyBudget[]) {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  }

  static setBudget(monthKey: string, startingAmount: number) {
    const budgets = this.getBudgets();
    const index = budgets.findIndex((b) => b.monthKey === monthKey);
    if (index !== -1) {
      budgets[index].startingAmount = startingAmount;
      budgets[index].updatedAt = Date.now();
    } else {
      budgets.push({
        monthKey,
        startingAmount,
        updatedAt: Date.now(),
      });
    }
    this.saveBudgets(budgets);
  }

  static getCurrencyCode(): string {
    return localStorage.getItem(STORAGE_KEYS.CURRENCY) || DEFAULT_CURRENCY_CODE;
  }

  static setCurrencyCode(code: string) {
    localStorage.setItem(STORAGE_KEYS.CURRENCY, code);
  }

  static getThemeMode(): ThemeMode {
    return (localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode) || 'SYSTEM';
  }

  static setThemeMode(mode: ThemeMode) {
    localStorage.setItem(STORAGE_KEYS.THEME, mode);
  }

  static isAppLockEnabled(): boolean {
    return localStorage.getItem(STORAGE_KEYS.APP_LOCK) === 'true';
  }

  static setAppLockEnabled(enabled: boolean) {
    localStorage.setItem(STORAGE_KEYS.APP_LOCK, enabled ? 'true' : 'false');
  }

  static getLockTimeoutSeconds(): number {
    const val = localStorage.getItem(STORAGE_KEYS.LOCK_TIMEOUT);
    return val ? parseInt(val, 10) : 300; // default 5 minutes
  }

  static setLockTimeoutSeconds(seconds: number) {
    localStorage.setItem(STORAGE_KEYS.LOCK_TIMEOUT, seconds.toString());
  }

  static getLockPin(): string {
    return localStorage.getItem(STORAGE_KEYS.LOCK_PIN) || '1234';
  }

  static setLockPin(pin: string) {
    localStorage.setItem(STORAGE_KEYS.LOCK_PIN, pin);
  }

  static getCachedAnalysis(monthKey: string): AiAnalysisResult | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.AI_CACHE}_${monthKey}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static cacheAnalysis(result: AiAnalysisResult) {
    try {
      localStorage.setItem(
        `${STORAGE_KEYS.AI_CACHE}_${result.analyzedMonthKey}`,
        JSON.stringify(result)
      );
    } catch {}
  }

  static clearAllData() {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([]));
    // Clear all analysis caches
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.AI_CACHE)) {
        localStorage.removeItem(key);
      }
    }
  }

  // Generate full SpendWise v2.0 backup JSON
  static createBackupJson(): SpendWiseBackup {
    const expenses = this.getExpenses();
    const budgets = this.getBudgets();
    const currencyCode = this.getCurrencyCode();
    const themeMode = this.getThemeMode();

    const now = Date.now();
    return {
      metadata: {
        appVersion: '2.0',
        exportedAt: now,
        exportedAtFormatted: new Date(now).toISOString().replace('T', ' ').substring(0, 19),
        totalExpenses: expenses.length,
        totalBudgets: budgets.length,
      },
      settings: {
        currencyCode,
        themeMode,
      },
      monthlyBudgets: budgets.map((b) => ({
        monthKey: b.monthKey,
        startingAmount: b.startingAmount,
        updatedAt: b.updatedAt,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        amount: e.amount,
        description: e.description,
        category: e.category,
        date: e.date,
        dateFormatted: formatDate(e.date),
        note: e.note || null,
        createdAt: e.createdAt,
      })),
    };
  }

  // Generate CSV export
  static createCsvExport(): string {
    const expenses = this.getExpenses();
    const currencyCode = this.getCurrencyCode();

    const lines: string[] = ['ID,Date,Description,Category,Amount,Currency,Note,Created_At'];
    for (const e of expenses) {
      const dateFmt = formatDate(e.date);
      const desc = escapeCsv(e.description);
      const cat = escapeCsv(e.category);
      const note = escapeCsv(e.note || '');
      const line = `${e.id},"${dateFmt}",${desc},${cat},${e.amount.toFixed(2)},${currencyCode},${note},${e.createdAt}`;
      lines.push(line);
    }
    return lines.join('\n');
  }

  // Restore or merge backup
  static restoreBackup(backup: SpendWiseBackup, replaceExisting: boolean): ImportSummary {
    let currentExpenses = replaceExisting ? [] : this.getExpenses();
    let currentBudgets = replaceExisting ? [] : this.getBudgets();

    let maxId = currentExpenses.length > 0 ? Math.max(...currentExpenses.map((e) => e.id)) : 0;

    const importedExpenses: Expense[] = backup.expenses.map((b) => {
      maxId++;
      return {
        id: replaceExisting ? b.id : maxId,
        amount: b.amount,
        description: b.description,
        category: b.category,
        date: b.date,
        note: b.note || null,
        createdAt: b.createdAt || Date.now(),
      };
    });

    const mergedExpenses = replaceExisting
      ? importedExpenses
      : [...importedExpenses, ...currentExpenses];
    this.saveExpenses(mergedExpenses);

    // Merge budgets by monthKey
    const budgetMap: Record<string, MonthlyBudget> = {};
    if (!replaceExisting) {
      for (const b of currentBudgets) {
        budgetMap[b.monthKey] = b;
      }
    }
    for (const b of backup.monthlyBudgets) {
      budgetMap[b.monthKey] = {
        monthKey: b.monthKey,
        startingAmount: b.startingAmount,
        updatedAt: b.updatedAt || Date.now(),
      };
    }
    this.saveBudgets(Object.values(budgetMap));

    if (backup.settings?.currencyCode) {
      this.setCurrencyCode(backup.settings.currencyCode);
    }

    return {
      expensesImported: importedExpenses.length,
      budgetsImported: backup.monthlyBudgets.length,
      currencyUpdated: backup.settings?.currencyCode || null,
      wasReplaced: replaceExisting,
    };
  }
}

function escapeCsv(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
