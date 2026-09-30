import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Info,
  Minus,
  PieChart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Language, StatisticsOverview } from '../types';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName, getLocalizedMonthName, t } from '../utils/translations';
import { wp17Copy } from '../utils/wp17Copy';
import { getCategoryInfo } from '../utils/categories';
import { CategorySpendRow } from './CategorySpendRow';

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
            const categoryInfo = getCategoryInfo(catTrend.category);

            let TrendIcon = Minus;
            let trendLabel = wp17Copy(language, 'trendStable');
            let trendTone = 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border-sky-200/80 dark:border-sky-900/60';
            let trendState = 'STABLE';

            if (!catTrend.hasComparableHistory) {
              TrendIcon = Info;
              trendLabel = wp17Copy(language, 'trendUnavailable');
              trendTone = 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800';
              trendState = 'INSUFFICIENT_HISTORY';
            } else if (catTrend.trendDirection === 'UP') {
              TrendIcon = TrendingUp;
              trendLabel = wp17Copy(language, 'trendUp');
              trendTone = 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200/80 dark:border-rose-900/60';
              trendState = 'UP';
            } else if (catTrend.trendDirection === 'DOWN') {
              TrendIcon = TrendingDown;
              trendLabel = wp17Copy(language, 'trendDown');
              trendTone = 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/80 dark:border-emerald-900/60';
              trendState = 'DOWN';
            }

            const trendPercentLabel =
              catTrend.hasComparableHistory && catTrend.trendDirection !== 'STABLE'
                ? (catTrend.trendPercent > 0 ? '+' : '') + Math.round(catTrend.trendPercent) + '%'
                : null;

            const localizedCategory = getLocalizedCategoryName(catTrend.category, language);

            return (
              <div
                key={catTrend.category}
                className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onToggleCategory(catTrend.category)}
                  aria-expanded={isExpanded}
                  aria-label={(isExpanded ? wp17Copy(language, 'collapseCategory') : wp17Copy(language, 'expandCategory')) + ': ' + localizedCategory}
                  className="w-full min-h-[56px] p-3.5 text-left rtl:text-right hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                >
                  <CategorySpendRow
                    categoryName={catTrend.category}
                    amount={catTrend.totalSpent}
                    percentage={catTrend.percentageOfPeriod}
                    iconEmoji={categoryInfo.iconEmoji}
                    color={categoryInfo.color}
                    currencyCode={currencyCode}
                    language={language}
                  />

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span
                      data-trend-state={trendState}
                      className={'min-w-0 inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border ' + trendTone}
                    >
                      <TrendIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">{trendLabel}</span>
                      {trendPercentLabel && (
                        <span dir="ltr" className="tabular-nums shrink-0">{trendPercentLabel}</span>
                      )}
                    </span>

                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      <span className="hidden min-[360px]:inline">{t(language, 'tapToExpand')}</span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4" aria-hidden="true" />
                        : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t(language, 'monthlyHistory')}
                    </p>
                    {catTrend.monthlyData.map((item) => {
                      const [year, month] = item.monthKey.split('-').map(Number);
                      return (
                        <div
                          key={item.monthKey}
                          className="flex flex-col min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between gap-1.5 min-[360px]:gap-3 text-xs py-1.5 px-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/50 dark:border-transparent"
                        >
                          <span className="text-slate-600 dark:text-slate-300 break-words">
                            {getLocalizedMonthName({ year, month }, language)}
                          </span>
                          <span dir="ltr" className="min-w-0 font-bold tabular-nums text-slate-900 dark:text-white text-left min-[360px]:text-right rtl:min-[360px]:text-left [overflow-wrap:anywhere]">
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
