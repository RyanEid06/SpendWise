import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { MonthYear } from '../utils/date';
import { Language } from '../types';
import { getLocalizedMonthName, t } from '../utils/translations';

interface MonthSelectorProps {
  currentMonthYear: MonthYear;
  language: Language;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  currentMonthYear,
  language,
  onPreviousMonth,
  onNextMonth,
}) => {
  return (
    <div className="bg-white dark:bg-[#111928] rounded-2xl p-1.5 flex items-center justify-between border border-slate-200/90 dark:border-slate-800/80 shadow-xs transition-colors">
      <button
        onClick={onPreviousMonth}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer active:scale-95"
        aria-label={t(language, 'prevMonth')}
      >
        <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
      </button>

      <div className="flex items-center space-x-2 rtl:space-x-reverse px-3 py-1">
        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
          {getLocalizedMonthName(currentMonthYear, language)}
        </span>
      </div>

      <button
        onClick={onNextMonth}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer active:scale-95"
        aria-label={t(language, 'nextMonth')}
      >
        <ChevronRight className="w-5 h-5 rtl:rotate-180" />
      </button>
    </div>
  );
};
