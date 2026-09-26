package com.example.ai.model

enum class InsightSeverity {
    INFO,
    NOTABLE,
    REVIEW,
    POSITIVE
}

data class InsightCardItem(
    val title: String,
    val explanation: String,
    val numbers: String,
    val category: String? = null,
    val severity: InsightSeverity = InsightSeverity.INFO
)

data class AiAnalysisResult(
    val timestamp: Long = System.currentTimeMillis(),
    val analyzedMonthKey: String,
    val isAiGenerated: Boolean = true,
    val spendingOverview: String,
    val historyContext: String,
    val biggestChanges: List<InsightCardItem> = emptyList(),
    val unusualExpenses: List<InsightCardItem> = emptyList(),
    val recurringSpending: List<InsightCardItem> = emptyList(),
    val areasToReview: List<InsightCardItem> = emptyList()
)
