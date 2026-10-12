import {
  CategoryTrend,
  Language,
  Expense,
  MonthlyBudget,
  MonthlySpendingStat,
  StatisticsOverview,
  TimePeriod,
} from '../types';
import {
  MonthYear,
  getDisplayName,
  getMonthKey,
  getMonthYearFromTimestamp,
  parseMonthKey,
  previousMonth,
  currentMonthYear,
} from './date';
import { getCategoryInfo, normalizeCategoryName } from './categories';
import { buildVerifiedTrendFacts } from '../features/statistics/verifiedFacts';

export class StatisticsEngine {
  /**
   * Determine the list of target month keys based on selected period
   */
  static getMonthKeysForPeriod(period: TimePeriod, anchorMonth: MonthYear, allExpenses: Expense[], budgets: MonthlyBudget[]): string[] {
    const anchorKey = getMonthKey(anchorMonth);

    if (period === 'CURRENT_MONTH') {
      return [anchorKey];
    }

    let count = 3;
    if (period === 'LAST_3_MONTHS') count = 3;
    if (period === 'LAST_6_MONTHS') count = 6;
    if (period === 'LAST_12_MONTHS') count = 12;

    if (period === 'ALL_TIME') {
      // Find all distinct months in expenses and budgets
      const allKeys = new Set<string>();
      allKeys.add(anchorKey);
      for (const e of allExpenses) {
        allKeys.add(getMonthKey(getMonthYearFromTimestamp(e.date)));
      }
      for (const b of budgets) {
        allKeys.add(b.monthKey);
      }
      return Array.from(allKeys).sort();
    }

    // Generate chronological list up to anchorMonth
    const keys: string[] = [];
    let cur = anchorMonth;
    for (let i = 0; i < count; i++) {
      keys.unshift(getMonthKey(cur));
      cur = previousMonth(cur);
    }
    return keys;
  }

  /**
   * Calculate complete statistics overview with zero-lag performance
   */
  static calculateStatistics(
    allExpenses: Expense[],
    budgets: MonthlyBudget[],
    period: TimePeriod,
    anchorMonth: MonthYear
  ): StatisticsOverview {
    const monthKeys = this.getMonthKeysForPeriod(period, anchorMonth, allExpenses, budgets);
    const monthKeySet = new Set(monthKeys);
    const currentCalendarKey = getMonthKey(currentMonthYear());

    // Filter expenses within selected period
    const filteredExpenses = allExpenses.filter((e) => {
      const k = getMonthKey(getMonthYearFromTimestamp(e.date));
      return monthKeySet.has(k);
    });

    // Monthly breakdown map
    const expensesByMonth: Record<string, Expense[]> = {};
    for (const k of monthKeys) {
      expensesByMonth[k] = [];
    }
    for (const exp of filteredExpenses) {
      const k = getMonthKey(getMonthYearFromTimestamp(exp.date));
      if (expensesByMonth[k]) {
        expensesByMonth[k].push(exp);
      }
    }

    // Budget lookup map
    const budgetMap = new Map<string, MonthlyBudget>();
    for (const b of budgets) {
      budgetMap.set(b.monthKey, b);
    }

    // 1. Build MonthlySpendingStats
    const monthlyStats: MonthlySpendingStat[] = monthKeys.map((k) => {
      const monthExpenses = expensesByMonth[k] || [];
      const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      const budgetObj = budgetMap.get(k);
      const isBudgetSet = !!budgetObj;
      const startingBudget = budgetObj ? budgetObj.startingAmount : 0;
      const remainingMoney = isBudgetSet ? startingBudget - totalSpent : 0;

      let largestExpense: Expense | null = null;
      if (monthExpenses.length > 0) {
        largestExpense = monthExpenses.reduce((max, cur) => (cur.amount > max.amount ? cur : max), monthExpenses[0]);
      }

      return {
        monthKey: k,
        monthDisplayName: getDisplayName(parseMonthKey(k)),
        totalSpent,
        startingBudget,
        isBudgetSet,
        remainingMoney,
        transactionCount: monthExpenses.length,
        isPartialMonth: k >= currentCalendarKey,
        dataAvailability: monthExpenses.length > 0 || isBudgetSet ? 'recorded' : 'missing',
        largestExpense,
      };
    });

    const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalTransactions = filteredExpenses.length;
    const averageTransactionAmount = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

    let overallLargestExpense: Expense | null = null;
    if (filteredExpenses.length > 0) {
      overallLargestExpense = filteredExpenses.reduce(
        (max, cur) => (cur.amount > max.amount ? cur : max),
        filteredExpenses[0]
      );
    }

    // 2. Category percentages & trends
    const categoryTotals: Record<string, number> = {};
    const categoryMonthlyTotals: Record<string, Record<string, { amount: number; count: number }>> = {};

    for (const exp of filteredExpenses) {
      const cat = normalizeCategoryName(exp.category);
      const k = getMonthKey(getMonthYearFromTimestamp(exp.date));

      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;

      if (!categoryMonthlyTotals[cat]) {
        categoryMonthlyTotals[cat] = {};
      }
      if (!categoryMonthlyTotals[cat][k]) {
        categoryMonthlyTotals[cat][k] = { amount: 0, count: 0 };
      }
      categoryMonthlyTotals[cat][k].amount += exp.amount;
      categoryMonthlyTotals[cat][k].count += 1;
    }

    const categoryPercentages = Object.entries(categoryTotals)
      .map(([cat, amt]) => {
        const info = getCategoryInfo(cat);
        return {
          category: cat,
          amount: amt,
          percentage: totalSpent > 0 ? (amt / totalSpent) * 100 : 0,
          color: info.color,
          iconEmoji: info.iconEmoji,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // Build category trends across time
    const categoryTrends: CategoryTrend[] = Object.keys(categoryTotals)
      .map((cat) => {
        const totalCat = categoryTotals[cat];
        const monthlyData = monthKeys.map((mk) => {
          const entry = categoryMonthlyTotals[cat]?.[mk] || { amount: 0, count: 0 };
          const monthTotal = monthlyStats.find((s) => s.monthKey === mk)?.totalSpent || 0;
          return {
            monthKey: mk,
            monthDisplayName: getDisplayName(parseMonthKey(mk)),
            amount: entry.amount,
            percentage: monthTotal > 0 ? (entry.amount / monthTotal) * 100 : 0,
            count: entry.count,
          };
        });

        // Compare the two most recent complete months. The live current month is
        // intentionally excluded so an incomplete month is not labeled as a drop.
        let trendDirection: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
        let trendPercent = 0;
        let hasComparableHistory = false;
        const completeMonths = monthlyData.filter((m) => {
          const record = monthlyStats.find(month => month.monthKey === m.monthKey);
          return record && !record.isPartialMonth && record.dataAvailability === 'recorded';
        });
        if (completeMonths.length >= 2) {
          const previousMonthRecord = completeMonths[completeMonths.length - 2];
          const latestMonthRecord = completeMonths[completeMonths.length - 1];
          const ordinal = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));
          const adjacent = ordinal(latestMonthRecord.monthKey) - ordinal(previousMonthRecord.monthKey) === 1;
          const previous = previousMonthRecord.amount;
          const latest = latestMonthRecord.amount;

          if (adjacent && previous > 0) {
            hasComparableHistory = true;
            trendPercent = ((latest - previous) / previous) * 100;
            if (trendPercent > 10) trendDirection = 'UP';
            else if (trendPercent < -10) trendDirection = 'DOWN';
          }
        }

        return {
          category: cat,
          totalSpent: totalCat,
          percentageOfPeriod: totalSpent > 0 ? (totalCat / totalSpent) * 100 : 0,
          monthlyData,
          trendDirection,
          trendPercent,
          hasComparableHistory,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const activeMonthsCount = Math.max(1, monthKeys.length);
    const averageTransactionsPerMonth = totalTransactions / activeMonthsCount;

    let periodLabel = 'Current Month';
    if (period === 'LAST_3_MONTHS') periodLabel = 'Last 3 Months';
    if (period === 'LAST_6_MONTHS') periodLabel = 'Last 6 Months';
    if (period === 'LAST_12_MONTHS') periodLabel = 'Last 12 Months';
    if (period === 'ALL_TIME') periodLabel = 'All Available History';

    const totalBudget = monthlyStats.reduce((sum, m) => sum + m.startingBudget, 0);
    const totalRemaining = monthlyStats.reduce((sum, m) => sum + (m.isBudgetSet ? m.remainingMoney : 0), 0);

    const result: StatisticsOverview = {
      period,
      periodLabel,
      totalSpent,
      totalBudget,
      totalRemaining,
      totalTransactions,
      averageTransactionAmount,
      overallLargestExpense,
      monthlyStats,
      categoryTrends,
      categoryPercentages,
      averageTransactionsPerMonth,
    };

    return result;
  }

  /** Legacy caller helper: only verified IDs are eligible for selection. */
  static buildTrendExplanationPrompt(stats: StatisticsOverview, currencyCode: string): string {
    const facts = buildVerifiedTrendFacts(stats, currencyCode, 'en');
    return 'Select at most 3 IDs total; return only observationIds and categoryIds. Never author prose.\n' +
      JSON.stringify({ observations: facts.observations, categories: facts.categories });
  }

  /** Local fallback uses the same deterministic, localized complete-month catalog as the server. */
  static generateLocalTrendExplanation(stats: StatisticsOverview, currencyCode: string, language: Language = 'en') {
    const facts = buildVerifiedTrendFacts(stats, currencyCode, language);
    const selectedCategories = facts.categories.filter(f => f.id.startsWith('driver-')).slice(0, 2);
    if (!selectedCategories.length && facts.categories.length) selectedCategories.push(facts.categories[0]);
    const keyObservations = facts.observations.slice(0, 3 - selectedCategories.length).map(f => f.text);
    return {
      timestamp: Date.now(), periodLabel: stats.periodLabel, summary: facts.summary, keyObservations,
      categoryHighlights: selectedCategories.map(f => f.text),
      recommendation: selectedCategories.some(f => f.id === 'driver-increase') ? facts.recommendation : '',
    };
  }
}
