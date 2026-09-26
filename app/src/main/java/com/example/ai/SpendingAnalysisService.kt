package com.example.ai

import com.example.data.model.Expense

enum class InsightType {
    INFO,
    WARNING,
    TIP,
    SUCCESS
}

data class SpendingInsight(
    val title: String,
    val message: String,
    val type: InsightType
)

/**
 * Service interface for spending analysis and financial insights.
 * Designed to be modular so that server-side or on-device Gemini AI analysis
 * can be plugged in without requiring database or UI restructuring.
 */
interface SpendingAnalysisService {
    suspend fun analyzeSpending(
        expenses: List<Expense>,
        startingBudget: Double,
        currencyCode: String
    ): List<SpendingInsight>
}

/**
 * Default local rule-based implementation of spending analysis.
 * Serves as the reliable offline base that can be substituted or augmented with AI.
 */
class DefaultSpendingAnalysisService : SpendingAnalysisService {
    override suspend fun analyzeSpending(
        expenses: List<Expense>,
        startingBudget: Double,
        currencyCode: String
    ): List<SpendingInsight> {
        val insights = mutableListOf<SpendingInsight>()
        val totalSpent = expenses.sumOf { it.amount }

        if (startingBudget > 0) {
            val percentageUsed = (totalSpent / startingBudget) * 100
            when {
                percentageUsed >= 100 -> {
                    insights.add(
                        SpendingInsight(
                            title = "Budget Exceeded",
                            message = "You have spent 100% or more of your starting budget for this month.",
                            type = InsightType.WARNING
                        )
                    )
                }
                percentageUsed >= 80 -> {
                    insights.add(
                        SpendingInsight(
                            title = "Approaching Limit",
                            message = "You have used ${String.format("%.0f", percentageUsed)}% of your monthly budget.",
                            type = InsightType.WARNING
                        )
                    )
                }
                percentageUsed < 50 && expenses.isNotEmpty() -> {
                    insights.add(
                        SpendingInsight(
                            title = "Healthy Spending Pace",
                            message = "Your spending is well within your monthly allocation.",
                            type = InsightType.SUCCESS
                        )
                    )
                }
            }
        }

        // Top category analysis
        val topCategory = expenses.groupBy { it.category }
            .mapValues { entry -> entry.value.sumOf { it.amount } }
            .maxByOrNull { it.value }

        if (topCategory != null && totalSpent > 0) {
            val catPercentage = (topCategory.value / totalSpent) * 100
            if (catPercentage > 40) {
                insights.add(
                    SpendingInsight(
                        title = "Dominant Category",
                        message = "${topCategory.key} accounts for ${String.format("%.0f", catPercentage)}% of your total spending.",
                        type = InsightType.TIP
                    )
                )
            }
        }

        return insights
    }
}
