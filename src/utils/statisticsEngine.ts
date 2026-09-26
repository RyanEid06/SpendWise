import {
  CategoryTrend,
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
} from './date';
import { getCategoryInfo } from './categories';
import { formatCurrency } from './currency';

export class StatisticsEngine {
  // Simple in-memory cache to avoid recomputing on repeated tab switches
  private static cache = new Map<string, StatisticsOverview>();

  private static getCacheKey(
    expenses: Expense[],
    budgets: MonthlyBudget[],
    period: TimePeriod,
    anchorMonth: MonthYear
  ): string {
    return `${period}_${expenses.length}_${budgets.length}_${getMonthKey(anchorMonth)}`;
  }

  /**
   * Determine the list of target month keys based on selected period
   */
  static getMonthKeysForPeriod(period: TimePeriod, anchorMonth: MonthYear, allExpenses: Expense[]): string[] {
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
    const cacheKey = this.getCacheKey(allExpenses, budgets, period, anchorMonth);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const monthKeys = this.getMonthKeysForPeriod(period, anchorMonth, allExpenses);
    const monthKeySet = new Set(monthKeys);

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
      const cat = exp.category;
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

        // Determine trend direction
        let trendDirection: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
        let trendPercent = 0;
        if (monthlyData.length >= 2) {
          const firstNonZero = monthlyData.find((m) => m.amount > 0)?.amount || 0;
          const last = monthlyData[monthlyData.length - 1].amount;
          if (firstNonZero > 0) {
            trendPercent = ((last - firstNonZero) / firstNonZero) * 100;
            if (trendPercent > 10) trendDirection = 'UP';
            else if (trendPercent < -10) trendDirection = 'DOWN';
          } else if (last > 0) {
            trendDirection = 'UP';
            trendPercent = 100;
          }
        }

        return {
          category: cat,
          totalSpent: totalCat,
          percentageOfPeriod: totalSpent > 0 ? (totalCat / totalSpent) * 100 : 0,
          monthlyData,
          trendDirection,
          trendPercent,
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

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Build clean prompt for Gemini to explain historical trends with verified numbers
   */
  static buildTrendExplanationPrompt(stats: StatisticsOverview, currencyCode: string): string {
    const parts: string[] = [];
    parts.push(
      "You are a helpful personal finance advisor explaining verified spending statistics and trends to a user.\n"
    );
    parts.push("CRITICAL INTEGRITY RULES:\n");
    parts.push(
      "- All numbers you cite MUST be identical to the exact calculated statistics provided below. NEVER invent or hallucinate amounts, percentages, or transaction counts.\n"
    );
    parts.push(
      "- Clearly distinguish positive habits, neutral baseline shifts, and notable spending increases.\n"
    );
    parts.push("- Be objective, concise, and actionable without being preachy.\n\n");

    parts.push(`ANALYSIS SCOPE: ${stats.periodLabel} (${stats.monthlyStats.length} months)\n`);
    parts.push(`- Total Spent: ${formatCurrency(stats.totalSpent, currencyCode)}\n`);
    parts.push(`- Total Transactions: ${stats.totalTransactions}\n`);
    parts.push(
      `- Average Transaction: ${formatCurrency(stats.averageTransactionAmount, currencyCode)}\n`
    );
    if (stats.overallLargestExpense) {
      parts.push(
        `- Largest Overall Expense: "${stats.overallLargestExpense.description}" (${formatCurrency(
          stats.overallLargestExpense.amount,
          currencyCode
        )} in ${stats.overallLargestExpense.category})\n`
      );
    }

    parts.push('\nMONTHLY SPENDING BREAKDOWN:\n');
    for (const m of stats.monthlyStats) {
      parts.push(
        `- ${m.monthDisplayName}: Spent ${formatCurrency(m.totalSpent, currencyCode)} (${
          m.transactionCount
        } txns)${m.isBudgetSet ? `, Remaining: ${formatCurrency(m.remainingMoney, currencyCode)}` : ''}\n`
      );
    }

    parts.push('\nTOP CATEGORY TRENDS:\n');
    for (const c of stats.categoryTrends.slice(0, 5)) {
      parts.push(
        `- ${c.category}: Total ${formatCurrency(c.totalSpent, currencyCode)} (${c.percentageOfPeriod.toFixed(
          1
        )}% of period), Trend: ${c.trendDirection} (${Math.round(c.trendPercent)}%)\n`
      );
      const monthlySequence = c.monthlyData.map(
        (m) => `${m.monthDisplayName.split(' ')[0]}: ${formatCurrency(m.amount, currencyCode)}`
      );
      parts.push(`  Monthly: ${monthlySequence.join(' -> ')}\n`);
    }

    parts.push('\nOUTPUT FORMAT:\n');
    parts.push('Respond with pure JSON conforming to this schema:\n');
    parts.push('{\n');
    parts.push('  "summary": "1-2 sentence overall summary of how spending developed across this period.",\n');
    parts.push('  "keyObservations": ["Observation 1 highlighting monthly or category trajectory", "Observation 2"],\n');
    parts.push('  "categoryHighlights": ["Notable shift in category A", "Notable shift in category B"],\n');
    parts.push('  "recommendation": "1 actionable financial tip based on these exact numbers."\n');
    parts.push('}\n');

    return parts.join('');
  }

  /**
   * Deterministic local fallback generator for trend explanations
   */
  static generateLocalTrendExplanation(stats: StatisticsOverview, currencyCode: string) {
    const topCategory = stats.categoryPercentages[0];
    const summary = `Over the ${stats.periodLabel.toLowerCase()}, you spent ${formatCurrency(
      stats.totalSpent,
      currencyCode
    )} across ${stats.totalTransactions} transactions with an average of ${formatCurrency(
      stats.averageTransactionAmount,
      currencyCode
    )} per expense.`;

    const keyObservations: string[] = [];
    if (stats.monthlyStats.length >= 2) {
      const firstMonth = stats.monthlyStats[0];
      const lastMonth = stats.monthlyStats[stats.monthlyStats.length - 1];
      const diff = lastMonth.totalSpent - firstMonth.totalSpent;
      if (Math.abs(diff) > 20) {
        keyObservations.push(
          `Monthly spending shifted from ${formatCurrency(firstMonth.totalSpent, currencyCode)} in ${
            firstMonth.monthDisplayName
          } to ${formatCurrency(lastMonth.totalSpent, currencyCode)} in ${lastMonth.monthDisplayName}.`
        );
      }
    }

    if (stats.overallLargestExpense) {
      keyObservations.push(
        `Your largest single expense was "${stats.overallLargestExpense.description}" for ${formatCurrency(
          stats.overallLargestExpense.amount,
          currencyCode
        )} in ${stats.overallLargestExpense.category}.`
      );
    }

    const categoryHighlights: string[] = [];
    if (topCategory) {
      categoryHighlights.push(
        `${topCategory.category} represents the largest share of spending at ${topCategory.percentage.toFixed(
          1
        )}% (${formatCurrency(topCategory.amount, currencyCode)}).`
      );
    }

    const increasingCat = stats.categoryTrends.find((c) => c.trendDirection === 'UP' && c.trendPercent > 15);
    if (increasingCat) {
      categoryHighlights.push(
        `${increasingCat.category} spending increased by ${Math.round(
          increasingCat.trendPercent
        )}% across this period.`
      );
    }

    const recommendation = topCategory
      ? `Reviewing your ${topCategory.category} expenses could offer the highest potential impact since it accounts for over ${Math.round(
          topCategory.percentage
        )}% of your overall outflow.`
      : 'Maintain consistent monthly budget tracking to keep your financial goals aligned.';

    return {
      timestamp: Date.now(),
      periodLabel: stats.periodLabel,
      summary,
      keyObservations: keyObservations.length > 0 ? keyObservations : ['Spending remained relatively stable.'],
      categoryHighlights: categoryHighlights.length > 0 ? categoryHighlights : ['Categories reflect typical distributions.'],
      recommendation,
    };
  }
}
