import {
  AiAnalysisResult,
  Expense,
  ImportSummary,
  Language,
  MonthlyBudget,
  SpendWiseBackup,
  ThemeMode,
} from '../types';
import { currentMonthYear, formatDate, getMonthKey, MonthYear, previousMonth, toInputDateFormat } from './date';
import {
  convertCurrencyAmount,
  DEFAULT_CURRENCY_CODE,
  isValidConversionRate,
  SUPPORTED_CURRENCIES,
} from './currency';
import { APP_VERSION_NAME } from './appVersion';
import { AttachmentStorage } from './attachmentStorage';

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
  CURRENCY_TXN: 'spendwise_currency_conversion_txn_v1',
  INITIALIZED: 'spendwise_clean_init_v3',
};

type CurrencyTransactionState = {
  expenses: string | null;
  budgets: string | null;
  currency: string | null;
};

interface CurrencyConversionJournal {
  version: 1;
  phase: 'prepared' | 'committed';
  original: CurrencyTransactionState;
  target: CurrencyTransactionState;
}

export interface CurrencyConversionResult {
  sourceCurrencyCode: string;
  targetCurrencyCode: string;
  expensesConverted: number;
  budgetsConverted: number;
}

export class StorageManager {
  static init() {
    if (typeof window === 'undefined') return;
    this.recoverInterruptedCurrencyConversion();
    if (localStorage.getItem(STORAGE_KEYS.EXPENSES) === null) localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
    if (localStorage.getItem(STORAGE_KEYS.BUDGETS) === null) localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([]));
    if (localStorage.getItem(STORAGE_KEYS.CURRENCY) === null) localStorage.setItem(STORAGE_KEYS.CURRENCY, DEFAULT_CURRENCY_CODE);
    if (localStorage.getItem(STORAGE_KEYS.THEME) === null) localStorage.setItem(STORAGE_KEYS.THEME, 'SYSTEM');
    if (localStorage.getItem(STORAGE_KEYS.LANGUAGE) === null) localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'en');

    // Never leave an upgraded installation locked behind the old implicit 1234 fallback.
    // A lock is valid only when a real 4-8 digit PIN has explicitly been saved.
    const storedPin = localStorage.getItem(STORAGE_KEYS.LOCK_PIN) || '';
    if (localStorage.getItem(STORAGE_KEYS.APP_LOCK) === 'true' && !/^\d{4,8}$/.test(storedPin)) {
      localStorage.setItem(STORAGE_KEYS.APP_LOCK, 'false');
    }

    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    AttachmentStorage.scheduleMaintenance();
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

  static async deleteExpense(id: number): Promise<void> {
    const expenses = this.getExpenses();
    const deleted = expenses.find((e) => e.id === id);
    const filtered = expenses.filter((e) => e.id !== id);
    const detachedAttachments = AttachmentStorage.detachReferencesForExpense(id);

    try {
      this.saveExpenses(filtered);
    } catch (error) {
      AttachmentStorage.restoreReferences(detachedAttachments);
      throw error;
    }

    await AttachmentStorage.deleteDetachedFiles(detachedAttachments);

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

  private static setRawStorageValue(key: string, value: string | null) {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }

  private static recoverInterruptedCurrencyConversion() {
    const rawJournal = localStorage.getItem(STORAGE_KEYS.CURRENCY_TXN);
    if (!rawJournal) return;

    try {
      const journal = JSON.parse(rawJournal) as CurrencyConversionJournal;
      if (
        journal.version !== 1 ||
        !journal.original ||
        !journal.target ||
        !['prepared', 'committed'].includes(journal.phase)
      ) {
        throw new Error('Invalid currency conversion journal.');
      }

      // A prepared transaction was interrupted before commit: roll back.
      // A committed transaction was interrupted during cleanup: roll forward.
      const recovered = journal.phase === 'committed' ? journal.target : journal.original;
      this.setRawStorageValue(STORAGE_KEYS.EXPENSES, recovered.expenses);
      this.setRawStorageValue(STORAGE_KEYS.BUDGETS, recovered.budgets);
      this.setRawStorageValue(STORAGE_KEYS.CURRENCY, recovered.currency);
      this.clearAnalysisCache();
      localStorage.removeItem(STORAGE_KEYS.CURRENCY_TXN);
    } catch {
      // Never let a malformed recovery marker brick application startup.
      localStorage.removeItem(STORAGE_KEYS.CURRENCY_TXN);
      this.clearAnalysisCache();
    }
  }

  static convertCurrency(
    targetCurrencyCode: string,
    targetUnitsPerSourceUnit: number
  ): CurrencyConversionResult {
    const sourceCurrencyCode = this.getCurrencyCode().toUpperCase();
    const target = targetCurrencyCode.toUpperCase();
    const isSupported = (code: string) => SUPPORTED_CURRENCIES.some((c) => c.code === code);

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
    if (!isValidConversionRate(targetUnitsPerSourceUnit)) {
      throw new Error('Invalid currency conversion rate.');
    }

    const expenses = this.getExpenses();
    const budgets = this.getBudgets();

    // Empty ledgers are a preference change, not a financial conversion.
    if (expenses.length === 0 && budgets.length === 0) {
      this.setCurrencyCode(target);
      this.clearAnalysisCache();
      return {
        sourceCurrencyCode,
        targetCurrencyCode: target,
        expensesConverted: 0,
        budgetsConverted: 0,
      };
    }

    // Calculate the complete target state before writing anything.
    const convertedExpenses = expenses.map((expense) => ({
      ...expense,
      amount: convertCurrencyAmount(expense.amount, targetUnitsPerSourceUnit),
    }));
    const convertedBudgets = budgets.map((budget) => ({
      ...budget,
      startingAmount: convertCurrencyAmount(budget.startingAmount, targetUnitsPerSourceUnit),
    }));

    const original: CurrencyTransactionState = {
      expenses: localStorage.getItem(STORAGE_KEYS.EXPENSES),
      budgets: localStorage.getItem(STORAGE_KEYS.BUDGETS),
      currency: localStorage.getItem(STORAGE_KEYS.CURRENCY),
    };
    const targetState: CurrencyTransactionState = {
      expenses: JSON.stringify(convertedExpenses),
      budgets: JSON.stringify(convertedBudgets),
      currency: target,
    };
    const journal: CurrencyConversionJournal = {
      version: 1,
      phase: 'prepared',
      original,
      target: targetState,
    };

    // Persist the recovery marker before mutating the ledger. If this fails
    // (for example because storage is full), no financial value has changed.
    localStorage.setItem(STORAGE_KEYS.CURRENCY_TXN, JSON.stringify(journal));

    try {
      this.setRawStorageValue(STORAGE_KEYS.EXPENSES, targetState.expenses);
      this.setRawStorageValue(STORAGE_KEYS.BUDGETS, targetState.budgets);
      this.setRawStorageValue(STORAGE_KEYS.CURRENCY, targetState.currency);

      // Cache invalidation is part of the logical transaction. If it fails,
      // the prepared journal still instructs init() to restore the original ledger.
      this.clearAnalysisCache();

      // Mark commit only after the ledger and cache state are coherent.
      journal.phase = 'committed';
      localStorage.setItem(STORAGE_KEYS.CURRENCY_TXN, JSON.stringify(journal));
    } catch (error) {
      // Best-effort exact rollback of the original persisted financial state.
      try {
        this.setRawStorageValue(STORAGE_KEYS.EXPENSES, original.expenses);
        this.setRawStorageValue(STORAGE_KEYS.BUDGETS, original.budgets);
        this.setRawStorageValue(STORAGE_KEYS.CURRENCY, original.currency);
        this.clearAnalysisCache();
        localStorage.removeItem(STORAGE_KEYS.CURRENCY_TXN);
      } catch {
        // If the platform itself is refusing storage writes, keep the prepared
        // recovery journal whenever possible. init() will roll back on restart.
      }
      throw error;
    }

    // Cleanup is intentionally outside the rollback block. If journal removal
    // itself fails after commit, init() sees phase=committed and safely rolls
    // forward to the already-written target state instead of reverting a valid conversion.
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENCY_TXN);
    } catch {
      // Safe to leave a committed journal for startup recovery/cleanup.
    }

    return {
      sourceCurrencyCode,
      targetCurrencyCode: target,
      expensesConverted: convertedExpenses.length,
      budgetsConverted: convertedBudgets.length,
    };
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
    return localStorage.getItem(STORAGE_KEYS.LOCK_PIN) || '';
  }

  static hasLockPin(): boolean {
    return /^\d{4,8}$/.test(this.getLockPin());
  }

  static setLockPin(pin: string) {
    if (!/^\d{4,8}$/.test(pin)) {
      throw new Error('PIN must contain 4-8 digits.');
    }
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

  static async clearAllData(): Promise<void> {
    const detachedAttachments = AttachmentStorage.detachAllReferences();

    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([]));
      this.clearAnalysisCache();
    } catch (error) {
      AttachmentStorage.restoreReferences(detachedAttachments);
      throw error;
    }

    await AttachmentStorage.deleteDetachedFiles(detachedAttachments);
  }

  static validateBackup(input: unknown): SpendWiseBackup {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Backup must be a JSON object.');
    }

    const backup = input as SpendWiseBackup;
    if (!backup.metadata || typeof backup.metadata !== 'object') {
      throw new Error('Backup metadata is missing.');
    }
    if (!backup.settings || typeof backup.settings !== 'object') {
      throw new Error('Backup settings are missing.');
    }
    if (!Array.isArray(backup.expenses) || !Array.isArray(backup.monthlyBudgets)) {
      throw new Error('Backup is missing financial records.');
    }

    const metadata = backup.metadata;
    if (metadata.schemaVersion !== 1) {
      throw new Error('Unsupported backup schema version.');
    }
    if (typeof metadata.appVersion !== 'string' || !metadata.appVersion.trim()) {
      throw new Error('Backup app version is missing.');
    }
    if (!Number.isFinite(metadata.exportedAt) || metadata.exportedAt <= 0) {
      throw new Error('Backup export timestamp is invalid.');
    }
    if (typeof metadata.exportedAtFormatted !== 'string' || !metadata.exportedAtFormatted.trim()) {
      throw new Error('Backup export date is invalid.');
    }
    if (
      !Number.isInteger(metadata.totalExpenses) ||
      metadata.totalExpenses < 0 ||
      !Number.isInteger(metadata.totalBudgets) ||
      metadata.totalBudgets < 0
    ) {
      throw new Error('Backup record counts are invalid.');
    }
    if (
      metadata.totalExpenses !== backup.expenses.length ||
      metadata.totalBudgets !== backup.monthlyBudgets.length
    ) {
      throw new Error('Backup record counts do not match its contents.');
    }

    const currency = backup.settings.currencyCode;
    if (
      typeof currency !== 'string' ||
      !SUPPORTED_CURRENCIES.some((c) => c.code === currency)
    ) {
      throw new Error('Backup uses an unsupported currency.');
    }
    if (!['SYSTEM', 'LIGHT', 'DARK'].includes(backup.settings.themeMode)) {
      throw new Error('Backup contains an invalid theme.');
    }
    if (!['en', 'fr', 'ar'].includes(backup.settings.language)) {
      throw new Error('Backup contains an invalid language.');
    }

    const expenseIds = new Set<number>();
    for (const e of backup.expenses) {
      if (
        !Number.isInteger(e.id) ||
        e.id <= 0 ||
        expenseIds.has(e.id) ||
        !Number.isFinite(e.amount) ||
        e.amount <= 0 ||
        typeof e.description !== 'string' ||
        !e.description.trim() ||
        typeof e.category !== 'string' ||
        !e.category.trim() ||
        !Number.isFinite(e.date) ||
        e.date <= 0 ||
        !Number.isFinite(e.createdAt) ||
        e.createdAt <= 0 ||
        (e.note !== undefined && e.note !== null && typeof e.note !== 'string')
      ) {
        throw new Error('Backup contains an invalid or duplicate expense.');
      }
      expenseIds.add(e.id);
    }

    const budgetMonths = new Set<string>();
    for (const b of backup.monthlyBudgets) {
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.monthKey) ||
        budgetMonths.has(b.monthKey) ||
        !Number.isFinite(b.startingAmount) ||
        b.startingAmount <= 0 ||
        !Number.isFinite(b.updatedAt) ||
        b.updatedAt <= 0
      ) {
        throw new Error('Backup contains an invalid or duplicate monthly budget.');
      }
      budgetMonths.add(b.monthKey);
    }

    return backup;
  }
  // Generate full SpendWise backup JSON
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

  // Generate UTF-8 CSV export. The BOM helps Excel recognize Arabic/French
  // text correctly, while CRLF keeps the file friendly to Windows tools.
  static createCsvExport(): string {
    const expenses = this.getExpenses();
    const currencyCode = this.getCurrencyCode();

    const lines: string[] = ['ID,Date,Description,Category,Amount,Currency,Note,Created_At'];
    for (const e of expenses) {
      const dateFmt = toInputDateFormat(e.date);
      const desc = escapeCsv(e.description);
      const cat = escapeCsv(e.category);
      const note = escapeCsv(e.note || '');
      const line = `${e.id},${dateFmt},${desc},${cat},${e.amount.toFixed(2)},${currencyCode},${note},${e.createdAt}`;
      lines.push(line);
    }

    return '\uFEFF' + lines.join('\r\n');
  }
  // Restore or merge a fully validated backup. Target state is built before mutation,
  // and current state is restored if a write fails.
  static async restoreBackup(
    input: SpendWiseBackup,
    replaceExisting: boolean
  ): Promise<ImportSummary> {
    const backup = this.validateBackup(input);
    const detachedAttachments = replaceExisting
      ? AttachmentStorage.detachAllReferences()
      : [];
    const oldExpenses = this.getExpenses();
    const oldBudgets = this.getBudgets();
    const oldCurrency = this.getCurrencyCode();
    const oldTheme = this.getThemeMode();
    const oldLanguage = this.getLanguage();

    const currentHasFinancialData = oldExpenses.length > 0 || oldBudgets.length > 0;
    const backupHasFinancialData =
      backup.expenses.length > 0 || backup.monthlyBudgets.length > 0;

    if (
      !replaceExisting &&
      currentHasFinancialData &&
      backupHasFinancialData &&
      backup.settings.currencyCode !== oldCurrency
    ) {
      throw new Error('BACKUP_CURRENCY_MISMATCH');
    }

    const currentExpenses = replaceExisting ? [] : oldExpenses;
    let maxId = currentExpenses.reduce((max, e) => Math.max(max, e.id || 0), 0);

    const isDuplicate = (
      incoming: SpendWiseBackup['expenses'][number],
      existing: Expense[]
    ) =>
      existing.some(
        (e) =>
          (incoming.createdAt === e.createdAt &&
            Math.abs(incoming.amount - e.amount) < 0.001) ||
          (incoming.date === e.date &&
            Math.abs(incoming.amount - e.amount) < 0.001 &&
            e.description.trim().toLowerCase() === incoming.description.trim().toLowerCase() &&
            e.category.trim().toLowerCase() === incoming.category.trim().toLowerCase())
      );

    const importedExpenses: Expense[] = [];
    const knownExpenses = [...currentExpenses];

    for (const item of backup.expenses) {
      if (!replaceExisting && isDuplicate(item, knownExpenses)) continue;

      const imported: Expense = {
        id: replaceExisting ? item.id : ++maxId,
        amount: item.amount,
        description: item.description.trim(),
        category: item.category.trim(),
        date: item.date,
        note: item.note?.trim() || null,
        createdAt: item.createdAt,
      };

      importedExpenses.push(imported);
      knownExpenses.push(imported);
    }

    const nextExpenses = replaceExisting
      ? importedExpenses
      : [...importedExpenses, ...currentExpenses];

    const budgetMap = new Map<string, MonthlyBudget>();
    if (!replaceExisting) {
      oldBudgets.forEach((b) => budgetMap.set(b.monthKey, b));
    }

    let budgetsImported = 0;
    for (const item of backup.monthlyBudgets) {
      if (!replaceExisting && budgetMap.has(item.monthKey)) continue;
      budgetMap.set(item.monthKey, {
        monthKey: item.monthKey,
        startingAmount: item.startingAmount,
        updatedAt: item.updatedAt,
      });
      budgetsImported++;
    }

    // Merging into an empty financial store may safely adopt the backup currency.
    // Merging into existing data preserves every current setting.
    const adoptBackupCurrency =
      replaceExisting || (!currentHasFinancialData && backupHasFinancialData);

    try {
      this.saveExpenses(nextExpenses);
      this.saveBudgets(Array.from(budgetMap.values()));

      if (adoptBackupCurrency) {
        this.setCurrencyCode(backup.settings.currencyCode);
      }
      if (replaceExisting) {
        this.setThemeMode(backup.settings.themeMode as ThemeMode);
        this.setLanguage(backup.settings.language as Language);
      }

      this.clearAnalysisCache();
    } catch (error) {
      this.saveExpenses(oldExpenses);
      this.saveBudgets(oldBudgets);
      this.setCurrencyCode(oldCurrency);
      this.setThemeMode(oldTheme);
      this.setLanguage(oldLanguage);
      AttachmentStorage.restoreReferences(detachedAttachments);
      throw error;
    }

    if (replaceExisting) {
      await AttachmentStorage.deleteDetachedFiles(detachedAttachments);
    }

    return {
      expensesImported: importedExpenses.length,
      budgetsImported,
      currencyUpdated: adoptBackupCurrency ? backup.settings.currencyCode : null,
      wasReplaced: replaceExisting,
    };
  }

}
function escapeCsv(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
