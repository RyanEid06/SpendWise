package com.example.data.backup

data class BackupMetadata(
    val appVersion: String = "2.0",
    val exportedAt: Long = System.currentTimeMillis(),
    val exportedAtFormatted: String,
    val totalExpenses: Int,
    val totalBudgets: Int
)

data class BackupSettings(
    val currencyCode: String,
    val themeMode: String
)

data class ExpenseBackupItem(
    val id: Long,
    val amount: Double,
    val description: String,
    val category: String,
    val date: Long,
    val dateFormatted: String,
    val note: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

data class MonthlyBudgetBackupItem(
    val monthKey: String,
    val startingAmount: Double,
    val updatedAt: Long
)

data class SpendWiseBackup(
    val metadata: BackupMetadata,
    val settings: BackupSettings,
    val monthlyBudgets: List<MonthlyBudgetBackupItem>,
    val expenses: List<ExpenseBackupItem>
)

data class ImportSummary(
    val expensesImported: Int,
    val budgetsImported: Int,
    val currencyUpdated: String?,
    val wasReplaced: Boolean
)
