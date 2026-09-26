package com.example.data.backup

import android.content.Context
import android.net.Uri
import com.example.data.model.Expense
import com.example.data.model.MonthlyBudget
import com.example.data.preferences.ThemeMode
import com.example.data.preferences.UserPreferences
import com.example.data.repository.ExpenseRepository
import com.example.util.DateUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BackupManager {

    suspend fun exportToJson(
        context: Context,
        uri: Uri,
        expenses: List<Expense>,
        budgets: List<MonthlyBudget>,
        currencyCode: String,
        themeMode: ThemeMode
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val now = System.currentTimeMillis()
            val dateFormatted = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(now))

            val rootJson = JSONObject().apply {
                put("metadata", JSONObject().apply {
                    put("app", "SpendWise")
                    put("appVersion", "2.0")
                    put("exportedAt", now)
                    put("exportedAtFormatted", dateFormatted)
                    put("totalExpenses", expenses.size)
                    put("totalBudgets", budgets.size)
                })

                put("settings", JSONObject().apply {
                    put("currencyCode", currencyCode)
                    put("themeMode", themeMode.name)
                })

                val budgetsArray = JSONArray()
                budgets.forEach { b ->
                    budgetsArray.put(JSONObject().apply {
                        put("monthKey", b.monthKey)
                        put("startingAmount", b.startingAmount)
                        put("updatedAt", b.updatedAt)
                    })
                }
                put("monthlyBudgets", budgetsArray)

                val expensesArray = JSONArray()
                expenses.forEach { e ->
                    expensesArray.put(JSONObject().apply {
                        put("id", e.id)
                        put("amount", e.amount)
                        put("description", e.description)
                        put("category", e.category)
                        put("date", e.date)
                        put("dateFormatted", DateUtils.formatDate(e.date))
                        put("note", e.note ?: "")
                        put("createdAt", e.createdAt)
                    })
                }
                put("expenses", expensesArray)
            }

            val jsonString = rootJson.toString(2)
            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                OutputStreamWriter(outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(jsonString)
                }
            } ?: return@withContext Result.failure(IllegalStateException("Could not open destination file"))

            Result.success(expenses.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun exportToCsv(
        context: Context,
        uri: Uri,
        expenses: List<Expense>,
        currencyCode: String
    ): Result<Int> = withContext(Dispatchers.IO) {
        try {
            context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                OutputStreamWriter(outputStream, Charsets.UTF_8).use { writer ->
                    // Header
                    writer.write("ID,Date,Description,Category,Amount,Currency,Note,Created_At\n")

                    expenses.forEach { e ->
                        val escapedDesc = escapeCsvField(e.description)
                        val escapedCategory = escapeCsvField(e.category)
                        val escapedNote = escapeCsvField(e.note ?: "")
                        val dateFormatted = DateUtils.formatDate(e.date)
                        val line = "${e.id},\"$dateFormatted\",$escapedDesc,$escapedCategory,${String.format(Locale.US, "%.2f", e.amount)},$currencyCode,$escapedNote,${e.createdAt}\n"
                        writer.write(line)
                    }
                }
            } ?: return@withContext Result.failure(IllegalStateException("Could not open destination file"))

            Result.success(expenses.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun readAndInspectBackup(
        context: Context,
        uri: Uri
    ): Result<SpendWiseBackup> = withContext(Dispatchers.IO) {
        try {
            val content = context.contentResolver.openInputStream(uri)?.use { inputStream ->
                BufferedReader(InputStreamReader(inputStream, Charsets.UTF_8)).readText()
            } ?: return@withContext Result.failure(IllegalStateException("Could not read backup file"))

            val rootJson = try {
                JSONObject(content)
            } catch (e: Exception) {
                return@withContext Result.failure(
                    IllegalArgumentException("The selected file is not a valid JSON document: ${e.localizedMessage}")
                )
            }

            // Verify structure
            if (!rootJson.has("expenses") && !rootJson.has("monthlyBudgets")) {
                return@withContext Result.failure(
                    IllegalArgumentException("The selected file is not a recognized SpendWise backup (missing financial records).")
                )
            }

            val metaJson = rootJson.optJSONObject("metadata")
            val metadata = BackupMetadata(
                appVersion = metaJson?.optString("appVersion", "2.0") ?: "2.0",
                exportedAt = metaJson?.optLong("exportedAt", System.currentTimeMillis()) ?: System.currentTimeMillis(),
                exportedAtFormatted = metaJson?.optString("exportedAtFormatted", "Unknown") ?: "Unknown",
                totalExpenses = metaJson?.optInt("totalExpenses", 0) ?: 0,
                totalBudgets = metaJson?.optInt("totalBudgets", 0) ?: 0
            )

            val settingsJson = rootJson.optJSONObject("settings")
            val settings = BackupSettings(
                currencyCode = settingsJson?.optString("currencyCode", "USD") ?: "USD",
                themeMode = settingsJson?.optString("themeMode", "SYSTEM") ?: "SYSTEM"
            )

            val budgetsList = mutableListOf<MonthlyBudgetBackupItem>()
            val budgetsArray = rootJson.optJSONArray("monthlyBudgets")
            if (budgetsArray != null) {
                for (i in 0 until budgetsArray.length()) {
                    val b = budgetsArray.getJSONObject(i)
                    budgetsList.add(
                        MonthlyBudgetBackupItem(
                            monthKey = b.getString("monthKey"),
                            startingAmount = b.getDouble("startingAmount"),
                            updatedAt = b.optLong("updatedAt", System.currentTimeMillis())
                        )
                    )
                }
            }

            val expensesList = mutableListOf<ExpenseBackupItem>()
            val expensesArray = rootJson.optJSONArray("expenses")
            if (expensesArray != null) {
                for (i in 0 until expensesArray.length()) {
                    val e = expensesArray.getJSONObject(i)
                    expensesList.add(
                        ExpenseBackupItem(
                            id = e.optLong("id", 0),
                            amount = e.getDouble("amount"),
                            description = e.getString("description"),
                            category = e.getString("category"),
                            date = e.getLong("date"),
                            dateFormatted = e.optString("dateFormatted", ""),
                            note = e.optString("note").takeIf { it.isNotBlank() },
                            createdAt = e.optLong("createdAt", System.currentTimeMillis())
                        )
                    )
                }
            }

            Result.success(
                SpendWiseBackup(
                    metadata = metadata.copy(
                        totalExpenses = expensesList.size,
                        totalBudgets = budgetsList.size
                    ),
                    settings = settings,
                    monthlyBudgets = budgetsList,
                    expenses = expensesList
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restoreBackup(
        repository: ExpenseRepository,
        userPreferences: UserPreferences,
        backup: SpendWiseBackup,
        replaceExisting: Boolean
    ): Result<ImportSummary> = withContext(Dispatchers.IO) {
        try {
            if (replaceExisting) {
                repository.clearAllData()
            }

            // Convert backup items into Room entities
            val expenseEntities = backup.expenses.map { b ->
                Expense(
                    id = if (replaceExisting) b.id else 0, // stable ID if replacing, auto-generated if merging
                    amount = b.amount,
                    description = b.description,
                    category = b.category,
                    date = b.date,
                    note = b.note,
                    createdAt = b.createdAt
                )
            }

            val budgetEntities = backup.monthlyBudgets.map { b ->
                MonthlyBudget(
                    monthKey = b.monthKey,
                    startingAmount = b.startingAmount,
                    updatedAt = b.updatedAt
                )
            }

            if (expenseEntities.isNotEmpty()) {
                repository.addExpenses(expenseEntities)
            }

            if (budgetEntities.isNotEmpty()) {
                repository.addBudgets(budgetEntities)
            }

            // Optionally align currency preference if present
            if (backup.settings.currencyCode.isNotBlank()) {
                userPreferences.setCurrencyCode(backup.settings.currencyCode)
            }

            Result.success(
                ImportSummary(
                    expensesImported = expenseEntities.size,
                    budgetsImported = budgetEntities.size,
                    currencyUpdated = backup.settings.currencyCode.takeIf { it.isNotBlank() },
                    wasReplaced = replaceExisting
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun escapeCsvField(field: String): String {
        return if (field.contains(",") || field.contains("\"") || field.contains("\n")) {
            "\"${field.replace("\"", "\"\"")}\""
        } else {
            field
        }
    }
}
