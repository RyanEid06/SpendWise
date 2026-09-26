package com.example

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.example.data.model.Expense
import com.example.security.BiometricAuthManager
import com.example.security.BiometricAuthResult
import com.example.ui.components.AddEditExpenseDialog
import com.example.ui.components.SetBudgetDialog
import com.example.ui.screens.AiInsightsScreen
import com.example.ui.screens.DashboardScreen
import com.example.ui.screens.HistoryScreen
import com.example.ui.screens.LockScreen
import com.example.ui.screens.SettingsScreen
import com.example.ui.theme.SpendWiseTheme
import com.example.ui.viewmodel.ExpenseViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

enum class Screen(
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    HOME("Home", Icons.Filled.Home, Icons.Outlined.Home),
    HISTORY("History", Icons.AutoMirrored.Filled.ReceiptLong, Icons.AutoMirrored.Outlined.ReceiptLong),
    AI_INSIGHTS("AI Insights", Icons.Filled.AutoAwesome, Icons.Outlined.AutoAwesome),
    SETTINGS("Settings", Icons.Filled.Settings, Icons.Outlined.Settings)
}

class MainActivity : FragmentActivity() {

    private val viewModel: ExpenseViewModel by viewModels()
    private var isAppLocked = mutableStateOf(false)
    private var lockErrorMessage = mutableStateOf<String?>(null)
    private var lastBackgroundTimeMillis: Long = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // If App Lock is enabled, start in locked state
        if (viewModel.appLockEnabled.value) {
            isAppLocked.value = true
        }

        // Manage window FLAG_SECURE to protect against screen recordings and Recent Apps preview
        lifecycleScope.launch {
            viewModel.appLockEnabled.collectLatest { enabled ->
                if (enabled) {
                    window.setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    )
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
            }
        }

        setContent {
            val themeMode by viewModel.themeMode.collectAsStateWithLifecycle()
            val locked by isAppLocked
            val lockError by lockErrorMessage

            SpendWiseTheme(themeMode = themeMode) {
                if (locked) {
                    // Trigger authentication on appearance
                    LaunchedEffect(Unit) {
                        triggerUnlock()
                    }

                    LockScreen(
                        errorMessage = lockError,
                        onUnlockClick = { triggerUnlock() }
                    )
                } else {
                    MainAppScreen(viewModel = viewModel)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (viewModel.appLockEnabled.value && lastBackgroundTimeMillis > 0L) {
            val elapsedSeconds = (System.currentTimeMillis() - lastBackgroundTimeMillis) / 1000
            val timeoutSeconds = viewModel.lockTimeoutSeconds.value
            if (elapsedSeconds >= timeoutSeconds) {
                isAppLocked.value = true
            }
        }
    }

    override fun onStop() {
        super.onStop()
        lastBackgroundTimeMillis = System.currentTimeMillis()
    }

    private fun triggerUnlock() {
        BiometricAuthManager.authenticate(this) { result ->
            when (result) {
                is BiometricAuthResult.Success -> {
                    isAppLocked.value = false
                    lockErrorMessage.value = null
                }
                is BiometricAuthResult.Canceled -> {
                    lockErrorMessage.value = null
                }
                is BiometricAuthResult.Failed -> {
                    lockErrorMessage.value = result.message
                }
            }
        }
    }
}

@Composable
fun MainAppScreen(viewModel: ExpenseViewModel) {
    var currentScreen by remember { mutableStateOf(Screen.HOME) }
    var showAddExpenseDialog by remember { mutableStateOf(false) }
    var editingExpense by remember { mutableStateOf<Expense?>(null) }
    var showSetBudgetDialog by remember { mutableStateOf(false) }

    val dashboardUiState by viewModel.dashboardUiState.collectAsStateWithLifecycle()
    val monthlyExpenses by viewModel.monthlyExpenses.collectAsStateWithLifecycle()
    val allExpenses by viewModel.allExpenses.collectAsStateWithLifecycle()
    val currencyCode by viewModel.currencyCode.collectAsStateWithLifecycle()
    val themeMode by viewModel.themeMode.collectAsStateWithLifecycle()
    val aiAnalysisState by viewModel.aiAnalysisState.collectAsStateWithLifecycle()
    val appLockEnabled by viewModel.appLockEnabled.collectAsStateWithLifecycle()
    val lockTimeoutSeconds by viewModel.lockTimeoutSeconds.collectAsStateWithLifecycle()

    // Handle system back navigation if not on Home screen
    BackHandler(enabled = currentScreen != Screen.HOME) {
        currentScreen = Screen.HOME
    }

    // Add / Edit Expense Dialog
    if (showAddExpenseDialog || editingExpense != null) {
        val initialExpense = editingExpense
        AddEditExpenseDialog(
            initialExpense = initialExpense,
            defaultDate = System.currentTimeMillis(),
            currencyCode = currencyCode,
            onSave = { amount, description, category, date, note ->
                if (initialExpense == null) {
                    viewModel.addExpense(amount, description, category, date, note)
                } else {
                    viewModel.updateExpense(
                        initialExpense.id,
                        amount,
                        description,
                        category,
                        date,
                        note
                    )
                }
                showAddExpenseDialog = false
                editingExpense = null
            },
            onDismiss = {
                showAddExpenseDialog = false
                editingExpense = null
            }
        )
    }

    // Set Budget Dialog
    if (showSetBudgetDialog) {
        SetBudgetDialog(
            monthName = dashboardUiState.monthYear.getDisplayName(),
            currentStartingAmount = dashboardUiState.startingMoney,
            currencyCode = currencyCode,
            onSave = { amount ->
                viewModel.setStartingMoney(amount)
                showSetBudgetDialog = false
            },
            onDismiss = {
                showSetBudgetDialog = false
            }
        )
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavigationBar(
                modifier = Modifier.testTag("bottom_nav_bar")
            ) {
                Screen.entries.forEach { screen ->
                    val isSelected = currentScreen == screen
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentScreen = screen },
                        icon = {
                            Icon(
                                imageVector = if (isSelected) screen.selectedIcon else screen.unselectedIcon,
                                contentDescription = screen.title
                            )
                        },
                        label = { Text(screen.title) },
                        modifier = Modifier.testTag("nav_item_${screen.name.lowercase()}")
                    )
                }
            }
        },
        floatingActionButton = {
            // Show + Add Expense FAB on Home, History, and AI Insights tabs
            if (currentScreen != Screen.SETTINGS) {
                FloatingActionButton(
                    onClick = {
                        editingExpense = null
                        showAddExpenseDialog = true
                    },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.testTag("add_expense_fab")
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add Expense"
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            AnimatedContent(
                targetState = currentScreen,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "screen_transition"
            ) { screen ->
                when (screen) {
                    Screen.HOME -> {
                        DashboardScreen(
                            uiState = dashboardUiState,
                            currencyCode = currencyCode,
                            onPreviousMonth = { viewModel.previousMonth() },
                            onNextMonth = { viewModel.nextMonth() },
                            onSetBudgetClick = { showSetBudgetDialog = true },
                            onExpenseClick = { expense -> editingExpense = expense }
                        )
                    }

                    Screen.HISTORY -> {
                        HistoryScreen(
                            currentMonthYear = dashboardUiState.monthYear,
                            expenses = monthlyExpenses,
                            currencyCode = currencyCode,
                            onPreviousMonth = { viewModel.previousMonth() },
                            onNextMonth = { viewModel.nextMonth() },
                            onExpenseClick = { expense -> editingExpense = expense },
                            onDeleteExpense = { expense -> viewModel.deleteExpense(expense) },
                            onAddExpenseClick = {
                                editingExpense = null
                                showAddExpenseDialog = true
                            }
                        )
                    }

                    Screen.AI_INSIGHTS -> {
                        AiInsightsScreen(
                            currentMonthYear = dashboardUiState.monthYear,
                            uiState = aiAnalysisState,
                            onPreviousMonth = { viewModel.previousMonth() },
                            onNextMonth = { viewModel.nextMonth() },
                            onAnalyzeClick = { viewModel.analyzeSpending() },
                            onAddExpenseClick = {
                                editingExpense = null
                                showAddExpenseDialog = true
                            }
                        )
                    }

                    Screen.SETTINGS -> {
                        SettingsScreen(
                            currentCurrencyCode = currencyCode,
                            currentThemeMode = themeMode,
                            totalExpensesCount = allExpenses.size,
                            isAppLockEnabled = appLockEnabled,
                            lockTimeoutSeconds = lockTimeoutSeconds,
                            onAppLockToggle = { enabled -> viewModel.setAppLockEnabled(enabled) },
                            onLockTimeoutChange = { seconds -> viewModel.setLockTimeoutSeconds(seconds) },
                            onCurrencyChange = { code -> viewModel.setCurrencyCode(code) },
                            onThemeChange = { mode -> viewModel.setThemeMode(mode) },
                            onClearAllData = { viewModel.clearAllData() },
                            onExportJson = { ctx, uri -> viewModel.exportBackupJson(ctx, uri) },
                            onExportCsv = { ctx, uri -> viewModel.exportExpensesCsv(ctx, uri) },
                            onInspectBackup = { ctx, uri -> viewModel.inspectBackup(ctx, uri) },
                            onRestoreBackup = { backup, replace -> viewModel.restoreBackup(backup, replace) }
                        )
                    }
                }
            }
        }
    }
}
