import { Expense, ExpenseAttachment, MonthlyBudget } from '../types';
import { normalizeCategoryName } from './categories';
import { DEFAULT_CURRENCY_CODE, SUPPORTED_CURRENCIES } from './currency';
import { WEB_EXPENSE_DRAFT_KEY } from '../data/ExpenseDraft';

export const LEGACY_FINANCIAL_KEYS = {
  EXPENSES: 'spendwise_expenses',
  BUDGETS: 'spendwise_budgets',
  ATTACHMENTS: 'spendwise_expense_attachments_v1',
  CURRENCY: 'spendwise_currency',
  WEB_TXN: 'spendwise_financial_txn_v2',
} as const;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const MAX_SAFE_FINANCIAL_VALUE = Number.MAX_SAFE_INTEGER / 100;

export interface FinancialState {
  expenses: Expense[];
  budgets: MonthlyBudget[];
  attachments: ExpenseAttachment[];
  currencyCode: string;
}

type SerializedState = {
  draft?: string | null;
  expenses: string | null;
  budgets: string | null;
  attachments: string | null;
  currency: string | null;
};

type WebFinancialJournal = {
  version: 1;
  phase: 'prepared' | 'committed';
  original: SerializedState;
  target: SerializedState;
};

function parseArray(key: string, raw: string | null): unknown[] {
  if (raw === null || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LEGACY_${key}_INVALID_JSON`);
  }
  if (!Array.isArray(parsed)) throw new Error(`LEGACY_${key}_INVALID_SHAPE`);
  return parsed;
}

function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.some((currency) => currency.code === code);
}

export function validateFinancialState(input: FinancialState): FinancialState {
  const expenseIds = new Set<number>();
  const expenses = input.expenses.map((value) => {
    if (
      !Number.isInteger(value.id) ||
      value.id <= 0 ||
      expenseIds.has(value.id) ||
      !Number.isFinite(value.amount) ||
      value.amount <= 0 ||
      value.amount > MAX_SAFE_FINANCIAL_VALUE ||
      typeof value.description !== 'string' ||
      !value.description.trim() ||
      typeof value.category !== 'string' ||
      !value.category.trim() ||
      !Number.isFinite(value.date) ||
      value.date <= 0 ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt <= 0 ||
      (value.note !== undefined && value.note !== null && typeof value.note !== 'string')
    ) {
      throw new Error('LEGACY_EXPENSES_INVALID_RECORD');
    }
    expenseIds.add(value.id);
    return {
      id: value.id,
      amount: value.amount,
      description: value.description,
      category: normalizeCategoryName(value.category),
      date: value.date,
      note: value.note ?? null,
      createdAt: value.createdAt,
    } satisfies Expense;
  });

  const months = new Set<string>();
  const budgets = input.budgets.map((value) => {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.monthKey) ||
      months.has(value.monthKey) ||
      !Number.isFinite(value.startingAmount) ||
      value.startingAmount <= 0 ||
      value.startingAmount > MAX_SAFE_FINANCIAL_VALUE ||
      !Number.isFinite(value.updatedAt) ||
      value.updatedAt <= 0
    ) {
      throw new Error('LEGACY_BUDGETS_INVALID_RECORD');
    }
    months.add(value.monthKey);
    return { ...value };
  });

  const attachmentIds = new Set<string>();
  const storageKeys = new Set<string>();
  const attachments = input.attachments.map((value) => {
    if (
      typeof value.id !== 'string' ||
      !value.id ||
      attachmentIds.has(value.id) ||
      !Number.isInteger(value.expenseId) ||
      !expenseIds.has(value.expenseId) ||
      typeof value.storageKey !== 'string' ||
      !value.storageKey ||
      storageKeys.has(value.storageKey) ||
      typeof value.mimeType !== 'string' ||
      !value.mimeType.startsWith('image/') ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt <= 0 ||
      (value.originalFilename !== undefined && value.originalFilename !== null && typeof value.originalFilename !== 'string') ||
      !['purchase', 'receipt', 'proof'].includes(value.kind) ||
      !Number.isFinite(value.byteSize) ||
      value.byteSize <= 0 ||
      !Number.isFinite(value.width) ||
      value.width <= 0 ||
      !Number.isFinite(value.height) ||
      value.height <= 0
    ) {
      throw new Error('LEGACY_ATTACHMENTS_INVALID_RECORD');
    }
    attachmentIds.add(value.id);
    storageKeys.add(value.storageKey);
    return { ...value, originalFilename: value.originalFilename ?? null };
  });

  const currencyCode = input.currencyCode.toUpperCase();
  if (!isSupportedCurrency(currencyCode)) throw new Error('LEGACY_CURRENCY_INVALID');

  return { expenses, budgets, attachments, currencyCode };
}

export function readLegacyFinancialState(storage: KeyValueStore): FinancialState {
  const expenses = parseArray('EXPENSES', storage.getItem(LEGACY_FINANCIAL_KEYS.EXPENSES)) as Expense[];
  const budgets = parseArray('BUDGETS', storage.getItem(LEGACY_FINANCIAL_KEYS.BUDGETS)) as MonthlyBudget[];
  const attachments = parseArray('ATTACHMENTS', storage.getItem(LEGACY_FINANCIAL_KEYS.ATTACHMENTS)) as ExpenseAttachment[];
  const rawCurrency = storage.getItem(LEGACY_FINANCIAL_KEYS.CURRENCY);
  const currencyCode = (rawCurrency || DEFAULT_CURRENCY_CODE).toUpperCase();
  return validateFinancialState({ expenses, budgets, attachments, currencyCode });
}

export function cloneFinancialState(state: FinancialState): FinancialState {
  return {
    expenses: state.expenses.map((item) => ({ ...item })),
    budgets: state.budgets.map((item) => ({ ...item })),
    attachments: state.attachments.map((item) => ({ ...item })),
    currencyCode: state.currencyCode,
  };
}

function normalized(state: FinancialState) {
  return {
    expenses: [...state.expenses].sort((a, b) => a.id - b.id),
    budgets: [...state.budgets].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
    attachments: [...state.attachments].sort((a, b) => a.id.localeCompare(b.id)),
    currencyCode: state.currencyCode,
  };
}

export function financialStatesEqual(a: FinancialState, b: FinancialState): boolean {
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
}

function readSerializedState(storage: KeyValueStore): SerializedState {
  return {
    draft: storage.getItem(WEB_EXPENSE_DRAFT_KEY),
    expenses: storage.getItem(LEGACY_FINANCIAL_KEYS.EXPENSES),
    budgets: storage.getItem(LEGACY_FINANCIAL_KEYS.BUDGETS),
    attachments: storage.getItem(LEGACY_FINANCIAL_KEYS.ATTACHMENTS),
    currency: storage.getItem(LEGACY_FINANCIAL_KEYS.CURRENCY),
  };
}

function toSerializedState(state: FinancialState): SerializedState {
  return {
    expenses: JSON.stringify(state.expenses),
    budgets: JSON.stringify(state.budgets),
    attachments: state.attachments.length ? JSON.stringify(state.attachments) : null,
    currency: state.currencyCode,
  };
}

function applySerializedState(storage: KeyValueStore, state: SerializedState): void {
  const entries: Array<[string, string | null]> = [
    [LEGACY_FINANCIAL_KEYS.EXPENSES, state.expenses],
    [LEGACY_FINANCIAL_KEYS.BUDGETS, state.budgets],
    [LEGACY_FINANCIAL_KEYS.ATTACHMENTS, state.attachments],
    [LEGACY_FINANCIAL_KEYS.CURRENCY, state.currency],
  ];
  if ('draft' in state) entries.push([WEB_EXPENSE_DRAFT_KEY, state.draft ?? null]);
  for (const [key, value] of entries) {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  }
}

export function recoverWebFinancialTransaction(storage: KeyValueStore): void {
  const raw = storage.getItem(LEGACY_FINANCIAL_KEYS.WEB_TXN);
  if (!raw) return;
  let journal: WebFinancialJournal;
  try {
    journal = JSON.parse(raw) as WebFinancialJournal;
    if (
      journal.version !== 1 ||
      !journal.original ||
      !journal.target ||
      !['prepared', 'committed'].includes(journal.phase)
    ) throw new Error('INVALID_WEB_JOURNAL');
  } catch {
    throw new Error('WEB_FINANCIAL_TRANSACTION_CORRUPT');
  }
  applySerializedState(storage, journal.phase === 'committed' ? journal.target : journal.original);
  storage.removeItem(LEGACY_FINANCIAL_KEYS.WEB_TXN);
}

export function persistWebFinancialState(storage: KeyValueStore, input: FinancialState, clearDraft = false): void {
  const state = validateFinancialState(cloneFinancialState(input));
  const original = readSerializedState(storage);
  const target = toSerializedState(state);
  target.draft = clearDraft ? null : original.draft;
  const journal: WebFinancialJournal = { version: 1, phase: 'prepared', original, target };
  storage.setItem(LEGACY_FINANCIAL_KEYS.WEB_TXN, JSON.stringify(journal));
  try {
    applySerializedState(storage, target);
    journal.phase = 'committed';
    storage.setItem(LEGACY_FINANCIAL_KEYS.WEB_TXN, JSON.stringify(journal));
  } catch (error) {
    try {
      applySerializedState(storage, original);
      storage.removeItem(LEGACY_FINANCIAL_KEYS.WEB_TXN);
    } catch {
      // A prepared journal is intentionally retained when the backing store itself refuses writes.
    }
    throw error;
  }
  try {
    storage.removeItem(LEGACY_FINANCIAL_KEYS.WEB_TXN);
  } catch {
    // A committed journal is safe: startup will roll forward and clean it up.
  }
}
