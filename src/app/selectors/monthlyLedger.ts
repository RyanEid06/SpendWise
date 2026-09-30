import { CategorySpend, Expense, MonthlyBudget } from '../../types';
import { MonthYear, getEndOfMonthTimestamp, getMonthKey, getStartOfMonthTimestamp } from '../../utils/date';
import { getCategoryInfo } from '../../utils/categories';

export interface MonthlyLedgerSelection {
  monthlyExpenses: Expense[];
  currentBudget: MonthlyBudget | null;
  startingMoney: number;
  isBudgetSet: boolean;
  totalSpent: number;
  remainingMoney: number;
  progress: number;
  topExpenses: Expense[];
  categoryBreakdown: CategorySpend[];
}

export function selectMonthlyLedger(
  expenses: Expense[],
  budgets: MonthlyBudget[],
  currentMonthYear: MonthYear
): MonthlyLedgerSelection {
  const start = getStartOfMonthTimestamp(currentMonthYear);
  const end = getEndOfMonthTimestamp(currentMonthYear);
  const monthlyExpenses = expenses.filter((expense) => expense.date >= start && expense.date <= end);

  const currentBudget =
    budgets.find((budget) => budget.monthKey === getMonthKey(currentMonthYear)) ?? null;
  const startingMoney = currentBudget?.startingAmount || 0;
  const isBudgetSet = currentBudget !== null;
  const totalSpent = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remainingMoney = startingMoney - totalSpent;
  const progress = startingMoney > 0 ? totalSpent / startingMoney : 0;
  const topExpenses = [...monthlyExpenses].sort((a, b) => b.amount - a.amount).slice(0, 3);

  const grouped: Record<string, number> = {};
  for (const expense of monthlyExpenses) {
    grouped[expense.category] = (grouped[expense.category] || 0) + expense.amount;
  }

  const categoryBreakdown: CategorySpend[] = Object.entries(grouped)
    .map(([categoryName, amount]) => {
      const info = getCategoryInfo(categoryName);
      return {
        categoryName,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
        iconEmoji: info.iconEmoji,
        color: info.color,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    monthlyExpenses,
    currentBudget,
    startingMoney,
    isBudgetSet,
    totalSpent,
    remainingMoney,
    progress,
    topExpenses,
    categoryBreakdown,
  };
}
