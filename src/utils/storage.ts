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
import { DEFAULT_CURRENCY_CODE, SUPPORTED_CURRENCIES } from './currency';
import { APP_VERSION_NAME } from './appVersion';

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
    if (localStorage.getItem(STORAGE_KEYS.EXPENSES) === null) localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
    if (localStorage.getItem(STORAGE_KEYS.BUDGETS) === null) localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([]));
    if (localStorage.getItem(STORAGE_KEYS.CURRENCY) === null) localStorage.setItem(STORAGE_KEYS.CURRENCY, DEFAULT_CURRENCY_CODE);
    if (localStorage.getItem(STORAGE_KEYS.THEME) === null) localStorage.setItem(STORAGE_KEYS.THEME, 'SYSTEM');
    if (localStorage.getItem(STORAGE_KEYS.LANGUAGE) === null) localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'en');
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
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

  static invalidateAnalysis(monthKey: string) {
    localStorage.removeItem(`${STORAGE_KEYS.AI_CACHE}_${monthKey}`);
  }

  static clearAnalysisCache() {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_KEYS.AI_CACHE}_`)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
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
    const d = new Date(newExpense.date);
    this.invalidateAnalysis(getMonthKey({ year: d.getFullYear(), month: d.getMonth() + 1 }));
    return newExpense;
  }

  static updateExpense(updated: Expense) {
    const expenses = this.getExpenses();
    const index = expenses.findIndex((e) => e.id === updated.id);
    if (index !== -1) {
      const previous = expenses[index];
      expenses[index] = updated;
      this.saveExpenses(expenses);
      for (const timestamp of [previous.date, updated.date]) {
        const d = new Date(timestamp);
        this.invalidateAnalysis(getMonthKey({ year: d.getFullYear(), month: d.getMonth() + 1 }));
      }
    }
  }

  static deleteExpense(id: number) {
    const expenses = this.getExpenses();
    const deleted = expenses.find((e) => e.id === id);
    const filtered = expenses.filter((e) => e.id !== id);
    this.saveExpenses(filtered);
    if (deleted) {
      const d = new Date(deleted.date);
      this.invalidateAnalysis(getMonthKey({ year: d.getFullYear(), month: d.getMonth() + 1 }));
    }
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
    this.clearAnalysisCache();
  }

  static validateBackup(input: unknown): SpendWiseBackup {
    if (!input || typeof input !== 'object') throw new Error('Backup must be a JSON object.');
    const backup = input as SpendWiseBackup;
    if (!Array.isArray(backup.expenses) || !Array.isArray(backup.monthlyBudgets)) throw new Error('Backup is missing financial records.');
    if (backup.metadata?.schemaVersion != null && backup.metadata.schemaVersion !== 1) throw new Error('Unsupported backup schema version.');
    for (const e of backup.expenses) {
      if (!Number.isInteger(e.id) || e.id < 0 || !Number.isFinite(e.amount) || e.amount <= 0 || typeof e.description !== 'string' || !e.description.trim() || typeof e.category !== 'string' || !e.category.trim() || !Number.isFinite(e.date) || !Number.isFinite(e.createdAt)) throw new Error('Backup contains an invalid expense.');
    }
    for (const b of backup.monthlyBudgets) {
      if (!/^\d{4}-\d{2}$/.test(b.monthKey) || !Number.isFinite(b.startingAmount) || b.startingAmount <= 0 || !Number.isFinite(b.updatedAt)) throw new Error('Backup contains an invalid monthly budget.');
    }
    const currency = backup.settings?.currencyCode;
    if (currency && !SUPPORTED_CURRENCIES.some((c) => c.code === currency)) throw new Error('Backup uses an unsupported currency.');
    if (backup.settings?.themeMode && !['SYSTEM', 'LIGHT', 'DARK'].includes(backup.settings.themeMode)) throw new Error('Backup contains an invalid theme.');
    if (backup.settings?.language && !['en', 'fr', 'ar'].includes(backup.settings.language)) throw new Error('Backup contains an invalid language.');
    return backup;
  }

  // Generate full SpendWise v2.0 backup JSON
  static createBackupJson(): SpendWiseBackup {
    const expenses = this.getExpenses();
    const budgets = this.getBudgets();
    const currencyCode = this.getCurrencyCode();
    const themeMode = this.getThemeMode();
    const language = this.getLanguage();

    const now = Date.now();
    return {
      metadata: {
        appVersion: APP_VERSION_NAME,
        schemaVersion: 1,
        exportedAt: now,
        exportedAtFormatted: new Date(now).toISOString().replace('T', ' ').substring(0, 19),
        totalExpenses: expenses.length,
        totalBudgets: budgets.length,
      },
      settings: {
        currencyCode,
        themeMode,
        language,
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

  // Restore or merge a fully validated backup. Target state is built before mutation,
  // and current state is restored if a write fails.
  static restoreBackup(input: SpendWiseBackup, replaceExisting: boolean): ImportSummary {
    const backup = this.validateBackup(input);
    const oldExpenses = this.getExpenses();
    const oldBudgets = this.getBudgets();
    const oldCurrency = this.getCurrencyCode();
    const oldTheme = this.getThemeMode();
    const oldLanguage = this.getLanguage();
    const currentExpenses = replaceExisting ? [] : oldExpenses;
    let maxId = currentExpenses.reduce((max, e) => Math.max(max, e.id || 0), 0);

    const isDuplicate = (incoming: SpendWiseBackup['expenses'][number], existing: Expense[]) => existing.some((e) =>
      (incoming.createdAt === e.createdAt && Math.abs(incoming.amount - e.amount) < 0.001) ||
      (incoming.date === e.date && Math.abs(incoming.amount - e.amount) < 0.001 && e.description.trim().toLowerCase() === incoming.description.trim().toLowerCase() && e.category.trim().toLowerCase() === incoming.category.trim().toLowerCase())
    );

    const importedExpenses: Expense[] = [];
    for (const item of backup.expenses) {
      if (!replaceExisting && isDuplicate(item, currentExpenses)) continue;
      importedExpenses.push({ id: replaceExisting ? item.id : ++maxId, amount: item.amount, description: item.description.trim(), category: item.category.trim(), date: item.date, note: item.note?.trim() || null, createdAt: item.createdAt });
    }
    const nextExpenses = replaceExisting ? importedExpenses : [...importedExpenses, ...currentExpenses];

    const budgetMap = new Map<string, MonthlyBudget>();
    if (!replaceExisting) oldBudgets.forEach((b) => budgetMap.set(b.monthKey, b));
    let budgetsImported = 0;
    for (const item of backup.monthlyBudgets) {
      if (!replaceExisting && budgetMap.has(item.monthKey)) continue;
      budgetMap.set(item.monthKey, { monthKey: item.monthKey, startingAmount: item.startingAmount, updatedAt: item.updatedAt });
      budgetsImported++;
    }

    try {
      this.saveExpenses(nextExpenses);
      this.saveBudgets(Array.from(budgetMap.values()));
      if (backup.settings?.currencyCode) this.setCurrencyCode(backup.settings.currencyCode);
      if (backup.settings?.themeMode) this.setThemeMode(backup.settings.themeMode as ThemeMode);
      if (backup.settings?.language) this.setLanguage(backup.settings.language as Language);
      this.clearAnalysisCache();
    } catch (error) {
      this.saveExpenses(oldExpenses);
      this.saveBudgets(oldBudgets);
      this.setCurrencyCode(oldCurrency);
      this.setThemeMode(oldTheme);
      this.setLanguage(oldLanguage);
      throw error;
    }

    return { expensesImported: importedExpenses.length, budgetsImported, currencyUpdated: backup.settings?.currencyCode || null, wasReplaced: replaceExisting };
  }

}

function escapeCsv(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
