import type { Expense, ExpenseAttachment } from '../types';
import { normalizeCategoryName } from './categories';
import { localDayKey } from './historyView';

export interface MediaLibraryGroup {
  key: string;
  timestamp: number | null;
  items: ExpenseAttachment[];
}

export function validMediaTimestamp(value: number | undefined | null): value is number {
  return typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime());
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function groupMediaByExpenseDate(
  attachments: ExpenseAttachment[],
  expenses: Expense[]
): MediaLibraryGroup[] {
  const expenseDates = new Map(
    expenses
      .filter((expense) => validMediaTimestamp(expense.date))
      .map((expense) => [expense.id, expense.date] as const)
  );

  const ordered = attachments
    .map((attachment) => {
      const expenseDate = expenseDates.get(attachment.expenseId);
      const preferredTimestamp = validMediaTimestamp(expenseDate)
        ? expenseDate
        : validMediaTimestamp(attachment.createdAt)
          ? attachment.createdAt
          : null;
      return { attachment, preferredTimestamp };
    })
    .sort((left, right) => {
      const leftTime = left.preferredTimestamp ?? -1;
      const rightTime = right.preferredTimestamp ?? -1;
      if (leftTime !== rightTime) return rightTime - leftTime;
      if (left.attachment.createdAt !== right.attachment.createdAt) {
        return right.attachment.createdAt - left.attachment.createdAt;
      }
      return left.attachment.id.localeCompare(right.attachment.id);
    });

  const groups: MediaLibraryGroup[] = [];
  const groupsByKey = new Map<string, MediaLibraryGroup>();

  for (const entry of ordered) {
    const key = entry.preferredTimestamp === null
      ? 'unknown'
      : localDateKey(entry.preferredTimestamp);
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        key,
        timestamp: entry.preferredTimestamp,
        items: [],
      };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.items.push(entry.attachment);
  }

  return groups;
}

/** Reuse the exact calendar-day keys shown in the All view, including expense-date fallback. */
export function filterMediaGroupsByDay(groups: MediaLibraryGroup[], selectedDay: number): MediaLibraryGroup[] {
  if (!validMediaTimestamp(selectedDay)) return [];
  const key = localDayKey(selectedDay);
  return groups.filter((group) => group.key === key);
}

export interface MediaCategoryGroup {
  category: string | null;
  items: ExpenseAttachment[];
}

/** Only persisted expense associations determine category; orphaned photos remain accessible. */
export function groupMediaByCategory(
  attachments: ExpenseAttachment[],
  expenses: Expense[]
): MediaCategoryGroup[] {
  const categories = new Map(expenses.map((expense) => [expense.id, normalizeCategoryName(expense.category)] as const));
  const groups = new Map<string | null, MediaCategoryGroup>();
  for (const attachment of groupMediaByExpenseDate(attachments, expenses).flatMap((group) => group.items)) {
    const category = categories.get(attachment.expenseId)?.trim() || null;
    const existing = groups.get(category);
    if (existing) existing.items.push(attachment);
    else groups.set(category, { category, items: [attachment] });
  }
  return [...groups.values()].sort((left, right) =>
    right.items.length - left.items.length || (left.category ?? '').localeCompare(right.category ?? '')
  );
}
