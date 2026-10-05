import { Expense, Language } from '../types';

export type HistoryViewMode = 'ALL' | 'DAY' | 'CATEGORY';

export interface HistoryDateGroup {
  key: string;
  dayTimestamp: number;
  expenses: Expense[];
}

export interface HistoryCategoryGroup {
  category: string;
  expenses: Expense[];
  count: number;
  total: number;
}

export const SWIPE_DELETE_THRESHOLD_RATIO = 0.34;
export const SWIPE_DELETE_MIN_THRESHOLD_PX = 76;
export const SWIPE_DELETE_MAX_REVEAL_PX = 132;

const LOCALES: Record<Language, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-LB',
};

type HistoryFormatterKind = 'day' | 'dayYear' | 'time';
const historyFormatters: Record<Language, Partial<Record<HistoryFormatterKind, Intl.DateTimeFormat>>> = { en: {}, fr: {}, ar: {} };

function historyFormatter(language: Language, kind: HistoryFormatterKind): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = kind === 'time'
    ? { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', year: kind === 'dayYear' ? 'numeric' : undefined, timeZone: 'UTC' };
  const cache = historyFormatters[language];
  if (!cache) return new Intl.DateTimeFormat(undefined, options);
  return cache[kind] ??= new Intl.DateTimeFormat(LOCALES[language], options);
}

// Project current local calendar fields into UTC. Reused formatters therefore
// remain correct after a system timezone change, including historical DST.
function localCalendarDate(timestamp: number): Date {
  const local = new Date(timestamp); const projected = new Date(0);
  projected.setUTCFullYear(local.getFullYear(), local.getMonth(), local.getDate());
  projected.setUTCHours(local.getHours(), local.getMinutes(), local.getSeconds(), local.getMilliseconds());
  return projected;
}

export function formatHistoryDate(timestamp: number, language: Language): string {
  return historyFormatter(language, 'day').format(localCalendarDate(timestamp));
}

export function localeForLanguage(language: Language): string {
  return LOCALES[language];
}

export function localDayStart(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function localDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sortHistoryExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
}

export function searchHistoryExpenses(expenses: Expense[], query: string): Expense[] {
  const sorted = sortHistoryExpenses(expenses);
  const q = query.trim().toLocaleLowerCase();
  if (!q) return sorted;

  return sorted.filter((expense) =>
    expense.description.toLocaleLowerCase().includes(q) ||
    expense.category.toLocaleLowerCase().includes(q) ||
    Boolean(expense.note?.toLocaleLowerCase().includes(q))
  );
}

export function groupHistoryByDay(expenses: Expense[]): HistoryDateGroup[] {
  const groups = new Map<string, HistoryDateGroup>();

  for (const expense of sortHistoryExpenses(expenses)) {
    const key = localDayKey(expense.date);
    const existing = groups.get(key);
    if (existing) {
      existing.expenses.push(expense);
    } else {
      groups.set(key, {
        key,
        dayTimestamp: localDayStart(expense.date),
        expenses: [expense],
      });
    }
  }

  return [...groups.values()];
}

export function filterHistoryByDay(expenses: Expense[], selectedDay: number): Expense[] {
  const key = localDayKey(selectedDay);
  return sortHistoryExpenses(expenses.filter((expense) => localDayKey(expense.date) === key));
}

export function groupHistoryByCategory(expenses: Expense[]): HistoryCategoryGroup[] {
  const groups = new Map<string, Expense[]>();

  for (const expense of sortHistoryExpenses(expenses)) {
    const current = groups.get(expense.category);
    if (current) current.push(expense);
    else groups.set(expense.category, [expense]);
  }

  return [...groups.entries()]
    .map(([category, items]) => ({
      category,
      expenses: items,
      count: items.length,
      total: items.reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}

export function shiftLocalDay(timestamp: number, amount: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + amount, 12, 0, 0, 0).getTime();
}

export function dateInputValue(timestamp: number): string {
  return localDayKey(timestamp);
}

export function dateFromInputValue(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const result = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result.getTime();
}

export function formatHistoryGroupLabel(
  timestamp: number,
  language: Language,
  nowTimestamp = Date.now()
): string {
  const day = localDayStart(timestamp);
  const today = localDayStart(nowTimestamp);
  const yesterday = localDayStart(shiftLocalDay(today, -1));

  if (day === today) {
    if (language === 'fr') return "Aujourd’hui";
    if (language === 'ar') return 'اليوم';
    return 'Today';
  }

  if (day === yesterday) {
    if (language === 'fr') return 'Hier';
    if (language === 'ar') return 'أمس';
    return 'Yesterday';
  }

  const kind = new Date(timestamp).getFullYear() === new Date(nowTimestamp).getFullYear() ? 'day' : 'dayYear';
  return historyFormatter(language, kind).format(localCalendarDate(timestamp));
}

export function formatHistoryTime(timestamp: number, language: Language): string {
  return historyFormatter(language, 'time').format(localCalendarDate(timestamp));
}

export function swipeDeleteProgress(offsetX: number, width: number, isRtl: boolean): number {
  const semanticDistance = Math.max(0, (isRtl ? 1 : -1) * offsetX);
  const threshold = Math.max(
    SWIPE_DELETE_MIN_THRESHOLD_PX,
    Math.min(SWIPE_DELETE_MAX_REVEAL_PX, width * SWIPE_DELETE_THRESHOLD_RATIO)
  );
  return Math.min(1, semanticDistance / Math.max(1, threshold));
}

export function isSwipeDeleteArmed(offsetX: number, width: number, isRtl: boolean): boolean {
  return swipeDeleteProgress(offsetX, width, isRtl) >= 1;
}

export function clampSwipeOffset(offsetX: number, isRtl: boolean): number {
  const semanticDistance = Math.max(0, (isRtl ? 1 : -1) * offsetX);
  const clamped = Math.min(SWIPE_DELETE_MAX_REVEAL_PX, semanticDistance);
  return (isRtl ? 1 : -1) * clamped;
}
