import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Receipt,
  RotateCw,
  Info,
  Clock,
  PieChart,
} from 'lucide-react';
import {
  Expense,
  MonthlyBudget,
  Screen,
  TimePeriod,
  AiTrendExplanationResult,
} from '../types';
import { MonthYear } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { StatisticsEngine } from '../utils/statisticsEngine';

interface StatisticsScreenProps {
  expenses: Expense[];
  budgets: MonthlyBudget[];
  currentMonthYear: MonthYear;
  currencyCode: string;
  onNavigateToExpense?: (expense: Expense) => void;
}

export const StatisticsScreen: React.FC<StatisticsScreenProps> = ({
  expenses,
  budgets,
  currentMonthYear,
  currencyCode,
  onNavigateToExpense,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('LAST_3_MONTHS');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // AI Trend Explanation state
  const [aiExplanation, setAiExplanation] = useState<AiTrendExplanationResult | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Compute calculated statistics (backed by cache)
  const stats = useMemo(() => {
    return StatisticsEngine.calculateStatistics(
      expenses,
      budgets,
      selectedPeriod,
      currentMonthYear
    );
  }, [expenses, budgets, selectedPeriod, currentMonthYear]);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: 'CURRENT_MONTH', label: 'Current' },
    { key: 'LAST_3_MONTHS', label: '3 Months' },
    { key: 'LAST_6_MONTHS', label: '6 Months' },
    { key: 'LAST_12_MONTHS', label: '12 Months' },
    { key: 'ALL_TIME', label: 'All Time' },
  ];

  const handleExplainWithAi = async () => {
    if (stats.totalTransactions === 0) {
      setAiError('No transactions available in this period to explain.');
      return;
    }

    setIsLoadingAi(true);
    setAiError(null);

    const localFallback = StatisticsEngine.generateLocalTrendExplanation(stats, currencyCode);

    try {
      const prompt = StatisticsEngine.buildTrendExplanationPrompt(stats, currencyCode);
      const res = await fetch('/api/gemini/explain-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          periodLabel: stats.periodLabel,
        }),
      });

      if (!res.ok) {
        throw new Error('AI analysis temporarily busy, using verified local synthesis');
      }

      const data = await res.json();
      setAiExplanation(data);
    } catch (err: any) {
      // Fallback cleanly to verified local synthesis without breaking UI
      setAiExplanation(localFallback);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Max spending among months for bar scaling
  const maxMonthSpent = useMemo(() => {
    const max = Math.max(...stats.monthlyStats.map((m) => m.totalSpent), 1);
    return max;
  }, [stats.monthlyStats]);

  return (
    <div className="space-y-4 pb-28">
      {/* Header title */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">
            Statistics & Trends
          </h2>
          <p className="text-xs text-slate-400">
            Real calculated numbers from your personal records
          </p>
        </div>
      </div>

      {/* Time Period Selector Chips */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
        {periods.map((p) => {
          const isSelected = selectedPeriod === p.key;
          return (
            <button
              key={p.key}
              onClick={() => {
                setSelectedPeriod(p.key);
                setAiExplanation(null);
                setAiError(null);
              }}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-[#111928] text-slate-400 hover:text-slate-200 border border-slate-800'
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
        <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-4 shadow-sm space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Total Spent</span>
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight">
            {formatCurrency(stats.totalSpent, currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Across {stats.monthlyStats.length} {stats.monthlyStats.length === 1 ? 'month' : 'months'}
          </div>
        </div>

        {/* Average Transaction */}
        <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-4 shadow-sm space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span>Average Expense</span>
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight">
            {formatCurrency(stats.averageTransactionAmount, currencyCode)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {stats.totalTransactions} total transactions
          </div>
        </div>

        {/* Spending Frequency */}
        <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-4 shadow-sm space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Frequency</span>
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight">
            {stats.averageTransactionsPerMonth.toFixed(1)} / mo
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            ~{Math.round(stats.averageTransactionsPerMonth / 4.3)} transactions/week
          </div>
        </div>

        {/* Overall Largest Expense */}
        <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-4 shadow-sm space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
            <span>Largest Expense</span>
          </div>
          <div className="text-xl font-extrabold text-amber-400 tracking-tight">
            {stats.overallLargestExpense
              ? formatCurrency(stats.overallLargestExpense.amount, currencyCode)
              : '—'}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {stats.overallLargestExpense ? stats.overallLargestExpense.description : 'None recorded'}
          </div>
        </div>
      </div>

      {/* AI Trend Explanation Action Banner */}
      <div className="bg-gradient-to-r from-indigo-950/80 to-[#131B2E] border border-indigo-800/50 rounded-3xl p-4.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">AI Trend Insights</h3>
              <p className="text-xs text-indigo-200/70">
                Generate objective insights grounded in real calculations
              </p>
            </div>
          </div>
          <button
            onClick={handleExplainWithAi}
            disabled={isLoadingAi || stats.totalTransactions === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoadingAi ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Explaining...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiExplanation ? 'Refresh' : 'Explain'}</span>
              </>
            )}
          </button>
        </div>

        {/* AI Explanation Result Card */}
        {aiExplanation && (
          <div className="p-3.5 rounded-2xl bg-[#0B0F19]/80 border border-indigo-900/60 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-indigo-400 uppercase tracking-wider">
                Trend Analysis
              </span>
              <span className="bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                Verified Numbers
              </span>
            </div>

            <p className="text-slate-200 font-medium leading-relaxed">
              {aiExplanation.summary}
            </p>

            {aiExplanation.keyObservations.length > 0 && (
              <div className="space-y-1 pt-1">
                {aiExplanation.keyObservations.map((obs, idx) => (
                  <div key={idx} className="flex items-start space-x-2 text-slate-300">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span>{obs}</span>
                  </div>
                ))}
              </div>
            )}

            {aiExplanation.recommendation && (
              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-200 text-[11px]">
                <strong className="text-indigo-300">Tip: </strong>
                {aiExplanation.recommendation}
              </div>
            )}
          </div>
        )}

        {aiError && (
          <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/60">
            {aiError}
          </p>
        )}
      </div>

      {/* Section 1: Monthly Spending Chart & Remaining Money */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm sm:text-base">
              Monthly Spending & Remaining
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {stats.monthlyStats.length} {stats.monthlyStats.length === 1 ? 'month' : 'months'}
          </span>
        </div>

        {/* Clean visual bar chart */}
        <div className="space-y-3 pt-1">
          {stats.monthlyStats.map((item) => {
            const heightPercent = Math.min(100, Math.max(8, (item.totalSpent / maxMonthSpent) * 100));
            const isRemainingPositive = item.isBudgetSet && item.remainingMoney >= 0;
            const isRemainingNegative = item.isBudgetSet && item.remainingMoney < 0;

            return (
              <div key={item.monthKey} className="space-y-1.5 p-3 rounded-2xl bg-[#0B0F19] border border-slate-800/60">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-white">{item.monthDisplayName}</span>
                  </div>
                  <span className="font-extrabold text-sm text-white">
                    {formatCurrency(item.totalSpent, currencyCode)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${heightPercent}%` }}
                  />
                </div>

                {/* Sub details: Remaining & Largest Expense */}
                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                  <div>
                    {item.isBudgetSet ? (
                      <span
                        className={`font-semibold ${
                          isRemainingNegative ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isRemainingNegative ? 'Over by ' : 'Remaining: '}
                        {formatCurrency(Math.abs(item.remainingMoney), currencyCode)}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">No budget set</span>
                    )}
                  </div>

                  <div className="text-slate-400">
                    {item.transactionCount} {item.transactionCount === 1 ? 'txn' : 'txns'}
                    {item.largestExpense && (
                      <span className="ml-1 text-slate-300">
                        • Top: {formatCurrency(item.largestExpense.amount, currencyCode)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Category Percentage Distribution */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PieChart className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-sm sm:text-base">
              Category Distribution
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {stats.categoryPercentages.length} categories
          </span>
        </div>

        {stats.categoryPercentages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No expenses recorded for this period.</p>
        ) : (
          <div className="space-y-3.5">
            {/* Multi-segment horizontal bar */}
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
              {stats.categoryPercentages.map((item) => (
                <div
                  key={item.category}
                  style={{
                    width: `${Math.max(1.5, item.percentage)}%`,
                    backgroundColor: item.color,
                  }}
                  className="h-full transition-all duration-300"
                  title={`${item.category}: ${item.percentage.toFixed(1)}%`}
                />
              ))}
            </div>

            {/* Category percentage list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {stats.categoryPercentages.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#0B0F19] border border-slate-800/60"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-base shrink-0">{item.iconEmoji}</span>
                    <span className="text-xs font-semibold text-white truncate">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-white">
                      {formatCurrency(item.amount, currencyCode)}
                    </span>
                    <span
                      style={{ color: item.color }}
                      className="ml-1.5 text-[11px] font-bold"
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
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm sm:text-base">
              Category Trends Over Time
            </h3>
          </div>
          <span className="text-xs text-slate-500">Tap to expand months</span>
        </div>

        {stats.categoryTrends.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No category trends recorded.</p>
        ) : (
          <div className="space-y-2.5">
            {stats.categoryTrends.map((catTrend) => {
              const isExpanded = expandedCategory === catTrend.category;
              const hasUpTrend = catTrend.trendDirection === 'UP';
              const hasDownTrend = catTrend.trendDirection === 'DOWN';

              return (
                <div
                  key={catTrend.category}
                  className="rounded-2xl bg-[#0B0F19] border border-slate-800/60 overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : catTrend.category)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-xs sm:text-sm text-white">
                            {catTrend.category}
                          </h4>
                          {hasUpTrend && (
                            <span className="inline-flex items-center text-[10px] font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded-md">
                              <TrendingUp className="w-3 h-3 mr-0.5" />
                              +{Math.round(catTrend.trendPercent)}%
                            </span>
                          )}
                          {hasDownTrend && (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
                              <TrendingDown className="w-3 h-3 mr-0.5" />
                              {Math.round(catTrend.trendPercent)}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatCurrency(catTrend.totalSpent, currencyCode)} ({catTrend.percentageOfPeriod.toFixed(1)}% of period)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Monthly Breakdown for Category */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400 mb-1">
                        Monthly History:
                      </div>
                      {catTrend.monthlyData.map((m) => (
                        <div
                          key={m.monthKey}
                          className="flex items-center justify-between text-xs py-1 px-2.5 rounded-xl bg-slate-900/80"
                        >
                          <span className="text-slate-300 font-medium">{m.monthDisplayName}:</span>
                          <span className="font-bold text-white">
                            {formatCurrency(m.amount, currencyCode)}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({m.count} txns)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 4: Largest Expense by Month */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm sm:text-base">
              Largest Expense by Month
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          {stats.monthlyStats.map((m) => {
            const exp = m.largestExpense;
            return (
              <div
                key={m.monthKey}
                onClick={() => exp && onNavigateToExpense && onNavigateToExpense(exp)}
                className={`p-3 rounded-2xl bg-[#0B0F19] border border-slate-800/60 flex items-center justify-between ${
                  exp ? 'cursor-pointer hover:border-slate-700' : 'opacity-60'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold text-slate-400">{m.monthDisplayName}</div>
                  <div className="text-sm font-bold text-white truncate max-w-xs">
                    {exp ? exp.description : 'No expenses'}
                  </div>
                  {exp && (
                    <div className="text-[11px] text-slate-500 font-medium">
                      {exp.category}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-sm sm:text-base text-amber-400">
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
