package com.example

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import com.example.ai.SpendingAnalyzer
import com.example.ai.model.ReceiptScanResult
import com.example.data.backup.BackupManager
import com.example.data.model.Expense
import com.example.data.model.MonthlyBudget
import com.example.data.preferences.LockTimeoutOption
import com.example.data.preferences.ThemeMode
import com.example.data.preferences.UserPreferences
import com.example.util.CurrencyConfig
import com.example.util.DateUtils
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ExampleRobolectricTest {

    @Test
    fun `read string from context`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val appName = context.getString(R.string.app_name)
        assertEquals("SpendWise", appName)
    }

    @Test
    fun `currency formatting works as expected`() {
        val formattedUsd = CurrencyConfig.format(1234.50, "USD")
        assertEquals("$1,234.50", formattedUsd)

        val formattedEur = CurrencyConfig.format(50.00, "EUR")
        assertEquals("€50.00", formattedEur)
    }

    @Test
    fun `month navigation calculates next and previous correctly`() {
        val sept2026 = DateUtils.MonthYear(2026, 9)
        assertEquals("2026-09", sept2026.monthKey)

        val oct2026 = sept2026.next()
        assertEquals(2026, oct2026.year)
        assertEquals(10, oct2026.month)

        val aug2026 = sept2026.previous()
        assertEquals(2026, aug2026.year)
        assertEquals(8, aug2026.month)

        // Year rollover
        val jan2026 = DateUtils.MonthYear(2026, 1)
        val dec2025 = jan2026.previous()
        assertEquals(2025, dec2025.year)
        assertEquals(12, dec2025.month)
    }

    @Test
    fun `spending analyzer detects recurring items and generates statistical breakdown`() {
        val sept2026 = DateUtils.MonthYear(2026, 9)
        val septTimestamp = sept2026.getStartOfMonthTimestamp() + 86400000L

        val testExpenses = listOf(
            Expense(id = 1, amount = 15.0, description = "Coffee", category = "Food", date = septTimestamp),
            Expense(id = 2, amount = 15.0, description = "Coffee", category = "Food", date = septTimestamp + 3600000L),
            Expense(id = 3, amount = 15.0, description = "Coffee", category = "Food", date = septTimestamp + 7200000L),
            Expense(id = 4, amount = 250.0, description = "Headphones", category = "Electronics", date = septTimestamp + 10000000L)
        )

        val analyzer = SpendingAnalyzer()
        val summary = analyzer.computeHistoricalSummary(testExpenses, sept2026)

        assertEquals(4, summary.currentMonthExpenses.size)
        assertEquals(295.0, summary.currentMonthTotal, 0.01)

        val recurring = summary.recurringCandidates
        assertTrue(recurring.any { it.descriptionGroup.equals("Coffee", ignoreCase = true) && it.countThisMonth == 3 })

        val analysis = analyzer.generateStatisticalAnalysis(summary, "USD")
        assertNotNull(analysis.spendingOverview)
        assertTrue(analysis.recurringSpending.any { it.title.contains("Coffee") })
    }

    @Test
    fun `receipt scan result stores extracted items and notes correctly`() {
        val result = ReceiptScanResult(
            merchant = "Carrefour",
            totalAmount = 84.32,
            category = "Groceries",
            items = listOf("Milk 2L - $3.50", "Apples 1kg - $4.20"),
            notesSummary = "Items: Milk 2L - $3.50; Apples 1kg - $4.20",
            isUncertain = false
        )

        assertEquals("Carrefour", result.merchant)
        assertEquals(84.32, result.totalAmount ?: 0.0, 0.01)
        assertEquals("Groceries", result.category)
        assertEquals(2, result.items.size)
        assertFalse(result.isUncertain)
    }

    @Test
    fun `backup manager exports and inspects json backup correctly`() {
        runBlocking {
            val context = ApplicationProvider.getApplicationContext<Context>()
            val backupManager = BackupManager()

            val expenses = listOf(
                Expense(id = 101, amount = 42.50, description = "Groceries", category = "Groceries", date = 1758880000000L, note = "Fresh fruit")
            )
            val budgets = listOf(
                MonthlyBudget(monthKey = "2026-09", startingAmount = 1500.0)
            )

            val tempFile = File(context.cacheDir, "test_backup.json")
            val uri = Uri.fromFile(tempFile)

            val exportResult = backupManager.exportToJson(
                context = context,
                uri = uri,
                expenses = expenses,
                budgets = budgets,
                currencyCode = "USD",
                themeMode = ThemeMode.SYSTEM
            )

            assertTrue(exportResult.isSuccess)
            assertEquals(1, exportResult.getOrNull())

            // Inspect the exported file
            val inspectResult = backupManager.readAndInspectBackup(context, uri)
            assertTrue(inspectResult.isSuccess)
            val backup = inspectResult.getOrNull()
            assertNotNull(backup)
            assertEquals(1, backup?.expenses?.size)
            assertEquals(1, backup?.monthlyBudgets?.size)
            assertEquals("Groceries", backup?.expenses?.first()?.description)
            assertEquals(42.50, backup?.expenses?.first()?.amount ?: 0.0, 0.01)
            assertEquals(1500.0, backup?.monthlyBudgets?.first()?.startingAmount ?: 0.0, 0.01)

            tempFile.delete()
        }
    }

    @Test
    fun `backup manager handles corrupted backup file gracefully`() {
        runBlocking {
            val context = ApplicationProvider.getApplicationContext<Context>()
            val backupManager = BackupManager()

            val tempFile = File(context.cacheDir, "corrupted_backup.json")
            tempFile.writeText("This is not valid json content!")
            val uri = Uri.fromFile(tempFile)

            val inspectResult = backupManager.readAndInspectBackup(context, uri)
            assertTrue(inspectResult.isFailure)

            tempFile.delete()
        }
    }

    @Test
    fun `lock timeout option resolves correctly`() {
        assertEquals(LockTimeoutOption.IMMEDIATELY, LockTimeoutOption.fromSeconds(0))
        assertEquals(LockTimeoutOption.ONE_MINUTE, LockTimeoutOption.fromSeconds(60))
        assertEquals(LockTimeoutOption.FIVE_MINUTES, LockTimeoutOption.fromSeconds(300))
        assertEquals(LockTimeoutOption.FIFTEEN_MINUTES, LockTimeoutOption.fromSeconds(900))
        assertEquals(LockTimeoutOption.FIVE_MINUTES, LockTimeoutOption.fromSeconds(9999))
    }

    @Test
    fun `user preferences manages app lock and timeout settings`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val userPrefs = UserPreferences(context)

        userPrefs.setAppLockEnabled(true)
        assertTrue(userPrefs.appLockEnabled.value)

        userPrefs.setLockTimeoutSeconds(60)
        assertEquals(60, userPrefs.lockTimeoutSeconds.value)

        userPrefs.setAppLockEnabled(false)
        assertFalse(userPrefs.appLockEnabled.value)
    }
}
