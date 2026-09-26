import {
  AiAnalysisResult,
  Expense,
  ImportSummary,
  Language,
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
  LANGUAGE: 'spendwise_language',
  APP_LOCK: 'spendwise_app_lock_enabled',
  LOCK_TIMEOUT: 'spendwise_lock_timeout_seconds',
  LOCK_PIN: 'spendwise_lock_pin',
  AI_CACHE: 'spendwise_ai_insights_cache',
  INITIALIZED: 'spendwise_clean_init_v3',
};

export class StorageManager {
  static init() {
    if (typeof window === 'undefined') return;
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInit) {
      // Start with clean, authentic empty data - zero invented/fake data
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([]));
      if (!localStorage.getItem(STORAGE_KEYS.CURRENCY)) {
        localStorage.setItem(STORAGE_KEYS.CURRENCY, DEFAULT_CURRENCY_CODE);
      }
      if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
        localStorage.setItem(STORAGE_KEYS.THEME, 'SYSTEM');
      }
      if (!localStorage.getItem(STORAGE_KEYS.LANGUAGE)) {
        localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'en');
      }
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }

    // Ensure any previously loaded mock seed data is cleared so user has a clean slate
    const currentExp = this.getExpenses();
    const hasMockSeed = currentExp.length > 0 && currentExp.some((e) => e.description === 'Whole Foods Market' || e.description === 'Starbucks Coffee');
    if (hasMockSeed) {
      this.saveExpenses([]);
      this.saveBudgets([]);
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
    const maxId = expenses.reduce((max, e) => Math.max(max, e.id || 0), 0);
    const newExpense: Expense = {
      ...expense,
      id: maxId + 1,
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

  static getLanguage(): Language {
    return (localStorage.getItem(STORAGE_KEYS.LANGUAGE) as Language) || 'en';
  }

  static setLanguage(lang: Language) {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
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
    const currentExpenses = replaceExisting ? [] : this.getExpenses();
    const currentBudgets = replaceExisting ? [] : this.getBudgets();

    let maxId = currentExpenses.reduce((max, e) => Math.max(max, e.id || 0), 0);

    const isDuplicate = (incoming: any, existingList: Expense[]) => {
      return existingList.some((e) => {
        if (incoming.id && e.id === incoming.id) return true;
        if (incoming.createdAt && e.createdAt === incoming.createdAt && Math.abs(e.amount - incoming.amount) < 0.001) return true;
        return (
          e.date === incoming.date &&
          Math.abs(e.amount - incoming.amount) < 0.001 &&
          e.description.trim().toLowerCase() === incoming.description.trim().toLowerCase() &&
          e.category.toLowerCase() === incoming.category.toLowerCase()
        );
      });
    };

    const expensesToImport = replaceExisting
      ? backup.expenses
      : backup.expenses.filter((b) => !isDuplicate(b, currentExpenses));

    const importedExpenses: Expense[] = expensesToImport.map((b) => {
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
