import React from 'react';
import { Expense, CategorySpend, Language } from '../types';
import { MonthYear } from '../utils/date';
import { MonthSelector } from '../components/MonthSelector';
import { BudgetSummaryCards } from '../components/BudgetSummaryCards';
import { TopExpensesSection } from '../components/TopExpensesSection';
import { CategoryBreakdownSection } from '../components/CategoryBreakdownSection';
import { getLocalizedMonthName, t } from '../utils/translations';

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
  language: Language;
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
  language,
  onPreviousMonth,
  onNextMonth,
  onSetBudgetClick,
  onExpenseClick,
}) => {
  return (
    <div className="space-y-4 pb-12 animate-screen-enter">
      {/* 1. Month Selector */}
      <MonthSelector
        currentMonthYear={currentMonthYear}
        language={language}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />

      {/* 2. Budget Summary Cards */}
      <BudgetSummaryCards
        startingMoney={startingMoney}
        isBudgetSet={isBudgetSet}
        totalSpent={totalSpent}
        remainingMoney={remainingMoney}
        progress={progress}
        currencyCode={currencyCode}
        language={language}
        monthName={getLocalizedMonthName(currentMonthYear, language)}
        onSetBudgetClick={onSetBudgetClick}
      />

      {/* 3. Top 3 Biggest Expenses Section */}
      <TopExpensesSection
        topExpenses={topExpenses}
        currencyCode={currencyCode}
        language={language}
        onExpenseClick={onExpenseClick}
      />

      {/* 4. Category Breakdown Section */}
      <CategoryBreakdownSection
        categoryBreakdown={categoryBreakdown}
        currencyCode={currencyCode}
        language={language}
      />

    </div>
  );
};
