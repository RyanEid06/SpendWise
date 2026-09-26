import React from 'react';
import { Expense } from '../types';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';

interface TopExpensesSectionProps {
  topExpenses: Expense[];
  currencyCode: string;
  onExpenseClick: (expense: Expense) => void;
}

export const TopExpensesSection: React.FC<TopExpensesSectionProps> = ({
  topExpenses,
  currencyCode,
  onExpenseClick,
}) => {
  return (
    <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="font-bold text-white text-sm sm:text-base">
          Top 3 Biggest Expenses
        </h3>
      </div>

      {topExpenses.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          No expenses recorded this month yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {topExpenses.map((expense, index) => {
            const catInfo = getCategoryInfo(expense.category);
            return (
              <div
                key={expense.id}
                onClick={() => onExpenseClick(expense)}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#0B0F19] border border-slate-800/60 hover:border-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                    {index + 1}
                  </div>
                  <span className="text-xl shrink-0">{catInfo.iconEmoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">
                      {expense.description}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {expense.category}
                    </p>
                  </div>
                </div>

                <div className="font-extrabold text-sm sm:text-base text-white shrink-0 ml-3">
                  {formatCurrency(expense.amount, currencyCode)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
