import React from 'react';
import { PieChart } from 'lucide-react';
import { CategorySpend, Language } from '../types';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName, t } from '../utils/translations';

interface CategoryBreakdownSectionProps {
  categoryBreakdown: CategorySpend[];
  currencyCode: string;
  language: Language;
}

export const CategoryBreakdownSection: React.FC<CategoryBreakdownSectionProps> = ({
  categoryBreakdown,
  currencyCode,
  language,
}) => {
  return (
    <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
          {t(language, 'categoryBreakdownTitle')}
        </h3>
        {categoryBreakdown.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t(language, 'categoryCount', {
              count: categoryBreakdown.length,
              label: categoryBreakdown.length === 1 ? t(language, 'categorySingle') : t(language, 'categoryPlural'),
            })}
          </span>
        )}
      </div>

      {categoryBreakdown.length === 0 ? (
        <div className="py-7 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
            <PieChart className="w-5 h-5" />
          </div>
          <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
            {t(language, 'categoryBreakdownEmptyTitle')}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            {t(language, 'categoryBreakdownEmptySub')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Multi-color distribution bar */}
          <div
            className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex"
            role="progressbar"
            aria-label={t(language, 'categoryBreakdownTitle')}
          >
            {categoryBreakdown.map((item) => (
              <div
                key={item.categoryName}
                style={{
                  width: `${Math.max(1, item.percentage)}%`,
                  backgroundColor: item.color,
                }}
                className="h-full transition-all duration-500 ease-out"
                title={`${getLocalizedCategoryName(item.categoryName, language)}: ${item.percentage.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Detailed category rows */}
          <div className="space-y-3 pt-1">
            {categoryBreakdown.map((item) => (
              <div key={item.categoryName} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse min-w-0">
                    <span className="text-base shrink-0" aria-hidden="true">{item.iconEmoji}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {getLocalizedCategoryName(item.categoryName, language)}
                    </span>
                    <span
                      style={{ color: item.color, backgroundColor: `${item.color}15` }}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border border-current/20"
                    >
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <span className="font-bold tabular-nums text-slate-900 dark:text-white shrink-0 mx-2">
                    {formatCurrency(item.amount, currencyCode)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
