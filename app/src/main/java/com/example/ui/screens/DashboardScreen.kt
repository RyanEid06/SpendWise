package com.example.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.Expense
import com.example.ui.components.BudgetSummaryCards
import com.example.ui.components.CategoryBreakdownSection
import com.example.ui.components.MonthSelector
import com.example.ui.components.TopExpensesSection
import com.example.ui.viewmodel.DashboardUiState

@Composable
fun DashboardScreen(
    uiState: DashboardUiState,
    currencyCode: String,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onSetBudgetClick: () -> Unit,
    onExpenseClick: (Expense) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .testTag("dashboard_screen"),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 600.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header: Month Selector
            item(key = "month_selector") {
                MonthSelector(
                    currentMonthYear = uiState.monthYear,
                    onPreviousMonth = onPreviousMonth,
                    onNextMonth = onNextMonth
                )
            }

            // Budget Summary Cards
            item(key = "budget_cards") {
                BudgetSummaryCards(
                    startingMoney = uiState.startingMoney,
                    isBudgetSet = uiState.isBudgetSet,
                    totalSpent = uiState.totalSpent,
                    remainingMoney = uiState.remainingMoney,
                    progress = uiState.progress,
                    currencyCode = currencyCode,
                    monthName = uiState.monthYear.getDisplayName(),
                    onSetBudgetClick = onSetBudgetClick
                )
            }

            // Top 3 Biggest Expenses
            item(key = "top_expenses") {
                TopExpensesSection(
                    topExpenses = uiState.topExpenses,
                    currencyCode = currencyCode,
                    onExpenseClick = onExpenseClick
                )
            }

            // Spending By Category
            item(key = "category_breakdown") {
                CategoryBreakdownSection(
                    categoryBreakdown = uiState.categoryBreakdown,
                    currencyCode = currencyCode
                )
            }

            // Space at bottom for floating action button / navigation bar
            item(key = "bottom_spacer") {
                Spacer(modifier = Modifier.height(72.dp))
            }
        }
    }
}
