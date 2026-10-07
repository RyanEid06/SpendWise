import {
  AiAnalysisResult,
  CategoryBaseline,
  Expense,
  HistoricalSpendingSummary,
  InsightCardItem,
  RecurringCandidate,
} from '../types';
import { MonthYear, getMonthKey, getMonthYearFromTimestamp, previousMonth } from './date';
import { formatCurrency } from './currency';
import { normalizeCategoryName } from './categories';
import { getLocalizedCategoryName } from './translations';

export class SpendingAnalyzer {
  computeHistoricalSummary(
    allExpenses: Expense[],
    targetMonth: MonthYear
  ): HistoricalSpendingSummary {
    allExpenses = allExpenses.map(expense => {
      const category = normalizeCategoryName(expense.category);
      return category === expense.category ? expense : { ...expense, category };
    });
    const currentMonthKey = getMonthKey(targetMonth);
    const prevMonthKey = getMonthKey(previousMonth(targetMonth));

    // Group all expenses by "YYYY-MM"
    const expensesByMonth: Record<string, Expense[]> = {};
    for (const exp of allExpenses) {
      const key = getMonthKey(getMonthYearFromTimestamp(exp.date));
      if (!expensesByMonth[key]) {
        expensesByMonth[key] = [];
      }
      expensesByMonth[key].push(exp);
    }

    const currentMonthExpenses = expensesByMonth[currentMonthKey] || [];
    const currentMonthTotal = currentMonthExpenses.reduce((acc, e) => acc + e.amount, 0);

    const previousMonthExpenses = expensesByMonth[prevMonthKey];
    const previousMonthTotal = previousMonthExpenses
      ? previousMonthExpenses.reduce((acc, e) => acc + e.amount, 0)
      : null;

    const distinctMonths = Object.keys(expensesByMonth).filter((k) => k <= currentMonthKey);
    const totalMonthsRecorded = distinctMonths.length;

    // Historical monthly average (excluding current month)
    const historicalMonthKeys = Object.keys(expensesByMonth).filter((k) => k < currentMonthKey);
    let historicalMonthlyAverage = currentMonthTotal;
    if (historicalMonthKeys.length > 0) {
      const sumHistory = historicalMonthKeys.reduce(
        (acc, k) => acc + expensesByMonth[k].reduce((s, e) => s + e.amount, 0),
        0
      );
      historicalMonthlyAverage = sumHistory / historicalMonthKeys.length;
    }

    // Category baselines
    const allCategories = Array.from(new Set(allExpenses.map((e) => e.category)));
    const baselines: CategoryBaseline[] = allCategories.map((category) => {
      const catAllExpenses = allExpenses.filter(
        (e) => e.category.toLowerCase() === category.toLowerCase()
      );
      const catHistoryExpenses = catAllExpenses.filter(
        (e) => getMonthKey(getMonthYearFromTimestamp(e.date)) < currentMonthKey
      );
      const catCurrentMonthExpenses = currentMonthExpenses.filter(
        (e) => e.category.toLowerCase() === category.toLowerCase()
      );
      const catPrevMonthExpenses = (previousMonthExpenses || []).filter(
        (e) => e.category.toLowerCase() === category.toLowerCase()
      );

      const amounts = (
        catHistoryExpenses.length > 0 ? catHistoryExpenses : catCurrentMonthExpenses
      )
        .map((e) => e.amount)
        .sort((a, b) => a - b);

      let median = 0;
      if (amounts.length > 0) {
        if (amounts.length % 2 === 1) {
          median = amounts[Math.floor(amounts.length / 2)];
        } else {
          const mid = amounts.length / 2;
          median = (amounts[mid - 1] + amounts[mid]) / 2;
        }
      }

      const mean =
        amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;

      const monthsWithCategory = Math.max(
        1,
        Object.values(expensesByMonth).filter((list) =>
          list.some((e) => e.category.toLowerCase() === category.toLowerCase())
        ).length
      );

      let historicalAvg = catCurrentMonthExpenses.reduce((s, e) => s + e.amount, 0);
      if (catHistoryExpenses.length > 0) {
        const histMonthsWithCat = Math.max(
          1,
          historicalMonthKeys.filter((k) =>
            expensesByMonth[k].some((e) => e.category.toLowerCase() === category.toLowerCase())
          ).length
        );
        historicalAvg =
          catHistoryExpenses.reduce((s, e) => s + e.amount, 0) / histMonthsWithCat;
      }

      const frequency = catAllExpenses.length / monthsWithCategory;

      return {
        category,
        historicalMonthlyAverage: historicalAvg,
        typicalTransactionMedian: median,
        typicalTransactionMean: mean,
        monthlyTransactionFrequency: frequency,
        currentMonthTotal: catCurrentMonthExpenses.reduce((s, e) => s + e.amount, 0),
        previousMonthTotal: catPrevMonthExpenses.reduce((s, e) => s + e.amount, 0),
        currentMonthCount: catCurrentMonthExpenses.length,
      };
    });

    // Identify recurring candidates in current month (2 or more transactions with same description)
    const descGroups: Record<string, Expense[]> = {};
    for (const exp of currentMonthExpenses) {
      const norm = exp.description.trim().toLowerCase();
      if (!descGroups[norm]) {
        descGroups[norm] = [];
      }
      descGroups[norm].push(exp);
    }

    const recurringCandidates: RecurringCandidate[] = Object.values(descGroups)
      .filter((group) => group.length >= 2)
      .map((group) => {
        const total = group.reduce((s, e) => s + e.amount, 0);
        return {
          descriptionGroup: group[0].description,
          category: group[0].category,
          countThisMonth: group.length,
          totalAmountThisMonth: total,
          averageAmount: total / group.length,
        };
      })
      .sort((a, b) => b.countThisMonth - a.countThisMonth);

    return {
      totalMonthsRecorded,
      historicalMonthlyAverage,
      currentMonthKey,
      currentMonthTotal,
      previousMonthKey: prevMonthKey,
      previousMonthTotal,
      categoryBaselines: baselines,
      currentMonthExpenses,
      recurringCandidates,
    };
  }

  generateStatisticalAnalysis(
    summary: HistoricalSpendingSummary,
    currencyCode: string
  ): AiAnalysisResult {
    const currentTotalFormatted = formatCurrency(summary.currentMonthTotal, currencyCode);

    const historyContext =
      summary.totalMonthsRecorded <= 1
        ? "You only have one month of spending history, so there isn't enough historical data to identify long-term patterns yet."
        : `Analysis calculated against ${summary.totalMonthsRecorded} recorded months of spending.`;

    let spendingOverview = '';
    if (summary.previousMonthTotal != null && summary.previousMonthTotal > 0) {
      const diff = summary.currentMonthTotal - summary.previousMonthTotal;
      const diffFormatted = formatCurrency(Math.abs(diff), currencyCode);
      if (diff >= 0) {
        spendingOverview = `You spent ${currentTotalFormatted} this month, which is ${diffFormatted} more than last month.`;
      } else {
        spendingOverview = `You spent ${currentTotalFormatted} this month, which is ${diffFormatted} less than last month.`;
      }
    } else {
      spendingOverview = `You spent ${currentTotalFormatted} across ${summary.currentMonthExpenses.length} transactions this month.`;
    }

    const biggestChanges: InsightCardItem[] = [];
    for (const baseline of summary.categoryBaselines) {
      if (baseline.previousMonthTotal > 0 && baseline.currentMonthTotal > 0) {
        const changePct =
          ((baseline.currentMonthTotal - baseline.previousMonthTotal) /
            baseline.previousMonthTotal) *
          100;
        if (changePct > 20) {
          biggestChanges.push({
            title: `${getLocalizedCategoryName(baseline.category, 'en')} Spending Increase`,
            explanation: `${getLocalizedCategoryName(baseline.category, 'en')} spending increased by ${Math.round(
              changePct
            )}% compared with your previous month.`,
            numbers: `${formatCurrency(baseline.currentMonthTotal, currencyCode)} vs ${formatCurrency(
              baseline.previousMonthTotal,
              currencyCode
            )}`,
            category: baseline.category,
            severity: 'NOTABLE',
          });
        } else if (changePct < -20) {
          biggestChanges.push({
            title: `${getLocalizedCategoryName(baseline.category, 'en')} Spending Decrease`,
            explanation: `${getLocalizedCategoryName(baseline.category, 'en')} spending decreased by ${Math.round(
              Math.abs(changePct)
            )}% compared with your previous month.`,
            numbers: `${formatCurrency(baseline.currentMonthTotal, currencyCode)} vs ${formatCurrency(
              baseline.previousMonthTotal,
              currencyCode
            )}`,
            category: baseline.category,
            severity: 'POSITIVE',
          });
        }
      }
    }

    const unusualExpenses: InsightCardItem[] = [];
    for (const exp of summary.currentMonthExpenses) {
      const baseline = summary.categoryBaselines.find(
        (b) => b.category.toLowerCase() === exp.category.toLowerCase()
      );
      const typical = baseline?.typicalTransactionMedian || 0;
      if (typical > 0 && exp.amount >= typical * 2.2) {
        unusualExpenses.push({
          title: `Higher Than Typical ${getLocalizedCategoryName(exp.category, 'en')} Purchase`,
          explanation: `Your ${formatCurrency(
            exp.amount,
            currencyCode
          )} purchase for "${exp.description}" is significantly higher than your typical ${formatCurrency(
            typical,
            currencyCode
          )} ${getLocalizedCategoryName(exp.category, 'en')} transaction.`,
          numbers: `${formatCurrency(exp.amount, currencyCode)} (typical: ${formatCurrency(
            typical,
            currencyCode
          )})`,
          category: exp.category,
          severity: 'NOTABLE',
        });
      }
    }

    const recurringSpending: InsightCardItem[] = summary.recurringCandidates.map((rec) => ({
      title: `Frequent Purchases: ${rec.descriptionGroup}`,
      explanation: `You spent money on "${rec.descriptionGroup}" ${rec.countThisMonth} times this month, totaling ${formatCurrency(
        rec.totalAmountThisMonth,
        currencyCode
      )}.`,
      numbers: `${rec.countThisMonth}x (${formatCurrency(
        rec.totalAmountThisMonth,
        currencyCode
      )})`,
      category: rec.category,
      severity: 'INFO',
    }));

    const areasToReview: InsightCardItem[] = [];
    if (summary.currentMonthTotal > 0) {
      for (const baseline of summary.categoryBaselines) {
        const proportion = (baseline.currentMonthTotal / summary.currentMonthTotal) * 100;
        if (proportion >= 25) {
          areasToReview.push({
            title: `High Share of Spending: ${getLocalizedCategoryName(baseline.category, 'en')}`,
            explanation: `${getLocalizedCategoryName(baseline.category, 'en')} represents ${Math.round(
              proportion
            )}% of your total spending this month.`,
            numbers: `${Math.round(proportion)}% (${formatCurrency(
              baseline.currentMonthTotal,
              currencyCode
            )})`,
            category: baseline.category,
            severity: 'REVIEW',
          });
        }
      }
    }

    return {
      timestamp: Date.now(),
      analyzedMonthKey: summary.currentMonthKey,
      isAiGenerated: false,
      spendingOverview,
      historyContext,
      biggestChanges: biggestChanges.slice(0, 4),
      unusualExpenses: unusualExpenses.slice(0, 4),
      recurringSpending: recurringSpending.slice(0, 4),
      areasToReview: areasToReview.slice(0, 4),
    };
  }

  buildGeminiPrompt(summary: HistoricalSpendingSummary, currencyCode: string): string {
    const parts: string[] = [];
    parts.push(
      "You are a thoughtful personal financial analysis assistant for a user's expense tracking app.\n"
    );
    parts.push("CRITICAL TONE REQUIREMENTS:\n");
    parts.push(
      "- Distinguish between 'unusual' and 'automatically bad'. Something being expensive or higher does not mean it was bad. A $500 laptop purchase or medical bill is reasonable even if unusual.\n"
    );
    parts.push(
      "- Use objective, non-judgmental language like 'Unusual spending', 'Potential area to review', 'Significant increase', 'Noticeable pattern' instead of 'Bad purchase' or lecturing.\n"
    );
    parts.push("- Explain WHY something was flagged clearly and concisely.\n\n");

    parts.push('DATA CONTEXT:\n');
    parts.push(`- Currency: ${currencyCode}\n`);
    parts.push(`- Total Recorded Historical Months: ${summary.totalMonthsRecorded}\n`);
    parts.push(`- Target Month: ${summary.currentMonthKey}\n`);
    parts.push(
      `- Current Month Total: ${formatCurrency(summary.currentMonthTotal, currencyCode)}\n`
    );
    if (summary.previousMonthTotal != null) {
      parts.push(
        `- Previous Month Total: ${formatCurrency(summary.previousMonthTotal, currencyCode)}\n`
      );
    }
    parts.push(
      `- Average Historical Monthly Spending: ${formatCurrency(
        summary.historicalMonthlyAverage,
        currencyCode
      )}\n\n`
    );

    parts.push('CATEGORY BASELINES (Personal Learning History):\n');
    for (const b of summary.categoryBaselines) {
      parts.push(
        `- ${b.category}: Current=${formatCurrency(
          b.currentMonthTotal,
          currencyCode
        )} (${b.currentMonthCount} txns), Previous=${formatCurrency(
          b.previousMonthTotal,
          currencyCode
        )}, Historical Monthly Avg=${formatCurrency(
          b.historicalMonthlyAverage,
          currencyCode
        )}, Typical Txn Median=${formatCurrency(b.typicalTransactionMedian, currencyCode)}\n`
      );
    }

    parts.push('\nFREQUENT/RECURRING PURCHASES THIS MONTH:\n');
    for (const r of summary.recurringCandidates) {
      parts.push(
        `- "${r.descriptionGroup}" in ${r.category}: ${r.countThisMonth} times, total ${formatCurrency(
          r.totalAmountThisMonth,
          currencyCode
        )}\n`
      );
    }

    parts.push('\nCURRENT MONTH TRANSACTIONS (Top 10 highest):\n');
    const top = [...summary.currentMonthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 10);
    for (const e of top) {
      parts.push(
        `- ${e.description} (${e.category}): ${formatCurrency(e.amount, currencyCode)}\n`
      );
    }

    parts.push('\nOUTPUT FORMAT:\n');
    parts.push('Respond with pure JSON matching this exact structure:\n');
    parts.push('{\n');
    parts.push(
      '  "spendingOverview": "1-2 sentence high-level summary comparing with previous month and historical baseline.",\n'
    );
    parts.push(
      '  "historyContext": "Sentence about whether there is enough historical data to identify long-term patterns.",\n'
    );
    parts.push(
      '  "biggestChanges": [{"title": "...", "explanation": "WHY it changed", "numbers": "e.g. +34% ($230 vs $171)", "category": "...", "severity": "NOTABLE"}],\n'
    );
    parts.push(
      '  "unusualExpenses": [{"title": "...", "explanation": "WHY unusual", "numbers": "...", "category": "...", "severity": "NOTABLE"}],\n'
    );
    parts.push(
      '  "recurringSpending": [{"title": "...", "explanation": "WHY notable", "numbers": "...", "category": "...", "severity": "INFO"}],\n'
    );
    parts.push(
      '  "areasToReview": [{"title": "...", "explanation": "WHY to review", "numbers": "...", "category": "...", "severity": "REVIEW"}]\n'
    );
    parts.push('}\n');

    return parts.join('');
  }
}
