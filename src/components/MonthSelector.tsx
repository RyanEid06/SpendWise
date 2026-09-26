import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { MonthYear, getDisplayName } from '../utils/date';

interface MonthSelectorProps {
  currentMonthYear: MonthYear;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  currentMonthYear,
  onPreviousMonth,
  onNextMonth,
}) => {
  return (
    <div className="bg-[#111928] rounded-2xl p-1.5 flex items-center justify-between border border-slate-800/80 shadow-xs">
      <button
        onClick={onPreviousMonth}
        className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        aria-label="Previous Month"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center space-x-2 px-3 py-1">
        <Calendar className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-white text-sm sm:text-base tracking-tight">
          {getDisplayName(currentMonthYear)}
        </span>
      </div>

      <button
        onClick={onNextMonth}
        className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        aria-label="Next Month"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};
