package com.example.data.statistics

import com.example.data.model.Expense

enum class TimePeriod(val label: String, val monthCount: Int?) {
    CURRENT_MONTH("Current Month", 1),
    LAST_3_MONTHS("Last 3 Months", 3),
    LAST_6_MONTHS("Last 6 Months", 6),
    LAST_12_MONTHS("Last 12 Months", 12),
    ALL_TIME("All Time", null)
}

enum class TrendDirection {
    INCREASING,
    DECREASING,
    STABLE
}

data class MonthlyStatPoint(
    val monthKey: String,
    val monthName: String,
    val totalSpent: Double,
    val budgetStarting: Double?,
    val remaining: Double?,
    val transactionCount: Int,
    val largestExpense: Expense?
)

data class CategoryTrendPoint(
    val monthKey: String,
    val monthName: String,
    val amount: Double
)

data class CategoryTrendSeries(
    val categoryName: String,
    val totalAmount: Double,
    val percentageOfTotal: Double,
    val monthlyPoints: List<CategoryTrendPoint>,
    val trendDirection: TrendDirection
)

data class StatisticsSummary(
    val timePeriod: TimePeriod,
    val totalSpent: Double,
    val totalTransactions: Int,
    val averageTransaction: Double,
    val largestExpenseOverall: Expense?,
    val monthlyStats: List<MonthlyStatPoint>,
    val categoryBreakdowns: List<CategoryTrendSeries>,
    val averageMonthlySpent: Double,
    val averageMonthlyTransactions: Double
)
