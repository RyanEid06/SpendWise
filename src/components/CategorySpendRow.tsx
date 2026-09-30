import React from 'react';
import { Language } from '../types';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName } from '../utils/translations';

interface CategorySpendRowProps {
  categoryName: string;
  amount: number;
  percentage: number;
  iconEmoji: string;
  color: string;
  currencyCode: string;
  language: Language;
}

export const CategorySpendRow: React.FC<CategorySpendRowProps> = ({
  categoryName,
  amount,
  percentage,
  iconEmoji,
  color,
  currencyCode,
  language,
}) => {
  const safePercentage = Number.isFinite(percentage)
    ? Math.min(100, Math.max(0, percentage))
    : 0;
  const localizedCategory = getLocalizedCategoryName(categoryName, language);

  return (
    <div data-category-spend-base="true" className="min-w-0 space-y-1.5">
      <div className="flex items-start justify-between gap-2 text-xs sm:text-sm">
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base shrink-0" aria-hidden="true">{iconEmoji}</span>
          <span className="min-w-0 font-semibold text-slate-800 dark:text-slate-200 leading-tight break-words">
            {localizedCategory}
          </span>
          <span
            style={{ color, backgroundColor: color + '15' }}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border border-current/20"
          >
            {percentage.toFixed(1)}%
          </span>
        </div>

        <span
          dir="ltr"
          className="min-w-0 max-w-[44%] font-bold tabular-nums text-slate-900 dark:text-white text-right rtl:text-left [overflow-wrap:anywhere] leading-tight"
        >
          {formatCurrency(amount, currencyCode)}
        </span>
      </div>

      <div
        className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden"
        role="progressbar"
        aria-label={localizedCategory}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(safePercentage.toFixed(1))}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: safePercentage + '%',
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};
