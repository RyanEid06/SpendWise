package com.example.ui.viewmodel

import android.app.Application
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.ai.AiAnalysisUiState
import com.example.ai.DefaultSpendingAnalysisService
import com.example.ai.SpendingAnalysisService
import com.example.ai.SpendingInsight
import com.example.ai.SpendingInsightRepository
import com.example.data.local.AppDatabase
import com.example.data.model.CategoryRegistry
import com.example.data.model.Expense
import com.example.data.model.MonthlyBudget
import com.example.data.preferences.ThemeMode
import com.example.data.preferences.UserPreferences
import com.example.data.repository.ExpenseRepository
import com.example.util.DateUtils
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class CategorySpend(
    val categoryName: String,
    val amount: Double,
    val percentage: Float, // 0.0 to 100.0
    val iconEmoji: String,
    val color: Color
)

data class DashboardUiState(
    val monthYear: DateUtils.MonthYear,
    val startingMoney: Double,
    val isBudgetSet: Boolean,
    val totalSpent: Double,
    val remainingMoney: Double,
    val progress: Float, // 0.0 to 1.0 (or > 1.0 if overspent)
    val topExpenses: List<Expense>,
    val categoryBreakdown: List<CategorySpend>,
    val expenses: List<Expense>,
    val insights: List<SpendingInsight>
)

class ExpenseViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: ExpenseRepository
    private val userPreferences: UserPreferences
    private val spendingAnalysisService: SpendingAnalysisService
    private val spendingInsightRepository: SpendingInsightRepository

    init {
        val database = AppDatabase.getDatabase(application)
        repository = ExpenseRepository(database.expenseDao(), database.monthlyBudgetDao())
        userPreferences = UserPreferences(application)
        spendingAnalysisService = DefaultSpendingAnalysisService()
        spendingInsightRepository = SpendingInsightRepository(application)
    }

    val currencyCode: StateFlow<String> = userPreferences.currencyCode
    val themeMode: StateFlow<ThemeMode> = userPreferences.themeMode
    val appLockEnabled: StateFlow<Boolean> = userPreferences.appLockEnabled
    val lockTimeoutSeconds: StateFlow<Int> = userPreferences.lockTimeoutSeconds
    val aiAnalysisState: StateFlow<AiAnalysisUiState> = spendingInsightRepository.analysisState

    private val _currentMonthYear = MutableStateFlow(DateUtils.currentMonthYear())
    val currentMonthYear: StateFlow<DateUtils.MonthYear> = _currentMonthYear.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val monthlyExpenses: StateFlow<List<Expense>> = _currentMonthYear
        .flatMapLatest { month ->
            repository.getExpensesForMonth(month)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    @OptIn(ExperimentalCoroutinesApi::class)
    val currentBudget: StateFlow<MonthlyBudget?> = _currentMonthYear
        .flatMapLatest { month ->
            repository.getBudgetForMonth(month.monthKey)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = null
        )

    val allExpenses: StateFlow<List<Expense>> = repository.getAllExpenses()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val dashboardUiState: StateFlow<DashboardUiState> = combine(
        _currentMonthYear,
        monthlyExpenses,
        currentBudget,
        currencyCode
    ) { month, expenses, budget, currency ->
        val startingMoney = budget?.startingAmount ?: 0.0
        val isBudgetSet = budget != null
        val totalSpent = expenses.sumOf { it.amount }
        val remainingMoney = startingMoney - totalSpent
        val progress = if (startingMoney > 0.0) {
            (totalSpent / startingMoney).toFloat()
        } else {
            0f
        }

        val topExpenses = expenses.sortedByDescending { it.amount }.take(3)

        val categoryGroups = expenses.groupBy { it.category }
        val breakdown = categoryGroups.map { (catName, catExpenses) ->
            val catAmount = catExpenses.sumOf { it.amount }
            val percentage = if (totalSpent > 0) ((catAmount / totalSpent) * 100).toFloat() else 0f
            val info = CategoryRegistry.getCategoryInfo(catName)
            CategorySpend(
                categoryName = catName,
                amount = catAmount,
                percentage = percentage,
                iconEmoji = info.iconEmoji,
                color = info.color
            )
        }.sortedByDescending { it.amount }

        val insights = spendingAnalysisService.analyzeSpending(expenses, startingMoney, currency)

        DashboardUiState(
            monthYear = month,
            startingMoney = startingMoney,
            isBudgetSet = isBudgetSet,
            totalSpent = totalSpent,
            remainingMoney = remainingMoney,
            progress = progress,
            topExpenses = topExpenses,
            categoryBreakdown = breakdown,
            expenses = expenses,
            insights = insights
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = DashboardUiState(
            monthYear = _currentMonthYear.value,
            startingMoney = 0.0,
            isBudgetSet = false,
            totalSpent = 0.0,
            remainingMoney = 0.0,
            progress = 0f,
            topExpenses = emptyList(),
            categoryBreakdown = emptyList(),
            expenses = emptyList(),
            insights = emptyList()
        )
    )

    fun previousMonth() {
        _currentMonthYear.value = _currentMonthYear.value.previous()
    }

    fun nextMonth() {
        _currentMonthYear.value = _currentMonthYear.value.next()
    }

    fun setMonth(monthYear: DateUtils.MonthYear) {
        _currentMonthYear.value = monthYear
    }

    fun setStartingMoney(amount: Double) {
        viewModelScope.launch {
            repository.setBudgetForMonth(_currentMonthYear.value.monthKey, amount)
        }
    }

    fun addExpense(
        amount: Double,
        description: String,
        category: String,
        date: Long,
        note: String?
    ) {
        viewModelScope.launch {
            val expense = Expense(
                amount = amount,
                description = description.trim(),
                category = category.trim(),
                date = date,
                note = note?.trim()?.ifBlank { null }
            )
            repository.addExpense(expense)
        }
    }

    fun updateExpense(
        id: Long,
        amount: Double,
        description: String,
        category: String,
        date: Long,
        note: String?
    ) {
        viewModelScope.launch {
            val expense = Expense(
                id = id,
                amount = amount,
                description = description.trim(),
                category = category.trim(),
                date = date,
                note = note?.trim()?.ifBlank { null }
            )
            repository.updateExpense(expense)
        }
    }

    fun deleteExpense(expense: Expense) {
        viewModelScope.launch {
            repository.deleteExpense(expense)
        }
    }

    fun deleteExpenseById(id: Long) {
        viewModelScope.launch {
            repository.deleteExpenseById(id)
        }
    }

    fun analyzeSpending() {
        viewModelScope.launch {
            spendingInsightRepository.analyzeSpending(
                allExpenses = allExpenses.value,
                targetMonth = _currentMonthYear.value,
                currencyCode = currencyCode.value
            )
        }
    }

    fun setCurrencyCode(code: String) {
        userPreferences.setCurrencyCode(code)
    }

    fun setThemeMode(mode: ThemeMode) {
        userPreferences.setThemeMode(mode)
    }

    val allBudgets: StateFlow<List<MonthlyBudget>> = repository.getAllBudgets()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    private val backupManager = com.example.data.backup.BackupManager()

    suspend fun exportBackupJson(context: android.content.Context, uri: android.net.Uri): Result<Int> {
        return backupManager.exportToJson(
            context = context,
            uri = uri,
            expenses = allExpenses.value,
            budgets = allBudgets.value,
            currencyCode = currencyCode.value,
            themeMode = themeMode.value
        )
    }

    suspend fun exportExpensesCsv(context: android.content.Context, uri: android.net.Uri): Result<Int> {
        return backupManager.exportToCsv(
            context = context,
            uri = uri,
            expenses = allExpenses.value,
            currencyCode = currencyCode.value
        )
    }

    suspend fun inspectBackup(context: android.content.Context, uri: android.net.Uri): Result<com.example.data.backup.SpendWiseBackup> {
        return backupManager.readAndInspectBackup(context, uri)
    }

    suspend fun restoreBackup(backup: com.example.data.backup.SpendWiseBackup, replaceExisting: Boolean): Result<com.example.data.backup.ImportSummary> {
        return backupManager.restoreBackup(
            repository = repository,
            userPreferences = userPreferences,
            backup = backup,
            replaceExisting = replaceExisting
        )
    }

    fun setAppLockEnabled(enabled: Boolean) {
        userPreferences.setAppLockEnabled(enabled)
    }

    fun setLockTimeoutSeconds(seconds: Int) {
        userPreferences.setLockTimeoutSeconds(seconds)
    }

    fun clearAllData() {
        viewModelScope.launch {
            repository.clearAllData()
            spendingInsightRepository.clearCache()
        }
    }
}
