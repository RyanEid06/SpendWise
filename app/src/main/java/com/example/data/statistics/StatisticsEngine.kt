package com.example.data.statistics

import com.example.data.model.Expense
import com.example.data.model.MonthlyBudget
import com.example.util.DateUtils
import java.util.Calendar

object StatisticsEngine {

    fun computeStatistics(
        allExpenses: List<Expense>,
        allBudgets: List<MonthlyBudget>,
        timePeriod: TimePeriod,
        referenceMonth: DateUtils.MonthYear = DateUtils.currentMonthYear()
    ): StatisticsSummary {
        val targetMonths = getTargetMonths(timePeriod, referenceMonth, allExpenses)

        val startTimestamp = targetMonths.firstOrNull()?.getStartOfMonthTimestamp() ?: 0L
        val endTimestamp = targetMonths.lastOrNull()?.getEndOfMonthTimestamp() ?: Long.MAX_VALUE

        val filteredExpenses = allExpenses.filter { it.date in startTimestamp..endTimestamp }

        val totalSpent = filteredExpenses.sumOf { it.amount }
        val totalTransactions = filteredExpenses.size
        val averageTransaction = if (totalTransactions > 0) totalSpent / totalTransactions else 0.0
        val largestExpenseOverall = filteredExpenses.maxByOrNull { it.amount }

        val budgetMap = allBudgets.associateBy { it.monthKey }

        // Monthly stats points (chronological order)
        val monthlyStats = targetMonths.map { month ->
            val monthStart = month.getStartOfMonthTimestamp()
            val monthEnd = month.getEndOfMonthTimestamp()
            val monthExpenses = filteredExpenses.filter { it.date in monthStart..monthEnd }

            val monthSpent = monthExpenses.sumOf { it.amount }
            val budget = budgetMap[month.monthKey]
            val starting = budget?.startingAmount
            val remaining = starting?.let { it - monthSpent }
            val largest = monthExpenses.maxByOrNull { it.amount }

            MonthlyStatPoint(
                monthKey = month.monthKey,
                monthName = month.getDisplayName(),
                totalSpent = monthSpent,
                budgetStarting = starting,
                remaining = remaining,
                transactionCount = monthExpenses.size,
                largestExpense = largest
            )
        }

        // Category trends
        val categories = filteredExpenses.map { it.category }.distinct()
        val categoryBreakdowns = categories.map { catName ->
            val catExpenses = filteredExpenses.filter { it.category.equals(catName, ignoreCase = true) }
            val catTotal = catExpenses.sumOf { it.amount }
            val percentage = if (totalSpent > 0) (catTotal / totalSpent) * 100.0 else 0.0

            val trendPoints = targetMonths.map { month ->
                val monthStart = month.getStartOfMonthTimestamp()
                val monthEnd = month.getEndOfMonthTimestamp()
                val spentInMonth = catExpenses
                    .filter { it.date in monthStart..monthEnd }
                    .sumOf { it.amount }

                CategoryTrendPoint(
                    monthKey = month.monthKey,
                    monthName = month.getDisplayName(),
                    amount = spentInMonth
                )
            }

            val trendDirection = determineTrend(trendPoints.map { it.amount })

            CategoryTrendSeries(
                categoryName = catName,
                totalAmount = catTotal,
                percentageOfTotal = percentage,
                monthlyPoints = trendPoints,
                trendDirection = trendDirection
            )
        }.sortedByDescending { it.totalAmount }

        val activeMonthsCount = targetMonths.size.coerceAtLeast(1)
        val averageMonthlySpent = totalSpent / activeMonthsCount
        val averageMonthlyTransactions = totalTransactions.toDouble() / activeMonthsCount

        return StatisticsSummary(
            timePeriod = timePeriod,
            totalSpent = totalSpent,
            totalTransactions = totalTransactions,
            averageTransaction = averageTransaction,
            largestExpenseOverall = largestExpenseOverall,
            monthlyStats = monthlyStats,
            categoryBreakdowns = categoryBreakdowns,
            averageMonthlySpent = averageMonthlySpent,
            averageMonthlyTransactions = averageMonthlyTransactions
        )
    }

    private fun getTargetMonths(
        period: TimePeriod,
        ref: DateUtils.MonthYear,
        allExpenses: List<Expense>
    ): List<DateUtils.MonthYear> {
        val count = period.monthCount
        return if (count != null) {
            val list = mutableListOf<DateUtils.MonthYear>()
            var current = ref
            for (i in 0 until count) {
                list.add(0, current)
                current = current.previous()
            }
            list
        } else {
            // ALL_TIME
            if (allExpenses.isEmpty()) {
                listOf(ref)
            } else {
                val minDate = allExpenses.minOf { it.date }
                val cal = Calendar.getInstance().apply { timeInMillis = minDate }
                var oldest = DateUtils.MonthYear(
                    year = cal.get(Calendar.YEAR),
                    month = cal.get(Calendar.MONTH) + 1
                )

                val list = mutableListOf<DateUtils.MonthYear>()
                var cursor = oldest
                while (cursor <= ref && list.size < 60) { // Limit to 5 years max for sanity
                    list.add(cursor)
                    cursor = cursor.next()
                }
                if (list.isEmpty()) listOf(ref) else list
            }
        }
    }

    private fun determineTrend(amounts: List<Double>): TrendDirection {
        if (amounts.size < 2) return TrendDirection.STABLE

        val mid = amounts.size / 2
        val firstHalf = amounts.take(mid)
        val secondHalf = amounts.drop(mid)

        val avgFirst = if (firstHalf.isNotEmpty()) firstHalf.average() else 0.0
        val avgSecond = if (secondHalf.isNotEmpty()) secondHalf.average() else 0.0

        return when {
            avgFirst == 0.0 && avgSecond > 0.0 -> TrendDirection.INCREASING
            avgFirst > 0.0 && avgSecond == 0.0 -> TrendDirection.DECREASING
            avgSecond > avgFirst * 1.15 -> TrendDirection.INCREASING
            avgSecond < avgFirst * 0.85 -> TrendDirection.DECREASING
            else -> TrendDirection.STABLE
        }
    }
}
