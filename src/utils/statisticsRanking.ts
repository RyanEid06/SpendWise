import { Expense, MonthlySpendingStat } from '../types';

export interface RankedMonthlyLargestExpense {
  rank: number;
  month: MonthlySpendingStat;
  expense: Expense;
}

/**
 * Rank only months that contain an expense.
 * Ties are deterministic: newer month first, then lower expense id.
 * The input array and its month objects are never mutated.
 */
export function rankLargestExpensesByMonth(
  monthlyStats: readonly MonthlySpendingStat[]
): RankedMonthlyLargestExpense[] {
  return monthlyStats
    .flatMap((month) => (
      month.largestExpense
        ? [{ month, expense: month.largestExpense }]
        : []
    ))
    .sort((a, b) => {
      const amountDifference = b.expense.amount - a.expense.amount;
      if (amountDifference !== 0) return amountDifference;

      if (a.month.monthKey !== b.month.monthKey) {
        return a.month.monthKey > b.month.monthKey ? -1 : 1;
      }

      return a.expense.id - b.expense.id;
    })
    .map((entry, index) => ({
      rank: index + 1,
      month: entry.month,
      expense: entry.expense,
    }));
}
