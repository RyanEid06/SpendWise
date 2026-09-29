import React from 'react';
import { Receipt } from 'lucide-react';
import { Expense, Language } from '../types';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName, t } from '../utils/translations';

interface TopExpensesSectionProps {
  topExpenses: Expense[];
  currencyCode: string;
  language: Language;
  onExpenseClick: (expense: Expense) => void;
}

export const TopExpensesSection: React.FC<TopExpensesSectionProps> = ({
  topExpenses,
  currencyCode,
  language,
  onExpenseClick,
}) => {
  return (
    <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
          {t(language, 'topExpensesTitle')}
        </h3>
        {topExpenses.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t(language, 'thisMonth')}
          </span>
        )}
      </div>

      {topExpenses.length === 0 ? (
        <div className="py-7 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
            <Receipt className="w-5 h-5" />
          </div>
          <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
            {t(language, 'topExpensesEmptyTitle')}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            {t(language, 'topExpensesEmptySub')}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {topExpenses.map((expense, index) => {
            const catInfo = getCategoryInfo(expense.category);
            return (
              <div
                key={expense.id}
                onClick={() => onExpenseClick(expense)}
                role="button"
                tabIndex={0}
                aria-label={`${expense.description}, ${formatCurrency(expense.amount, currencyCode)}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onExpenseClick(expense);
                  }
                }}
                className="min-h-[56px] flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer active:scale-[0.99] group"
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-extrabold text-xs shrink-0">
                    {index + 1}
                  </div>
                  <span className="text-xl shrink-0" aria-hidden="true">{catInfo.iconEmoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {expense.description}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {getLocalizedCategoryName(expense.category, language)}
                    </p>
                  </div>
                </div>

                <div dir="ltr" className="min-w-0 max-w-[45%] font-extrabold text-sm sm:text-base tabular-nums text-slate-900 dark:text-white text-right rtl:text-left [overflow-wrap:anywhere] leading-tight">
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
