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
  onAddExpenseClick: () => void;
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
  onAddExpenseClick,
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

      {/* 5. Fixed/Stationary Add Expense Button at bottom of Home ("down, down, down") */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onAddExpenseClick}
          className="w-full min-h-[52px] py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <span className="text-xl leading-none font-black">+</span>
          <span>{t(language, 'addExpenseBtn')}</span>
        </button>
      </div>
    </div>
  );
};
