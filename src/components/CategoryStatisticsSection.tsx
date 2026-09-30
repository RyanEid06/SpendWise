import React from 'react';
import { ChevronDown, ChevronUp, PieChart, TrendingDown, TrendingUp } from 'lucide-react';
import { Language, StatisticsOverview } from '../types';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName, getLocalizedMonthName, t } from '../utils/translations';
import { wp17Copy } from '../utils/wp17Copy';

interface Props {
  stats: StatisticsOverview;
  currencyCode: string;
  language: Language;
  expandedCategory: string | null;
  onToggleCategory: (category: string) => void;
}

export const CategoryStatisticsSection: React.FC<Props> = ({
  stats,
  currencyCode,
  language,
  expandedCategory,
  onToggleCategory,
}) => {
  return (
    <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-4 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start space-x-2 rtl:space-x-reverse min-w-0">
          <PieChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
            {wp17Copy(language, 'spendingByCategory')}
          </h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {stats.categoryTrends.length} {stats.categoryTrends.length === 1 ? t(language, 'categorySingle') : t(language, 'categoryPlural')}
        </span>
      </div>

      {stats.categoryTrends.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">{t(language, 'noMonthlyRecords')}</p>
      ) : (
        <div className="space-y-2.5">
          {stats.categoryTrends.map((catTrend) => {
            const isExpanded = expandedCategory === catTrend.category;
            const hasComparableHistory = catTrend.monthlyData.filter((item) => item.amount > 0).length >= 2;
            const trendLabel = !hasComparableHistory
              ? wp17Copy(language, 'trendUnavailable')
              : catTrend.trendDirection === 'UP'
                ? wp17Copy(language, 'trendUp')
                : catTrend.trendDirection === 'DOWN'
                  ? wp17Copy(language, 'trendDown')
                  : wp17Copy(language, 'trendStable');

            return (
              <div key={catTrend.category} className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onToggleCategory(catTrend.category)}
                  aria-expanded={isExpanded}
                  className="w-full min-h-[52px] p-3.5 flex items-center justify-between gap-3 text-left rtl:text-right hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {getLocalizedCategoryName(catTrend.category, language)}
                    </div>
                    <div dir="ltr" className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 [overflow-wrap:anywhere]">
                      {formatCurrency(catTrend.totalSpent, currencyCode)} · {catTrend.percentageOfPeriod.toFixed(1)}%
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${
                        !hasComparableHistory || catTrend.trendDirection === 'STABLE'
                          ? 'text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800'
                          : catTrend.trendDirection === 'UP'
                            ? 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60'
                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60'
                      }`}
                    >
                      {hasComparableHistory && catTrend.trendDirection === 'UP' && <TrendingUp className="w-3 h-3" />}
                      {hasComparableHistory && catTrend.trendDirection === 'DOWN' && <TrendingDown className="w-3 h-3" />}
                      <span>
                        {trendLabel}
                        {hasComparableHistory && catTrend.trendDirection !== 'STABLE'
                          ? ` ${catTrend.trendPercent > 0 ? '+' : ''}${Math.round(catTrend.trendPercent)}%`
                          : ''}
                      </span>
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                    {catTrend.monthlyData.map((item) => {
                      const [year, month] = item.monthKey.split('-').map(Number);
                      return (
                        <div key={item.monthKey} className="flex items-center justify-between gap-3 text-xs py-1.5 px-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/50 dark:border-transparent">
                          <span className="text-slate-600 dark:text-slate-300">
                            {getLocalizedMonthName({ year, month }, language)}
                          </span>
                          <span dir="ltr" className="font-bold tabular-nums text-slate-900 dark:text-white text-right">
                            {formatCurrency(item.amount, currencyCode)}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mx-1">
                              ({item.count})
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
