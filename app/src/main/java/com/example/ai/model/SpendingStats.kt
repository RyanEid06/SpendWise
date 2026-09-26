package com.example.ai.model

import com.example.data.model.Expense

/**
 * Local statistical learning data derived from historical expenses.
 * Provides rich historical context to the AI model so it understands
 * what is normal vs. unusual for this specific user.
 */
data class CategoryBaseline(
    val category: String,
    val historicalMonthlyAverage: Double,
    val typicalTransactionMedian: Double,
    val typicalTransactionMean: Double,
    val monthlyTransactionFrequency: Double,
    val currentMonthTotal: Double,
    val previousMonthTotal: Double,
    val currentMonthCount: Int
)

data class HistoricalSpendingSummary(
    val totalMonthsRecorded: Int,
    val historicalMonthlyAverage: Double,
    val currentMonthKey: String,
    val currentMonthTotal: Double,
    val previousMonthKey: String?,
    val previousMonthTotal: Double?,
    val categoryBaselines: List<CategoryBaseline>,
    val currentMonthExpenses: List<Expense>,
    val recurringCandidates: List<RecurringCandidate>
)

data class RecurringCandidate(
    val descriptionGroup: String,
    val category: String,
    val countThisMonth: Int,
    val totalAmountThisMonth: Double,
    val averageAmount: Double
)
