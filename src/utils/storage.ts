import {
  AiAnalysisResult,
  Expense,
  ImportSummary,
  Language,
  MonthlyBudget,
  SpendWiseBackup,
  ThemeMode,
  MediaStorageSummary,
} from '../types';
import { formatDate, getMonthKey, toInputDateFormat } from './date';
import {
  convertCurrencyAmount,
  DEFAULT_CURRENCY_CODE,
  isValidConversionRate,
  SUPPORTED_CURRENCIES,
} from './currency';
import { APP_VERSION_NAME } from './appVersion';
import { AttachmentEditPayload, AttachmentStorage } from './attachmentStorage';
import { LEGACY_FINANCIAL_KEYS, MAX_SAFE_FINANCIAL_VALUE } from './financialState';
import { LocalDataStore } from './localDataStore';
import { diagnostics, measureDiagnostic } from '../services/diagnostics/diagnostics';
import { SetupState } from './setupState';
import {
  BackupV2Preview,
  BackupV2RestoreSummary,
  createBackupV2Archive,
  previewValidatedBackupV2,
  restoreBackupV2WithAdapters,
  validateBackupV2Archive,
} from './backupV2';
import {
  BackupV3Preview,
  BackupV3RestoreSummary,
  createBackupV3Envelope,
  isBackupV3Envelope,
  previewBackupV3Envelope,
  restoreBackupV3WithAdapters,
} from './backupV3';

const STORAGE_KEYS = {
  CURRENCY: LEGACY_FINANCIAL_KEYS.CURRENCY,
  THEME: 'spendwise_theme',
  LANGUAGE: 'spendwise_language',
  APP_LOCK: 'spendwise_app_lock_enabled',
  LOCK_TIMEOUT: 'spendwise_lock_timeout_seconds',
  LOCK_PIN: 'spendwise_lock_pin',
  AI_CACHE: 'spendwise_ai_insights_cache',
  CURRENCY_TXN: 'spendwise_currency_conversion_txn_v1',
  INITIALIZED: 'spendwise_clean_init_v3',
} as const;

type LegacyCurrencyTransactionState = {
  expenses: string | null;
  budgets: string | null;
  currency: string | null;
};

interface LegacyCurrencyConversionJournal {
  version: 1;
  phase: 'prepared' | 'committed';
  original: LegacyCurrencyTransactionState;
  target: LegacyCurrencyTransactionState;
}

export interface CurrencyConversionResult {
  sourceCurrencyCode: string;
  targetCurrencyCode: string;
  expensesConverted: number;
  budgetsConverted: number;
}

const EMPTY_ATTACHMENT_CHANGES: AttachmentEditPayload = {
  newAttachments: [],
  removedAttachmentIds: [],
};

export class StorageManager {
  private static initialized = false;

  static async init(): Promise<void> {
    if (this.initialized || typeof window === 'undefined') return;
    this.recoverInterruptedLegacyCurrencyConversion();
    SetupState.initialize();

    if (localStorage.getItem(STORAGE_KEYS.CURRENCY) === null) {
      localStorage.setItem(STORAGE_KEYS.CURRENCY, DEFAULT_CURRENCY_CODE);
    }
    if (localStorage.getItem(STORAGE_KEYS.THEME) === null) localStorage.setItem(STORAGE_KEYS.THEME, 'SYSTEM');
    if (localStorage.getItem(STORAGE_KEYS.LANGUAGE) === null) localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'en');

    // WP28 deliberately does not "repair" malformed legacy PIN state here.
    // SecureSessionService owns the lockout-safe migration and must never
    // silently disable App Lock because a credential is missing or malformed.

    await LocalDataStore.init(localStorage);
    await measureDiagnostic('media.init', () => AttachmentStorage.ensureNativeEncryption());
    diagnostics.setState({ mediaEncrypted: LocalDataStore.isNativeSqlite(), cryptoAvailable: Boolean(globalThis.crypto?.subtle) });
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    this.initialized = true;
    AttachmentStorage.scheduleMaintenance();
  }

  static getExpenses(): Expense[] {
    return LocalDataStore.getExpenses();
  }

  static getBudgets(): MonthlyBudget[] {
    return LocalDataStore.getBudgets();
  }

  static getCurrencyCode(): string {
    return LocalDataStore.getCurrencyCode();
  }

  static async addExpense(
    expense: Omit<Expense, 'id' | 'createdAt'>,
    attachmentChanges: AttachmentEditPayload = EMPTY_ATTACHMENT_CHANGES
  ): Promise<Expense> {
    const newExpense: Expense = {
      ...expense,
      id: LocalDataStore.nextExpenseId(),
      createdAt: Date.now(),
    };
    const prepared = await AttachmentStorage.prepareExpenseAttachmentChanges(
      newExpense.id,
      attachmentChanges.newAttachments,
      []
    );

    try {
      await LocalDataStore.createExpenseWithAttachments(newExpense, prepared.nextAttachments);
    } catch (error) {
      await AttachmentStorage.deleteDetachedFiles(prepared.stagedAttachments);
      throw error;
    }

    this.invalidateExpenseMonths([newExpense.date]);
    return newExpense;
  }

  static async updateExpense(
    updated: Expense,
    attachmentChanges: AttachmentEditPayload = EMPTY_ATTACHMENT_CHANGES
  ): Promise<void> {
    const previous = this.getExpenses().find((expense) => expense.id === updated.id);
    if (!previous) return;

    const prepared = await AttachmentStorage.prepareExpenseAttachmentChanges(
      updated.id,
      attachmentChanges.newAttachments,
      attachmentChanges.removedAttachmentIds
    );
    try {
      await LocalDataStore.updateExpenseWithAttachments(updated, prepared.nextAttachments);
    } catch (error) {
      await AttachmentStorage.deleteDetachedFiles(prepared.stagedAttachments);
      throw error;
    }

    await AttachmentStorage.deleteDetachedFiles(prepared.removedAttachments);
    this.invalidateExpenseMonths([previous.date, updated.date]);
  }

  static async deleteExpenses(ids: number[]): Promise<void> {
    const idSet = new Set(ids);
    const deleted = this.getExpenses().filter((expense) => idSet.has(expense.id));
    if (deleted.length === 0) return;

    const detached = await LocalDataStore.deleteExpenses(deleted.map((expense) => expense.id));
    await AttachmentStorage.deleteDetachedFiles(detached);
    this.invalidateExpenseMonths(deleted.map((expense) => expense.date));
  }

  static async deleteExpense(id: number): Promise<void> {
    await this.deleteExpenses([id]);
  }

  static async setBudget(monthKey: string, startingAmount: number): Promise<void> {
    await LocalDataStore.upsertBudget(monthKey, startingAmount, Date.now());
  }

  static async setCurrencyCode(code: string): Promise<void> {
    await LocalDataStore.setCurrencyCode(code);
  }

  static async convertCurrency(
    targetCurrencyCode: string,
    targetUnitsPerSourceUnit: number
  ): Promise<CurrencyConversionResult> {
    const sourceCurrencyCode = this.getCurrencyCode().toUpperCase();
    const target = targetCurrencyCode.toUpperCase();
    const isSupported = (code: string) => SUPPORTED_CURRENCIES.some((currency) => currency.code === code);

    if (!isSupported(sourceCurrencyCode) || !isSupported(target)) {
      throw new Error('Unsupported source or target currency.');
    }
    if (sourceCurrencyCode === target) {
      return { sourceCurrencyCode, targetCurrencyCode: target, expensesConverted: 0, budgetsConverted: 0 };
    }
    if (!isValidConversionRate(targetUnitsPerSourceUnit)) {
      throw new Error('Invalid currency conversion rate.');
    }

    const expenses = this.getExpenses();
    const budgets = this.getBudgets();
    if (expenses.length === 0 && budgets.length === 0) {
      await this.setCurrencyCode(target);
      this.clearAnalysisCache();
      return { sourceCurrencyCode, targetCurrencyCode: target, expensesConverted: 0, budgetsConverted: 0 };
    }

    const convertedExpenses = expenses.map((expense) => ({
      ...expense,
      amount: convertCurrencyAmount(expense.amount, targetUnitsPerSourceUnit),
    }));
    const convertedBudgets = budgets.map((budget) => ({
      ...budget,
      startingAmount: convertCurrencyAmount(budget.startingAmount, targetUnitsPerSourceUnit),
    }));

    await LocalDataStore.replaceLedgerAmountsAndCurrency(convertedExpenses, convertedBudgets, target);
    this.clearAnalysisCache();
    return {
      sourceCurrencyCode,
      targetCurrencyCode: target,
      expensesConverted: convertedExpenses.length,
      budgetsConverted: convertedBudgets.length,
    };
  }

  static invalidateAnalysis(monthKey: string): void {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.AI_CACHE}_${monthKey}`);
    } catch {
      // Analysis is a disposable cache; persistence failures must never roll back financial data.
    }
  }

  static clearAnalysisCache(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${STORAGE_KEYS.AI_CACHE}_`)) keys.push(key);
      }
      keys.forEach((key) => {
        try { localStorage.removeItem(key); } catch {}
      });
    } catch {
      // Best-effort only.
    }
  }

  static getThemeMode(): ThemeMode {
    return (localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode) || 'SYSTEM';
  }

  static setThemeMode(mode: ThemeMode): void {
    localStorage.setItem(STORAGE_KEYS.THEME, mode);
  }

  static getLanguage(): Language {
    return (localStorage.getItem(STORAGE_KEYS.LANGUAGE) as Language) || 'en';
  }

  static setLanguage(lang: Language): void {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  static isAppLockEnabled(): boolean {
    return localStorage.getItem(STORAGE_KEYS.APP_LOCK) === 'true';
  }

  static setAppLockEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEYS.APP_LOCK, enabled ? 'true' : 'false');
  }

  static getLockTimeoutSeconds(): number {
    const value = localStorage.getItem(STORAGE_KEYS.LOCK_TIMEOUT);
    return value ? parseInt(value, 10) : 300;
  }

  static setLockTimeoutSeconds(seconds: number): void {
    localStorage.setItem(STORAGE_KEYS.LOCK_TIMEOUT, seconds.toString());
  }

  static getLockPin(): string {
    return localStorage.getItem(STORAGE_KEYS.LOCK_PIN) || '';
  }

  static hasLockPin(): boolean {
    return /^\d{4,8}$/.test(this.getLockPin());
  }

  static setLockPin(pin: string): void {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must contain 4-8 digits.');
    localStorage.setItem(STORAGE_KEYS.LOCK_PIN, pin);
  }

  static clearLockPin(): void {
    localStorage.removeItem(STORAGE_KEYS.LOCK_PIN);
  }

  static getCachedAnalysis(monthKey: string): AiAnalysisResult | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.AI_CACHE}_${monthKey}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static cacheAnalysis(result: AiAnalysisResult): void {
    try {
      localStorage.setItem(`${STORAGE_KEYS.AI_CACHE}_${result.analyzedMonthKey}`, JSON.stringify(result));
    } catch {}
  }

  static async clearAllData(): Promise<void> {
    const detached = await LocalDataStore.clearFinancialData();
    this.clearAnalysisCache();
    await AttachmentStorage.deleteDetachedFiles(detached);
  }

  static validateBackup(input: unknown): SpendWiseBackup {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Backup must be a JSON object.');
    }
    const backup = input as SpendWiseBackup;
    if (!backup.metadata || typeof backup.metadata !== 'object') throw new Error('Backup metadata is missing.');
    if (!backup.settings || typeof backup.settings !== 'object') throw new Error('Backup settings are missing.');
    if (!Array.isArray(backup.expenses) || !Array.isArray(backup.monthlyBudgets)) {
      throw new Error('Backup is missing financial records.');
    }

    const metadata = backup.metadata;
    if (metadata.schemaVersion !== 1) throw new Error('Unsupported backup schema version.');
    if (typeof metadata.appVersion !== 'string' || !metadata.appVersion.trim()) throw new Error('Backup app version is missing.');
    if (!Number.isFinite(metadata.exportedAt) || metadata.exportedAt <= 0) throw new Error('Backup export timestamp is invalid.');
    if (typeof metadata.exportedAtFormatted !== 'string' || !metadata.exportedAtFormatted.trim()) throw new Error('Backup export date is invalid.');
    if (
      !Number.isInteger(metadata.totalExpenses) || metadata.totalExpenses < 0 ||
      !Number.isInteger(metadata.totalBudgets) || metadata.totalBudgets < 0
    ) throw new Error('Backup record counts are invalid.');
    if (metadata.totalExpenses !== backup.expenses.length || metadata.totalBudgets !== backup.monthlyBudgets.length) {
      throw new Error('Backup record counts do not match its contents.');
    }

    const currency = backup.settings.currencyCode;
    if (typeof currency !== 'string' || !SUPPORTED_CURRENCIES.some((item) => item.code === currency)) {
      throw new Error('Backup uses an unsupported currency.');
    }
    if (!['SYSTEM', 'LIGHT', 'DARK'].includes(backup.settings.themeMode)) throw new Error('Backup contains an invalid theme.');
    if (!['en', 'fr', 'ar'].includes(backup.settings.language)) throw new Error('Backup contains an invalid language.');

    const expenseIds = new Set<number>();
    for (const expense of backup.expenses) {
      if (
        !Number.isInteger(expense.id) || expense.id <= 0 || expenseIds.has(expense.id) ||
        !Number.isFinite(expense.amount) || expense.amount <= 0 || expense.amount > MAX_SAFE_FINANCIAL_VALUE ||
        typeof expense.description !== 'string' || !expense.description.trim() ||
        typeof expense.category !== 'string' || !expense.category.trim() ||
        !Number.isFinite(expense.date) || expense.date <= 0 ||
        !Number.isFinite(expense.createdAt) || expense.createdAt <= 0 ||
        (expense.note !== undefined && expense.note !== null && typeof expense.note !== 'string')
      ) throw new Error('Backup contains an invalid or duplicate expense.');
      expenseIds.add(expense.id);
    }

    const budgetMonths = new Set<string>();
    for (const budget of backup.monthlyBudgets) {
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.monthKey) || budgetMonths.has(budget.monthKey) ||
        !Number.isFinite(budget.startingAmount) || budget.startingAmount <= 0 || budget.startingAmount > MAX_SAFE_FINANCIAL_VALUE ||
        !Number.isFinite(budget.updatedAt) || budget.updatedAt <= 0
      ) throw new Error('Backup contains an invalid or duplicate monthly budget.');
      budgetMonths.add(budget.monthKey);
    }
    return backup;
  }

  static createBackupJson(): SpendWiseBackup {
    const expenses = this.getExpenses();
    const budgets = this.getBudgets();
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
        currencyCode: this.getCurrencyCode(),
        themeMode: this.getThemeMode(),
        language: this.getLanguage(),
      },
      monthlyBudgets: budgets.map((budget) => ({ ...budget })),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        date: expense.date,
        dateFormatted: formatDate(expense.date),
        note: expense.note || null,
        createdAt: expense.createdAt,
      })),
    };
  }

  static async getMediaStorageSummary(): Promise<MediaStorageSummary> {
    const report = await AttachmentStorage.auditIntegrity();
    return {
      photoCount: report.totalMetadataRecords,
      totalBytes: report.totalBinaryBytes,
      purchaseCount: report.kindCounts.purchase,
      receiptCount: report.kindCounts.receipt,
      proofCount: report.kindCounts.proof,
      integrityIssueCount: report.issues.length,
    };
  }

  static async createBackupV2(includeMedia: boolean): Promise<Blob> {
    return createBackupV2Archive({
      appVersion: APP_VERSION_NAME,
      state: LocalDataStore.snapshot(),
      settings: {
        currencyCode: this.getCurrencyCode(),
        themeMode: this.getThemeMode(),
        language: this.getLanguage(),
      },
      includeMedia,
      readMedia: (attachment) => AttachmentStorage.readAttachmentBlob(attachment),
    });
  }

  static async previewBackupV2(file: Blob): Promise<BackupV2Preview> {
    return previewValidatedBackupV2(await validateBackupV2Archive(file));
  }

  static async createBackupV3(includeMedia: boolean, passphrase: string): Promise<Blob> {
    const payload = await this.createBackupV2(includeMedia);
    return createBackupV3Envelope({ payload, passphrase, mediaIncluded: includeMedia });
  }

  static async isBackupV3(file: Blob): Promise<boolean> {
    return isBackupV3Envelope(file);
  }

  static async previewBackupV3(file: Blob, passphrase: string): Promise<BackupV3Preview> {
    return previewBackupV3Envelope(file, passphrase);
  }

  static async restoreBackupV2(file: Blob, replaceExisting: boolean): Promise<BackupV2RestoreSummary> {
    const summary = await restoreBackupV2WithAdapters(file, replaceExisting, {
      getState: () => LocalDataStore.snapshot(),
      getSettings: () => ({
        currencyCode: this.getCurrencyCode(),
        themeMode: this.getThemeMode(),
        language: this.getLanguage(),
      }),
      replaceState: (state) => LocalDataStore.replaceState(state),
      setSettings: async (settings) => {
        this.setThemeMode(settings.themeMode);
        this.setLanguage(settings.language);
      },
      stageMedia: (source, targetExpenseId, blob) =>
        AttachmentStorage.stageBackupMedia(source, targetExpenseId, blob),
      deleteFiles: (items) => AttachmentStorage.deleteDetachedFiles(items),
    });
    this.clearAnalysisCache();
    return summary;
  }

  static async restoreBackupV3(
    file: Blob,
    passphrase: string,
    replaceExisting: boolean
  ): Promise<BackupV3RestoreSummary> {
    const summary = await restoreBackupV3WithAdapters(file, passphrase, replaceExisting, {
      getState: () => LocalDataStore.snapshot(),
      getSettings: () => ({
        currencyCode: this.getCurrencyCode(),
        themeMode: this.getThemeMode(),
        language: this.getLanguage(),
      }),
      replaceState: (state) => LocalDataStore.replaceState(state),
      setSettings: async (settings) => {
        this.setThemeMode(settings.themeMode);
        this.setLanguage(settings.language);
      },
      stageMedia: (source, targetExpenseId, blob) =>
        AttachmentStorage.stageBackupMedia(source, targetExpenseId, blob),
      deleteFiles: (items) => AttachmentStorage.deleteDetachedFiles(items),
    });
    this.clearAnalysisCache();
    return summary;
  }

  static createCsvExport(): string {
    const currencyCode = this.getCurrencyCode();
    const lines: string[] = ['ID,Date,Description,Category,Amount,Currency,Note,Created_At'];
    for (const expense of this.getExpenses()) {
      lines.push(
        `${expense.id},${toInputDateFormat(expense.date)},${escapeCsv(expense.description)},${escapeCsv(expense.category)},${expense.amount.toFixed(2)},${currencyCode},${escapeCsv(expense.note || '')},${expense.createdAt}`
      );
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  static async restoreBackup(input: SpendWiseBackup, replaceExisting: boolean): Promise<ImportSummary> {
    const backup = this.validateBackup(input);
    const oldState = LocalDataStore.snapshot();
    const oldTheme = this.getThemeMode();
    const oldLanguage = this.getLanguage();
    const currentHasFinancialData = oldState.expenses.length > 0 || oldState.budgets.length > 0;
    const backupHasFinancialData = backup.expenses.length > 0 || backup.monthlyBudgets.length > 0;

    if (
      !replaceExisting && currentHasFinancialData && backupHasFinancialData &&
      backup.settings.currencyCode !== oldState.currencyCode
    ) throw new Error('BACKUP_CURRENCY_MISMATCH');

    const currentExpenses = replaceExisting ? [] : oldState.expenses;
    let maxId = currentExpenses.reduce((max, expense) => Math.max(max, expense.id), 0);
    const isDuplicate = (incoming: SpendWiseBackup['expenses'][number], existing: Expense[]) =>
      existing.some((expense) =>
        (incoming.createdAt === expense.createdAt && Math.abs(incoming.amount - expense.amount) < 0.001) ||
        (incoming.date === expense.date && Math.abs(incoming.amount - expense.amount) < 0.001 &&
          expense.description.trim().toLowerCase() === incoming.description.trim().toLowerCase() &&
          expense.category.trim().toLowerCase() === incoming.category.trim().toLowerCase())
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

    const nextExpenses = replaceExisting ? importedExpenses : [...importedExpenses, ...currentExpenses];
    const budgetMap = new Map<string, MonthlyBudget>();
    if (!replaceExisting) oldState.budgets.forEach((budget) => budgetMap.set(budget.monthKey, budget));
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

    const adoptBackupCurrency = replaceExisting || (!currentHasFinancialData && backupHasFinancialData);
    const nextState = {
      expenses: nextExpenses,
      budgets: Array.from(budgetMap.values()),
      attachments: replaceExisting ? [] : oldState.attachments,
      currencyCode: adoptBackupCurrency ? backup.settings.currencyCode : oldState.currencyCode,
    };

    try {
      await LocalDataStore.replaceState(nextState);
      if (replaceExisting) {
        this.setThemeMode(backup.settings.themeMode as ThemeMode);
        this.setLanguage(backup.settings.language as Language);
      }
      this.clearAnalysisCache();
    } catch (error) {
      try { await LocalDataStore.replaceState(oldState); } catch {}
      try { this.setThemeMode(oldTheme); } catch {}
      try { this.setLanguage(oldLanguage); } catch {}
      throw error;
    }

    if (replaceExisting) await AttachmentStorage.deleteDetachedFiles(oldState.attachments);
    return {
      expensesImported: importedExpenses.length,
      budgetsImported,
      currencyUpdated: adoptBackupCurrency ? backup.settings.currencyCode : null,
      wasReplaced: replaceExisting,
    };
  }

  private static invalidateExpenseMonths(timestamps: number[]): void {
    const keys = new Set<string>();
    for (const timestamp of timestamps) {
      const date = new Date(timestamp);
      keys.add(getMonthKey({ year: date.getFullYear(), month: date.getMonth() + 1 }));
    }
    keys.forEach((key) => this.invalidateAnalysis(key));
  }

  private static setRawStorageValue(key: string, value: string | null): void {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }

  private static recoverInterruptedLegacyCurrencyConversion(): void {
    const rawJournal = localStorage.getItem(STORAGE_KEYS.CURRENCY_TXN);
    if (!rawJournal) return;
    try {
      const journal = JSON.parse(rawJournal) as LegacyCurrencyConversionJournal;
      if (
        journal.version !== 1 || !journal.original || !journal.target ||
        !['prepared', 'committed'].includes(journal.phase)
      ) throw new Error('Invalid legacy currency conversion journal.');
      const recovered = journal.phase === 'committed' ? journal.target : journal.original;
      this.setRawStorageValue(LEGACY_FINANCIAL_KEYS.EXPENSES, recovered.expenses);
      this.setRawStorageValue(LEGACY_FINANCIAL_KEYS.BUDGETS, recovered.budgets);
      this.setRawStorageValue(STORAGE_KEYS.CURRENCY, recovered.currency);
      localStorage.removeItem(STORAGE_KEYS.CURRENCY_TXN);
      this.clearAnalysisCache();
    } catch {
      localStorage.removeItem(STORAGE_KEYS.CURRENCY_TXN);
      this.clearAnalysisCache();
    }
  }
}

function escapeCsv(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
