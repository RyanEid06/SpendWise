import React, { useState, useMemo, useEffect, useRef } from 'react';
import { apiFetchJson } from '../utils/api';
import { getAiErrorMessage } from '../utils/apiErrors';
import {
  BarChart3,
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Receipt,
  RotateCw,
  Clock,
  PieChart,
} from 'lucide-react';
import {
  Expense,
  Language,
  MonthlyBudget,
  TimePeriod,
  AiTrendExplanationResult,
} from '../types';
import { MonthYear } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { StatisticsEngine } from '../utils/statisticsEngine';
import { getLocalizedCategoryName, getLocalizedMonthName, t } from '../utils/translations';

interface StatisticsScreenProps {
  expenses: Expense[];
  budgets: MonthlyBudget[];
  currentMonthYear: MonthYear;
  currencyCode: string;
  language: Language;
  onNavigateToExpense?: (expense: Expense) => void;
}

export const StatisticsScreen: React.FC<StatisticsScreenProps> = ({
  expenses,
  budgets,
  currentMonthYear,
  currencyCode,
  language,
  onNavigateToExpense,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('LAST_3_MONTHS');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // AI Trend Explanation state
  const [aiExplanation, setAiExplanation] = useState<AiTrendExplanationResult | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiRequestIdRef = useRef(0);
  const aiInFlightRef = useRef(false);

  // Compute calculated statistics (backed by cache)
  const stats = useMemo(() => {
    return StatisticsEngine.calculateStatistics(
      expenses,
      budgets,
      selectedPeriod,
      currentMonthYear
    );
  }, [expenses, budgets, selectedPeriod, currentMonthYear]);

  useEffect(() => {
    aiRequestIdRef.current += 1;
    aiInFlightRef.current = false;
    setIsLoadingAi(false);
    setAiExplanation(null);
    setAiError(null);
  }, [expenses, budgets, currentMonthYear, selectedPeriod, currencyCode, language]);

  useEffect(() => {
    return () => {
      aiRequestIdRef.current += 1;
      aiInFlightRef.current = false;
    };
  }, []);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'CURRENT_MONTH', label: t(language, 'periodCurrent') },
    { key: 'LAST_3_MONTHS', label: t(language, 'period3M') },
    { key: 'LAST_6_MONTHS', label: t(language, 'period6M') },
    { key: 'LAST_12_MONTHS', label: t(language, 'period12M') },
    { key: 'ALL_TIME', label: t(language, 'periodAll') },
  ];

  const handleExplainWithAi = async () => {
    if (aiInFlightRef.current) return;

    if (stats.totalTransactions === 0) {
      setAiError(t(language, 'noMonthlyRecords'));
      return;
    }

    aiInFlightRef.current = true;
    const requestId = ++aiRequestIdRef.current;
    setIsLoadingAi(true);
    setAiError(null);

    const localFallback = StatisticsEngine.generateLocalTrendExplanation(stats, currencyCode);

    try {
      const data = await apiFetchJson<AiTrendExplanationResult>(
        '/api/gemini/explain-trends',
        {
          method: 'POST',
          body: JSON.stringify({
            stats,
            currencyCode,
            language,
          }),
        },
        30000
      );

      if (requestId !== aiRequestIdRef.current) return;
      setAiExplanation(data);
    } catch (error) {
      if (requestId !== aiRequestIdRef.current) return;
      setAiExplanation(localFallback);
      setAiError(getAiErrorMessage(language, error));
    } finally {
      if (requestId === aiRequestIdRef.current) {
        aiInFlightRef.current = false;
        setIsLoadingAi(false);
      }
    }
  };

  // Max spending among months for bar scaling
  const maxMonthSpent = useMemo(() => {
    const max = Math.max(...stats.monthlyStats.map((m) => m.totalSpent), 1);
    return max;
  }, [stats.monthlyStats]);

  return (
    <div className="space-y-4 pb-28 animate-screen-enter">
      {/* Header title */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {t(language, 'statsTitle')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(language, 'statsSub')} {'\u00B7'} {getLocalizedMonthName(currentMonthYear, language)}
          </p>
        </div>
      </div>

      {/* Time Period Selector Chips */}
      <div className="flex items-center space-x-1.5 rtl:space-x-reverse overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Time Period">
        {periods.map((p) => {
          const isSelected = selectedPeriod === p.key;
          return (
            <button
              key={p.key}
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setSelectedPeriod(p.key);
                setAiExplanation(null);
                setAiError(null);
              }}
              className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 active:scale-95 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#111928] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/90 dark:border-slate-800'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* High-Level Stat Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Spent in Period */}
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-4 shadow-xs space-y-1 transition-colors">
          <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-rose-500" aria-hidden="true"></span>
            <span>{t(language, 'statTotalSpent')}</span>
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(stats.totalSpent, currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t(language, 'statAcrossMonths', {
              count: stats.monthlyStats.length,
              months: stats.monthlyStats.length === 1 ? t(language, 'monthSingle') : t(language, 'monthPlural'),
            })}
          </div>
        </div>

        {/* Average Transaction */}
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-4 shadow-xs space-y-1 transition-colors">
          <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500" aria-hidden="true"></span>
            <span>{t(language, 'statAvgExpense')}</span>
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(stats.averageTransactionAmount, currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t(language, 'statTotalTxns', { count: stats.totalTransactions })}
          </div>
        </div>

        {/* Spending Frequency */}
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-4 shadow-xs space-y-1 transition-colors">
          <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t(language, 'statFrequency')}</span>
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white tracking-tight">
            {stats.averageTransactionsPerMonth.toFixed(1)} {t(language, 'statPerMonth')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {t(language, 'statTxnsPerWeek', { count: Math.round(stats.averageTransactionsPerMonth / 4.3) })}
          </div>
        </div>

        {/* Overall Largest Expense */}
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-4 shadow-xs space-y-1 transition-colors">
          <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs font-semibold text-slate-500 dark:text-slate-400">
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 rtl:rotate-90" />
            <span>{t(language, 'statLargestExpense')}</span>
          </div>
          <div className="text-xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400 tracking-tight">
            {stats.overallLargestExpense
              ? formatCurrency(stats.overallLargestExpense.amount, currencyCode)
              : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {stats.overallLargestExpense ? stats.overallLargestExpense.description : t(language, 'statNoneRecorded')}
          </div>
        </div>
      </div>

      {/* AI Trend Explanation Action Card */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/70 dark:from-indigo-950/80 dark:to-[#131B2E] border border-indigo-200 dark:border-indigo-800/50 rounded-3xl p-4.5 space-y-3 shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/15 dark:bg-indigo-600/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{t(language, 'aiTrendsTitle')}</h3>
              <p className="text-xs text-indigo-900/75 dark:text-indigo-200/70 truncate">
                {t(language, 'aiTrendsSub')}
              </p>
            </div>
          </div>
          <button
            onClick={handleExplainWithAi}
            disabled={isLoadingAi || stats.totalTransactions === 0}
            className="min-h-[44px] flex items-center space-x-1.5 rtl:space-x-reverse px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
          >
            {isLoadingAi ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t(language, 'explainingBtn')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiExplanation ? t(language, 'refreshBtn') : t(language, 'explainBtn')}</span>
              </>
            )}
          </button>
        </div>

        {/* AI Explanation Result Card */}
        {aiExplanation && (
          <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-[#0B0F19]/80 border border-indigo-200 dark:border-indigo-900/60 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                {t(language, 'aiTrendsTitle')}
              </span>
              <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                {t(language, 'trendVerifiedTag')}
              </span>
            </div>

            <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
              {aiExplanation.summary}
            </p>

            {aiExplanation.keyObservations.length > 0 && (
              <div className="space-y-1 pt-1">
                {aiExplanation.keyObservations.map((obs, idx) => (
                  <div key={idx} className="flex items-start space-x-2 rtl:space-x-reverse text-slate-600 dark:text-slate-300">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                    <span>{obs}</span>
                  </div>
                ))}
              </div>
            )}

            {aiExplanation.recommendation && (
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/40 text-indigo-900 dark:text-indigo-200 text-[11px] leading-relaxed">
                <strong className="text-indigo-800 dark:text-indigo-300">{t(language, 'tipLabel')}</strong>
                {aiExplanation.recommendation}
              </div>
            )}
          </div>
        )}

        {aiError && (
          <p className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60">
            {aiError}
          </p>
        )}
      </div>

      {/* Section 1: Monthly Spending Chart & Remaining Money */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {t(language, 'monthlySpendingTitle')}
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {stats.monthlyStats.length} {stats.monthlyStats.length === 1 ? t(language, 'monthSingle') : t(language, 'monthPlural')}
          </span>
        </div>

        {stats.monthlyStats.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">{t(language, 'noMonthlyRecords')}</p>
        ) : (
          <div className="space-y-3 pt-1">
            {stats.monthlyStats.map((item) => {
              const heightPercent = item.totalSpent === 0
                ? 0
                : Math.min(100, Math.max(2, (item.totalSpent / maxMonthSpent) * 100));
              const isRemainingNegative = item.isBudgetSet && item.remainingMoney < 0;

              // Parse year and month from monthKey "YYYY-MM"
              const [y, m] = item.monthKey.split('-').map(Number);
              const localizedMonthName = getLocalizedMonthName({ year: y, month: m }, language);

              return (
                <div key={item.monthKey} className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-900 dark:text-white">{localizedMonthName}{item.isPartialMonth && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400"> {'\u00B7'} {t(language, 'partialMonthLabel')}</span>}</span>
                    </div>
                    <span className="font-extrabold tabular-nums text-sm text-slate-900 dark:text-white">
                      {formatCurrency(item.totalSpent, currencyCode)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Sub details: Remaining & Largest Expense */}
                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 dark:text-slate-400">
                    <div>
                      {item.isBudgetSet ? (
                        <span
                          className={`font-semibold tabular-nums ${
                            isRemainingNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isRemainingNegative ? t(language, 'overByLabel') : t(language, 'remainingLabel')}
                          {formatCurrency(Math.abs(item.remainingMoney), currencyCode)}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic">{t(language, 'noBudgetSetLabel')}</span>
                      )}
                    </div>

                    <div className="text-slate-500 dark:text-slate-400">
                      {item.transactionCount} {t(language, 'txnsLabel')}
                      {item.largestExpense && (
                        <span className="mx-1 text-slate-700 dark:text-slate-300">
                          • {t(language, 'topLabel')}{formatCurrency(item.largestExpense.amount, currencyCode)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Category Percentage Distribution */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <PieChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {t(language, 'catDistributionTitle')}
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {stats.categoryPercentages.length} {stats.categoryPercentages.length === 1 ? t(language, 'categorySingle') : t(language, 'categoryPlural')}
          </span>
        </div>

        {stats.categoryPercentages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">{t(language, 'noMonthlyRecords')}</p>
        ) : (
          <div className="space-y-3.5">
            {/* Multi-segment horizontal bar */}
            <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
              {stats.categoryPercentages.map((item) => (
                <div
                  key={item.category}
                  style={{
                    width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                    backgroundColor: item.color,
                  }}
                  className="h-full transition-all duration-300"
                  title={`${getLocalizedCategoryName(item.category, language)}: ${item.percentage.toFixed(1)}%`}
                />
              ))}
            </div>

            {/* Category percentage list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {stats.categoryPercentages.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60"
                >
                  <div className="flex items-center space-x-2 rtl:space-x-reverse min-w-0">
                    <span className="text-base shrink-0" aria-hidden="true">{item.iconEmoji}</span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {getLocalizedCategoryName(item.category, language)}
                    </span>
                  </div>
                  <div className="text-right rtl:text-left shrink-0">
                    <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(item.amount, currencyCode)}
                    </span>
                    <span
                      style={{ color: item.color }}
                      className="mx-1.5 text-[11px] font-bold"
                    >
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Category Trends Over Time */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {t(language, 'catTrendsTitle')}
            </h3>
          </div>
          <span className="text-xs text-slate-500">{t(language, 'tapToExpand')}</span>
        </div>

        {stats.categoryTrends.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">{t(language, 'noMonthlyRecords')}</p>
        ) : (
          <div className="space-y-2.5">
            {stats.categoryTrends.map((catTrend) => {
              const isExpanded = expandedCategory === catTrend.category;
              const hasUpTrend = catTrend.trendDirection === 'UP';
              const hasDownTrend = catTrend.trendDirection === 'DOWN';
              const localizedCat = getLocalizedCategoryName(catTrend.category, language);

              return (
                <div
                  key={catTrend.category}
                  className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : catTrend.category)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedCategory(isExpanded ? null : catTrend.category);
                      }
                    }}
                    className="min-h-[52px] p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
                      <div>
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {localizedCat}
                          </h4>
                          {hasUpTrend && (
                            <span className="inline-flex items-center text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md">
                              <TrendingUp className="w-3 h-3 mr-0.5 rtl:mr-0 rtl:ml-0.5" />
                              +{Math.round(catTrend.trendPercent)}%
                            </span>
                          )}
                          {hasDownTrend && (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
                              <TrendingDown className="w-3 h-3 mr-0.5 rtl:mr-0 rtl:ml-0.5" />
                              {Math.round(catTrend.trendPercent)}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatCurrency(catTrend.totalSpent, currencyCode)} ({catTrend.percentageOfPeriod.toFixed(1)}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Monthly Breakdown for Category */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        {t(language, 'monthlyHistory')}
                      </div>
                      {catTrend.monthlyData.map((m) => {
                        const [y, mn] = m.monthKey.split('-').map(Number);
                        const monthLabel = getLocalizedMonthName({ year: y, month: mn }, language);
                        return (
                          <div
                            key={m.monthKey}
                            className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/50 dark:border-transparent"
                          >
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{monthLabel}:</span>
                            <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                              {formatCurrency(m.amount, currencyCode)}
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mx-1">
                                ({m.count} {t(language, 'txnsLabel')})
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

      {/* Section 4: Largest Expense by Month */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {t(language, 'largestByMonthTitle')}
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {stats.monthlyStats.map((m) => {
            const exp = m.largestExpense;
            const [y, mn] = m.monthKey.split('-').map(Number);
            const monthLabel = getLocalizedMonthName({ year: y, month: mn }, language);

            return (
              <div
                key={m.monthKey}
                onClick={() => exp && onNavigateToExpense && onNavigateToExpense(exp)}
                role={exp ? 'button' : undefined}
                tabIndex={exp ? 0 : undefined}
                className={`min-h-[52px] p-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 flex items-center justify-between transition-all ${
                  exp ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.99]' : 'opacity-60'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{monthLabel}</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">
                    {exp ? exp.description : t(language, 'statNoneRecorded')}
                  </div>
                  {exp && (
                    <div className="text-[11px] text-slate-500 font-medium">
                      {getLocalizedCategoryName(exp.category, language)}
                    </div>
                  )}
                </div>

                <div className="text-right rtl:text-left">
                  <div className="font-extrabold tabular-nums text-sm sm:text-base text-amber-600 dark:text-amber-400">
                    {exp ? formatCurrency(exp.amount, currencyCode) : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
