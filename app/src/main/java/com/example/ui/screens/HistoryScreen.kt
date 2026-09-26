package com.example.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.Expense
import com.example.ui.components.ConfirmationDialog
import com.example.ui.components.ExpenseItemCard
import com.example.ui.components.MonthSelector
import com.example.util.CurrencyConfig
import com.example.util.DateUtils

@Composable
fun HistoryScreen(
    currentMonthYear: DateUtils.MonthYear,
    expenses: List<Expense>,
    currencyCode: String,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onExpenseClick: (Expense) -> Unit,
    onDeleteExpense: (Expense) -> Unit,
    onAddExpenseClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var expenseToDelete by remember { mutableStateOf<Expense?>(null) }

    val filteredExpenses = remember(expenses, searchQuery) {
        if (searchQuery.isBlank()) {
            expenses
        } else {
            expenses.filter {
                it.description.contains(searchQuery, ignoreCase = true) ||
                it.category.contains(searchQuery, ignoreCase = true) ||
                (it.note?.contains(searchQuery, ignoreCase = true) == true)
            }
        }
    }

    val totalMonthSpend = remember(filteredExpenses) {
        filteredExpenses.sumOf { it.amount }
    }

    if (expenseToDelete != null) {
        ConfirmationDialog(
            title = "Delete Expense?",
            message = "Are you sure you want to delete \"${expenseToDelete!!.description}\" (${CurrencyConfig.format(expenseToDelete!!.amount, currencyCode)})? This action cannot be undone.",
            confirmText = "Delete",
            isDestructive = true,
            onConfirm = {
                onDeleteExpense(expenseToDelete!!)
                expenseToDelete = null
            },
            onDismiss = {
                expenseToDelete = null
            }
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .testTag("history_screen"),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 600.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Month Selector
            item(key = "history_month_selector") {
                MonthSelector(
                    currentMonthYear = currentMonthYear,
                    onPreviousMonth = onPreviousMonth,
                    onNextMonth = onNextMonth
                )
            }

            // Search Bar & Stats
            item(key = "search_and_stats") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search description or category...") },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Search"
                            )
                        },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(
                                        imageVector = Icons.Default.Clear,
                                        contentDescription = "Clear search"
                                    )
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("history_search_input")
                    )

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${filteredExpenses.size} ${if (filteredExpenses.size == 1) "expense" else "expenses"}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Text(
                            text = "Total: ${CurrencyConfig.format(totalMonthSpend, currencyCode)}",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // List of Expenses
            if (filteredExpenses.isEmpty()) {
                item(key = "empty_history") {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ReceiptLong,
                                contentDescription = null,
                                modifier = Modifier.size(56.dp),
                                tint = MaterialTheme.colorScheme.outline
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = if (searchQuery.isEmpty()) {
                                    "No expenses in ${currentMonthYear.getDisplayName()}"
                                } else {
                                    "No matching expenses found"
                                },
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = if (searchQuery.isEmpty()) {
                                    "Record your spending to keep your budget on track."
                                } else {
                                    "Try clearing your search filter."
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (searchQuery.isEmpty()) {
                                Spacer(modifier = Modifier.height(20.dp))
                                Button(
                                    onClick = onAddExpenseClick,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.testTag("empty_add_expense_btn")
                                ) {
                                    Text("+ Add Expense")
                                }
                            }
                        }
                    }
                }
            } else {
                items(
                    items = filteredExpenses,
                    key = { it.id }
                ) { expense ->
                    ExpenseItemCard(
                        expense = expense,
                        currencyCode = currencyCode,
                        onClick = { onExpenseClick(expense) },
                        onDeleteClick = { expenseToDelete = expense }
                    )
                }
            }

            // Bottom spacer
            item(key = "history_bottom_spacer") {
                Spacer(modifier = Modifier.height(72.dp))
            }
        }
    }
}
