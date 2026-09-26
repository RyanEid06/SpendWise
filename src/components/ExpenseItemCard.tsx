import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Expense } from '../types';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { formatShortDate } from '../utils/date';

interface ExpenseItemCardProps {
  expense: Expense;
  currencyCode: string;
  onClick: () => void;
  onDeleteClick: (e: React.MouseEvent) => void;
}

export const ExpenseItemCard: React.FC<ExpenseItemCardProps> = ({
  expense,
  currencyCode,
  onClick,
  onDeleteClick,
}) => {
  const catInfo = getCategoryInfo(expense.category);

  return (
    <div
      onClick={onClick}
      className="bg-[#111928] border border-slate-800/80 rounded-2xl p-3.5 shadow-sm hover:border-slate-700 transition-all cursor-pointer flex items-center justify-between group"
    >
      <div className="flex items-center space-x-3.5 min-w-0">
        <div
          style={{ backgroundColor: `${catInfo.color}25` }}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
        >
          {catInfo.iconEmoji}
        </div>

        <div className="min-w-0">
          <h4 className="font-bold text-white text-sm sm:text-base truncate">
            {expense.description}
          </h4>

          <div className="flex items-center space-x-1.5 text-xs mt-0.5">
            <span style={{ color: catInfo.color }} className="font-semibold">
              {expense.category}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              {formatShortDate(expense.date)}
            </span>
          </div>

          {expense.note && (
            <p className="text-xs text-slate-400 truncate mt-0.5 max-w-xs sm:max-w-md">
              {expense.note}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0 ml-3">
        <div className="text-right">
          <div className="font-extrabold text-sm sm:text-base text-white">
            {formatCurrency(expense.amount, currencyCode)}
          </div>
        </div>

        <div className="flex items-center space-x-1 pl-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(e);
            }}
            className="p-1.5 rounded-xl hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
