import React, { useState, useMemo, useEffect, useRef } from 'react';
import { apiFetchJson } from '../utils/api';
import { getAiErrorMessage } from '../utils/apiErrors';
import {
  BarChart3,
  CalendarDays,
  Sparkles,
  ArrowUpRight,
  Receipt,
  RotateCw,
  Clock,
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
import { CategoryStatisticsSection } from '../components/CategoryStatisticsSection';
import { getCategoryInfo } from '../utils/categories';
import { rankLargestExpensesByMonth } from '../utils/statisticsRanking';

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
  const [showAllLargestExpenses, setShowAllLargestExpenses] = useState(false);

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

  const rankedLargestExpenses = useMemo(
    () => rankLargestExpensesByMonth(stats.monthlyStats),
    [stats.monthlyStats]
  );
  const visibleLargestExpenses = showAllLargestExpenses
    ? rankedLargestExpenses
    : rankedLargestExpenses.slice(0, 3);

  return (
    <div className="space-y-4 pb-28 animate-screen-enter">
      {/* Header title */}
      <div className="flex items-start justify-between gap-2 px-1">
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
                setShowAllLargestExpenses(false);
              }}
              className={`min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 active:scale-95 ${
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

      {/* Compact 2x2 high-level statistics summary */}
      <div
        data-statistics-summary-grid="2x2"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-200/90 dark:bg-slate-800/80 shadow-xs"
      >
        {/* Total Spent in Period */}
        <div data-stat-summary-cell="true" className="min-w-0 bg-white dark:bg-[#111928] p-3 min-[390px]:p-4 space-y-1 transition-colors">
          <div className="flex items-start gap-1.5 text-[11px] min-[390px]:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight">
            <span className="mt-1 w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-hidden="true"></span>
            <span className="min-w-0">{t(language, 'statTotalSpent')}</span>
          </div>
          <div dir="ltr" className="min-w-0 text-lg min-[390px]:text-xl font-extrabold tabular-nums text-slate-900 dark:text-white tracking-tight [overflow-wrap:anywhere] leading-tight">
            {formatCurrency(stats.totalSpent, currencyCode)}
          </div>
          <div className="text-[10px] min-[390px]:text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
            {t(language, 'statAcrossMonths', {
              count: stats.monthlyStats.length,
              months: stats.monthlyStats.length === 1 ? t(language, 'monthSingle') : t(language, 'monthPlural'),
            })}
          </div>
        </div>

        {/* Average Transaction */}
        <div data-stat-summary-cell="true" className="min-w-0 bg-white dark:bg-[#111928] p-3 min-[390px]:p-4 space-y-1 transition-colors">
          <div className="flex items-start gap-1.5 text-[11px] min-[390px]:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight">
            <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0" aria-hidden="true"></span>
            <span className="min-w-0">{t(language, 'statAvgExpense')}</span>
          </div>
          <div dir="ltr" className="min-w-0 text-lg min-[390px]:text-xl font-extrabold tabular-nums text-slate-900 dark:text-white tracking-tight [overflow-wrap:anywhere] leading-tight">
            {formatCurrency(stats.averageTransactionAmount, currencyCode)}
          </div>
          <div className="text-[10px] min-[390px]:text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
            {t(language, 'statTotalTxns', { count: stats.totalTransactions })}
          </div>
        </div>

        {/* Spending Frequency */}
        <div data-stat-summary-cell="true" className="min-w-0 bg-white dark:bg-[#111928] p-3 min-[390px]:p-4 space-y-1 transition-colors">
          <div className="flex items-start gap-1.5 text-[11px] min-[390px]:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="min-w-0">{t(language, 'statFrequency')}</span>
          </div>
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-1 leading-tight">
            <span className="text-lg min-[390px]:text-xl font-extrabold tabular-nums text-slate-900 dark:text-white tracking-tight">
              {stats.averageTransactionsPerMonth.toFixed(1)}
            </span>
            <span className="text-[10px] min-[390px]:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {t(language, 'statPerMonth')}
            </span>
          </div>
          <div className="text-[10px] min-[390px]:text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
            {t(language, 'statTxnsPerWeek', { count: Math.round(stats.averageTransactionsPerMonth / 4.3) })}
          </div>
        </div>

        {/* Overall Largest Expense */}
        <div data-stat-summary-cell="true" className="min-w-0 bg-white dark:bg-[#111928] p-3 min-[390px]:p-4 space-y-1 transition-colors">
          <div className="flex items-start gap-1.5 text-[11px] min-[390px]:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight">
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 rtl:rotate-90 shrink-0" />
            <span className="min-w-0">{t(language, 'statLargestExpense')}</span>
          </div>
          <div dir="ltr" className="min-w-0 text-lg min-[390px]:text-xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400 tracking-tight [overflow-wrap:anywhere] leading-tight">
            {stats.overallLargestExpense
              ? formatCurrency(stats.overallLargestExpense.amount, currencyCode)
              : '—'}
          </div>
          <div className="text-[10px] min-[390px]:text-[11px] text-slate-500 dark:text-slate-400 truncate leading-snug">
            {stats.overallLargestExpense ? stats.overallLargestExpense.description : t(language, 'statNoneRecorded')}
          </div>
        </div>
      </div>

      {/* AI Trend Explanation Action Card */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/70 dark:from-indigo-950/80 dark:to-[#131B2E] border border-indigo-200 dark:border-indigo-800/50 rounded-3xl p-4.5 space-y-3 shadow-xs transition-colors">
        <div className="flex flex-col min-[390px]:flex-row min-[390px]:items-center justify-between gap-3">
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
            className="w-full min-[390px]:w-auto min-h-[48px] flex items-center justify-center space-x-1.5 rtl:space-x-reverse px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95 shrink-0"
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start space-x-2 rtl:space-x-reverse min-w-0">
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
                  <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
                    <div className="flex items-start space-x-2 rtl:space-x-reverse min-w-0">
                      <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="font-bold text-slate-900 dark:text-white">{localizedMonthName}{item.isPartialMonth && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400"> {'\u00B7'} {t(language, 'partialMonthLabel')}</span>}</span>
                    </div>
                    <span dir="ltr" className="min-w-0 max-w-full font-extrabold tabular-nums text-sm text-slate-900 dark:text-white text-right rtl:text-left [overflow-wrap:anywhere] leading-tight">
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
                  <div className="flex flex-col min-[390px]:flex-row min-[390px]:items-start justify-between gap-1.5 text-[11px] pt-1 text-slate-500 dark:text-slate-400">
                    <div>
                      {item.isBudgetSet ? (
                        <span
                          className={`font-semibold tabular-nums ${
                            isRemainingNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isRemainingNegative ? t(language, 'overByLabel') : t(language, 'remainingLabel')}
                          <span dir="ltr" className="inline-block [overflow-wrap:anywhere]">
                            {formatCurrency(Math.abs(item.remainingMoney), currencyCode)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic">{t(language, 'noBudgetSetLabel')}</span>
                      )}
                    </div>

                    <div className="min-w-0 text-slate-500 dark:text-slate-400 [overflow-wrap:anywhere]">
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

      {/* Section 2: merged category distribution + trends */}
      <CategoryStatisticsSection
        stats={stats}
        currencyCode={currencyCode}
        language={language}
        expandedCategory={expandedCategory}
        onToggleCategory={(category) =>
          setExpandedCategory((current) => current === category ? null : category)
        }
      />

      {/* Section 4: Largest Expense by Month */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 rtl:space-x-reverse min-w-0">
            <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {t(language, 'largestByMonthTitle')}
            </h3>
          </div>
        </div>

        {rankedLargestExpenses.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
            {t(language, 'noMonthlyRecords')}
          </p>
        ) : (
          <div className="space-y-2.5">
            {visibleLargestExpenses.map(({ rank, month, expense }) => {
              const [year, monthNumber] = month.monthKey.split('-').map(Number);
              const monthLabel = getLocalizedMonthName({ year, month: monthNumber }, language);
              const categoryInfo = getCategoryInfo(expense.category);

              const rowTone =
                rank === 1
                  ? 'bg-amber-50/60 dark:bg-amber-950/15 border-amber-200/80 dark:border-amber-900/50'
                  : rank === 2
                    ? 'bg-slate-50 dark:bg-[#0B0F19] border-slate-300/70 dark:border-slate-700/70'
                    : rank === 3
                      ? 'bg-stone-50/70 dark:bg-[#0B0F19] border-stone-300/70 dark:border-stone-800/80'
                      : 'bg-white dark:bg-[#0B0F19] border-slate-200/70 dark:border-slate-800/60';

              const rankTone =
                rank === 1
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                  : rank === 2
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    : rank === 3
                      ? 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400';

              const isNavigable = Boolean(onNavigateToExpense);

              return (
                <div
                  key={month.monthKey}
                  onClick={() => onNavigateToExpense?.(expense)}
                  role={isNavigable ? 'button' : undefined}
                  tabIndex={isNavigable ? 0 : undefined}
                  aria-label={String(rank) + ', ' + expense.description + ', ' + monthLabel + ', ' + formatCurrency(expense.amount, currencyCode)}
                  onKeyDown={(event) => {
                    if (!onNavigateToExpense) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onNavigateToExpense(expense);
                    }
                  }}
                  className={'min-h-[56px] flex flex-col min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between gap-2.5 p-3 rounded-2xl border transition-all ' + rowTone + (isNavigable ? ' cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.99]' : '')}
                >
                  <div className="min-w-0 flex-1 flex items-start gap-2.5">
                    <div className={'min-w-8 h-7 px-1.5 rounded-full flex items-center justify-center font-extrabold text-[11px] tabular-nums shrink-0 ' + rankTone}>
                      {rank}
                    </div>
                    <span className="text-xl shrink-0" aria-hidden="true">{categoryInfo.iconEmoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white leading-tight break-words">
                        {expense.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="break-words">{getLocalizedCategoryName(expense.category, language)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-300 break-words">{monthLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    dir="ltr"
                    className={'min-w-0 max-w-full min-[390px]:max-w-[42%] font-extrabold tabular-nums text-sm sm:text-base [overflow-wrap:anywhere] leading-tight text-left min-[390px]:text-right rtl:min-[390px]:text-left ' + (rank === 1 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white')}
                  >
                    {formatCurrency(expense.amount, currencyCode)}
                  </div>
                </div>
              );
            })}
            {rankedLargestExpenses.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllLargestExpenses((current) => !current)}
                aria-expanded={showAllLargestExpenses}
                className="w-full min-h-[44px] rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/25 transition-colors"
              >
                {t(language, showAllLargestExpenses ? 'showTopThree' : 'showAll')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
