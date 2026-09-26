package com.example.ai

import com.example.ai.model.AiAnalysisResult
import com.example.ai.model.CategoryBaseline
import com.example.ai.model.HistoricalSpendingSummary
import com.example.ai.model.InsightCardItem
import com.example.ai.model.InsightSeverity
import com.example.ai.model.RecurringCandidate
import com.example.data.model.Expense
import com.example.util.CurrencyConfig
import com.example.util.DateUtils
import java.util.Locale

/**
 * Handles statistical computation from local Room data for personal learning,
 * and provides offline baseline analysis as well as payload preparation for Gemini AI.
 */
class SpendingAnalyzer {

    fun computeHistoricalSummary(
        allExpenses: List<Expense>,
        targetMonth: DateUtils.MonthYear
    ): HistoricalSpendingSummary {
        val currentMonthKey = targetMonth.monthKey
        val previousMonthKey = targetMonth.previous().monthKey

        // Group all expenses by "yyyy-MM"
        val expensesByMonth = allExpenses.groupBy { expense ->
            DateUtils.getMonthYearFromTimestamp(expense.date).monthKey
        }

        val currentMonthExpenses = expensesByMonth[currentMonthKey] ?: emptyList()
        val currentMonthTotal = currentMonthExpenses.sumOf { it.amount }

        val previousMonthExpenses = expensesByMonth[previousMonthKey]
        val previousMonthTotal = previousMonthExpenses?.sumOf { it.amount }

        val distinctMonths = expensesByMonth.keys.filter { it <= currentMonthKey }
        val totalMonthsRecorded = distinctMonths.size

        // Calculate average monthly spending across historical months
        val historicalMonths = expensesByMonth.filterKeys { it < currentMonthKey }
        val historicalMonthlyAverage = if (historicalMonths.isNotEmpty()) {
            historicalMonths.values.map { list -> list.sumOf { it.amount } }.average()
        } else {
            currentMonthTotal
        }

        // Compute category baselines
        val allCategories = allExpenses.map { it.category }.distinct()
        val baselines = allCategories.map { category ->
            val catAllExpenses = allExpenses.filter { it.category.equals(category, ignoreCase = true) }
            val catHistoryExpenses = catAllExpenses.filter {
                DateUtils.getMonthYearFromTimestamp(it.date).monthKey < currentMonthKey
            }
            val catCurrentMonthExpenses = currentMonthExpenses.filter {
                it.category.equals(category, ignoreCase = true)
            }
            val catPrevMonthExpenses = previousMonthExpenses?.filter {
                it.category.equals(category, ignoreCase = true)
            } ?: emptyList()

            val amounts = (if (catHistoryExpenses.isNotEmpty()) catHistoryExpenses else catCurrentMonthExpenses).map { it.amount }.sorted()
            val median = if (amounts.isNotEmpty()) {
                if (amounts.size % 2 == 1) {
                    amounts[amounts.size / 2]
                } else {
                    (amounts[amounts.size / 2 - 1] + amounts[amounts.size / 2]) / 2.0
                }
            } else 0.0

            val mean = if (amounts.isNotEmpty()) amounts.average() else 0.0

            val monthsWithCategory = expensesByMonth.count { (_, list) ->
                list.any { it.category.equals(category, ignoreCase = true) }
            }.coerceAtLeast(1)

            val historicalAverage = if (catHistoryExpenses.isNotEmpty()) {
                val historicalMonthsWithCat = historicalMonths.count { (_, list) ->
                    list.any { it.category.equals(category, ignoreCase = true) }
                }.coerceAtLeast(1)
                catHistoryExpenses.sumOf { it.amount } / historicalMonthsWithCat
            } else {
                catCurrentMonthExpenses.sumOf { it.amount }
            }

            val frequency = catAllExpenses.size.toDouble() / monthsWithCategory.toDouble()

            CategoryBaseline(
                category = category,
                historicalMonthlyAverage = historicalAverage,
                typicalTransactionMedian = median,
                typicalTransactionMean = mean,
                monthlyTransactionFrequency = frequency,
                currentMonthTotal = catCurrentMonthExpenses.sumOf { it.amount },
                previousMonthTotal = catPrevMonthExpenses.sumOf { it.amount },
                currentMonthCount = catCurrentMonthExpenses.size
            )
        }

        // Identify recurring candidates in current month (similar descriptions or frequent purchases)
        val recurringCandidates = currentMonthExpenses
            .groupBy { it.description.trim().lowercase(Locale.getDefault()) }
            .filter { it.value.size >= 2 }
            .map { (desc, list) ->
                RecurringCandidate(
                    descriptionGroup = list.first().description,
                    category = list.first().category,
                    countThisMonth = list.size,
                    totalAmountThisMonth = list.sumOf { it.amount },
                    averageAmount = list.map { it.amount }.average()
                )
            }
            .sortedByDescending { it.countThisMonth }

        return HistoricalSpendingSummary(
            totalMonthsRecorded = totalMonthsRecorded,
            historicalMonthlyAverage = historicalMonthlyAverage,
            currentMonthKey = currentMonthKey,
            currentMonthTotal = currentMonthTotal,
            previousMonthKey = previousMonthKey,
            previousMonthTotal = previousMonthTotal,
            categoryBaselines = baselines,
            currentMonthExpenses = currentMonthExpenses,
            recurringCandidates = recurringCandidates
        )
    }

    /**
     * Builds a statistical fallback analysis when offline or if Gemini request fails.
     */
    fun generateStatisticalAnalysis(
        summary: HistoricalSpendingSummary,
        currencyCode: String
    ): AiAnalysisResult {
        val currentMonthName = summary.currentMonthKey
        val currentTotalFormatted = CurrencyConfig.format(summary.currentMonthTotal, currencyCode)

        val historyContext = if (summary.totalMonthsRecorded <= 1) {
            "You only have one month of spending history, so there isn't enough historical data to identify long-term patterns yet."
        } else {
            "Analysis calculated against ${summary.totalMonthsRecorded} recorded months of spending."
        }

        val spendingOverview = if (summary.previousMonthTotal != null && summary.previousMonthTotal > 0) {
            val diff = summary.currentMonthTotal - summary.previousMonthTotal
            val diffFormatted = CurrencyConfig.format(kotlin.math.abs(diff), currencyCode)
            if (diff >= 0) {
                "You spent $currentTotalFormatted this month, which is $diffFormatted more than last month."
            } else {
                "You spent $currentTotalFormatted this month, which is $diffFormatted less than last month."
            }
        } else {
            "You spent $currentTotalFormatted across ${summary.currentMonthExpenses.size} transactions this month."
        }

        val biggestChanges = mutableListOf<InsightCardItem>()
        summary.categoryBaselines.forEach { baseline ->
            if (baseline.previousMonthTotal > 0 && baseline.currentMonthTotal > 0) {
                val changePct = ((baseline.currentMonthTotal - baseline.previousMonthTotal) / baseline.previousMonthTotal) * 100.0
                if (changePct > 20.0 && baseline.currentMonthTotal > 30.0) {
                    biggestChanges.add(
                        InsightCardItem(
                            title = "${baseline.category} Spending Increase",
                            explanation = "${baseline.category} spending increased by ${String.format(Locale.US, "%.0f", changePct)}% compared with your previous month.",
                            numbers = "${CurrencyConfig.format(baseline.currentMonthTotal, currencyCode)} vs ${CurrencyConfig.format(baseline.previousMonthTotal, currencyCode)}",
                            category = baseline.category,
                            severity = InsightSeverity.NOTABLE
                        )
                    )
                } else if (changePct < -20.0 && baseline.previousMonthTotal > 30.0) {
                    biggestChanges.add(
                        InsightCardItem(
                            title = "${baseline.category} Spending Decrease",
                            explanation = "${baseline.category} spending decreased by ${String.format(Locale.US, "%.0f", kotlin.math.abs(changePct))}% compared with your previous month.",
                            numbers = "${CurrencyConfig.format(baseline.currentMonthTotal, currencyCode)} vs ${CurrencyConfig.format(baseline.previousMonthTotal, currencyCode)}",
                            category = baseline.category,
                            severity = InsightSeverity.POSITIVE
                        )
                    )
                }
            }
        }

        val unusualExpenses = mutableListOf<InsightCardItem>()
        summary.currentMonthExpenses.forEach { expense ->
            val baseline = summary.categoryBaselines.find { it.category.equals(expense.category, ignoreCase = true) }
            val typical = baseline?.typicalTransactionMedian ?: 0.0
            if (typical > 0 && expense.amount >= typical * 2.2 && expense.amount > 40.0) {
                unusualExpenses.add(
                    InsightCardItem(
                        title = "Higher Than Typical ${expense.category} Purchase",
                        explanation = "Your ${CurrencyConfig.format(expense.amount, currencyCode)} purchase for \"${expense.description}\" is significantly higher than your typical ${CurrencyConfig.format(typical, currencyCode)} ${expense.category} transaction.",
                        numbers = "${CurrencyConfig.format(expense.amount, currencyCode)} (typical: ${CurrencyConfig.format(typical, currencyCode)})",
                        category = expense.category,
                        severity = InsightSeverity.NOTABLE
                    )
                )
            }
        }

        val recurringSpending = mutableListOf<InsightCardItem>()
        summary.recurringCandidates.forEach { rec ->
            recurringSpending.add(
                InsightCardItem(
                    title = "Frequent Purchases: ${rec.descriptionGroup}",
                    explanation = "You spent money on \"${rec.descriptionGroup}\" ${rec.countThisMonth} times this month, totaling ${CurrencyConfig.format(rec.totalAmountThisMonth, currencyCode)}.",
                    numbers = "${rec.countThisMonth}x (${CurrencyConfig.format(rec.totalAmountThisMonth, currencyCode)})",
                    category = rec.category,
                    severity = InsightSeverity.INFO
                )
            )
        }

        val areasToReview = mutableListOf<InsightCardItem>()
        if (summary.currentMonthTotal > 0) {
            summary.categoryBaselines.forEach { baseline ->
                val proportion = (baseline.currentMonthTotal / summary.currentMonthTotal) * 100.0
                if (proportion >= 25.0) {
                    areasToReview.add(
                        InsightCardItem(
                            title = "High Share of Spending: ${baseline.category}",
                            explanation = "${baseline.category} represents ${String.format(Locale.US, "%.0f", proportion)}% of your total spending this month.",
                            numbers = "${String.format(Locale.US, "%.0f", proportion)}% (${CurrencyConfig.format(baseline.currentMonthTotal, currencyCode)})",
                            category = baseline.category,
                            severity = InsightSeverity.REVIEW
                        )
                    )
                }
            }
        }

        return AiAnalysisResult(
            timestamp = System.currentTimeMillis(),
            analyzedMonthKey = summary.currentMonthKey,
            isAiGenerated = false,
            spendingOverview = spendingOverview,
            historyContext = historyContext,
            biggestChanges = biggestChanges.take(4),
            unusualExpenses = unusualExpenses.take(4),
            recurringSpending = recurringSpending.take(4),
            areasToReview = areasToReview.take(4)
        )
    }

    /**
     * Builds a minimal, privacy-conscious prompt payload for Gemini.
     * Only aggregated numbers and anonymized purchase details are passed.
     */
    fun buildGeminiPrompt(
        summary: HistoricalSpendingSummary,
        currencyCode: String
    ): String {
        val sb = StringBuilder()
        sb.append("You are a thoughtful personal financial analysis assistant for a user's expense tracking app.\n")
        sb.append("CRITICAL TONE REQUIREMENTS:\n")
        sb.append("- Distinguish between 'unusual' and 'automatically bad'. Something being expensive or higher does not mean it was bad. A \$500 laptop purchase or medical bill is reasonable even if unusual.\n")
        sb.append("- Use objective, non-judgmental language like 'Unusual spending', 'Potential area to review', 'Significant increase', 'Noticeable pattern' instead of 'Bad purchase' or lecturing.\n")
        sb.append("- Explain WHY something was flagged clearly and concisely.\n\n")

        sb.append("DATA CONTEXT:\n")
        sb.append("- Currency: ").append(currencyCode).append("\n")
        sb.append("- Total Recorded Historical Months: ").append(summary.totalMonthsRecorded).append("\n")
        sb.append("- Target Month: ").append(summary.currentMonthKey).append("\n")
        sb.append("- Current Month Total: ").append(CurrencyConfig.format(summary.currentMonthTotal, currencyCode)).append("\n")
        if (summary.previousMonthTotal != null) {
            sb.append("- Previous Month Total: ").append(CurrencyConfig.format(summary.previousMonthTotal, currencyCode)).append("\n")
        }
        sb.append("- Average Historical Monthly Spending: ").append(CurrencyConfig.format(summary.historicalMonthlyAverage, currencyCode)).append("\n\n")

        sb.append("CATEGORY BASELINES (Personal Learning History):\n")
        summary.categoryBaselines.forEach { b ->
            sb.append("- ").append(b.category).append(": Current=")
                .append(CurrencyConfig.format(b.currentMonthTotal, currencyCode))
                .append(" (").append(b.currentMonthCount).append(" txns), Previous=")
                .append(CurrencyConfig.format(b.previousMonthTotal, currencyCode))
                .append(", Historical Monthly Avg=").append(CurrencyConfig.format(b.historicalMonthlyAverage, currencyCode))
                .append(", Typical Txn Median=").append(CurrencyConfig.format(b.typicalTransactionMedian, currencyCode))
                .append("\n")
        }

        sb.append("\nFREQUENT/RECURRING PURCHASES THIS MONTH:\n")
        summary.recurringCandidates.forEach { r ->
            sb.append("- \"").append(r.descriptionGroup).append("\" in ").append(r.category)
                .append(": ").append(r.countThisMonth).append(" times, total ")
                .append(CurrencyConfig.format(r.totalAmountThisMonth, currencyCode)).append("\n")
        }

        sb.append("\nCURRENT MONTH TRANSACTIONS (Top 10 highest):\n")
        summary.currentMonthExpenses.sortedByDescending { it.amount }.take(10).forEach { e ->
            sb.append("- ").append(e.description).append(" (").append(e.category).append("): ")
                .append(CurrencyConfig.format(e.amount, currencyCode)).append("\n")
        }

        sb.append("\nOUTPUT FORMAT:\n")
        sb.append("Respond with pure JSON matching this exact structure:\n")
        sb.append("{\n")
        sb.append("  \"spendingOverview\": \"1-2 sentence high-level summary comparing with previous month and historical baseline.\",\n")
        sb.append("  \"historyContext\": \"Sentence about whether there is enough historical data to identify long-term patterns.\",\n")
        sb.append("  \"biggestChanges\": [{\"title\": \"...\", \"explanation\": \"WHY it changed\", \"numbers\": \"e.g. +34% (\$230 vs \$171)\", \"category\": \"...\", \"severity\": \"NOTABLE\"}],\n")
        sb.append("  \"unusualExpenses\": [{\"title\": \"...\", \"explanation\": \"WHY unusual\", \"numbers\": \"...\", \"category\": \"...\", \"severity\": \"NOTABLE\"}],\n")
        sb.append("  \"recurringSpending\": [{\"title\": \"...\", \"explanation\": \"WHY notable\", \"numbers\": \"...\", \"category\": \"...\", \"severity\": \"INFO\"}],\n")
        sb.append("  \"areasToReview\": [{\"title\": \"...\", \"explanation\": \"WHY to review\", \"numbers\": \"...\", \"category\": \"...\", \"severity\": \"REVIEW\"}]\n")
        sb.append("}\n")

        return sb.toString()
    }
}
