import React from 'react';
import { Expense, CategorySpend } from '../types';
import { MonthYear } from '../utils/date';
import { MonthSelector } from '../components/MonthSelector';
import { BudgetSummaryCards } from '../components/BudgetSummaryCards';
import { TopExpensesSection } from '../components/TopExpensesSection';
import { CategoryBreakdownSection } from '../components/CategoryBreakdownSection';

interface DashboardScreenProps {
  currentMonthYear: MonthYear;
  startingMoney: number;
  isBudgetSet: boolean;
  totalSpent: number;
  remainingMoney: number;
  progress: number;
  topExpenses: Expense[];
  categoryBreakdown: CategorySpend[];
  currencyCode: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSetBudgetClick: () => void;
  onExpenseClick: (expense: Expense) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  currentMonthYear,
  startingMoney,
  isBudgetSet,
  totalSpent,
  remainingMoney,
  progress,
  topExpenses,
  categoryBreakdown,
  currencyCode,
  onPreviousMonth,
  onNextMonth,
  onSetBudgetClick,
  onExpenseClick,
}) => {
  return (
    <div className="space-y-4 pb-28">
      {/* Month Selector */}
      <MonthSelector
        currentMonthYear={currentMonthYear}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />

      {/* Budget Summary Cards */}
      <BudgetSummaryCards
        startingMoney={startingMoney}
        isBudgetSet={isBudgetSet}
        totalSpent={totalSpent}
        remainingMoney={remainingMoney}
        progress={progress}
        currencyCode={currencyCode}
        monthName={new Date(currentMonthYear.year, currentMonthYear.month - 1, 1).toLocaleDateString(
          'en-US',
          { month: 'long', year: 'numeric' }
        )}
        onSetBudgetClick={onSetBudgetClick}
      />

      {/* Top 3 Expenses Section */}
      <TopExpensesSection
        topExpenses={topExpenses}
        currencyCode={currencyCode}
        onExpenseClick={onExpenseClick}
      />

      {/* Category Breakdown Section */}
      <CategoryBreakdownSection
        categoryBreakdown={categoryBreakdown}
        currencyCode={currencyCode}
      />
    </div>
  );
};
