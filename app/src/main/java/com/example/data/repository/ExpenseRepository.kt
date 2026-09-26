package com.example.data.repository

import com.example.data.local.ExpenseDao
import com.example.data.local.MonthlyBudgetDao
import com.example.data.model.Expense
import com.example.data.model.MonthlyBudget
import com.example.util.DateUtils
import kotlinx.coroutines.flow.Flow

class ExpenseRepository(
    private val expenseDao: ExpenseDao,
    private val monthlyBudgetDao: MonthlyBudgetDao
) {
    fun getExpensesForMonth(monthYear: DateUtils.MonthYear): Flow<List<Expense>> {
        val startTimestamp = monthYear.getStartOfMonthTimestamp()
        val endTimestamp = monthYear.getEndOfMonthTimestamp()
        return expenseDao.getExpensesForDateRange(startTimestamp, endTimestamp)
    }

    fun getAllExpenses(): Flow<List<Expense>> {
        return expenseDao.getAllExpenses()
    }

    fun getTopExpensesForMonth(monthYear: DateUtils.MonthYear, limit: Int = 3): Flow<List<Expense>> {
        val startTimestamp = monthYear.getStartOfMonthTimestamp()
        val endTimestamp = monthYear.getEndOfMonthTimestamp()
        return expenseDao.getTopExpenses(startTimestamp, endTimestamp, limit)
    }

    fun getExpenseById(id: Long): Flow<Expense?> {
        return expenseDao.getExpenseById(id)
    }

    suspend fun addExpense(expense: Expense): Long {
        return expenseDao.insertExpense(expense)
    }

    suspend fun updateExpense(expense: Expense) {
        expenseDao.updateExpense(expense)
    }

    suspend fun deleteExpense(expense: Expense) {
        expenseDao.deleteExpense(expense)
    }

    suspend fun deleteExpenseById(id: Long) {
        expenseDao.deleteExpenseById(id)
    }

    fun getBudgetForMonth(monthKey: String): Flow<MonthlyBudget?> {
        return monthlyBudgetDao.getBudgetForMonth(monthKey)
    }

    suspend fun setBudgetForMonth(monthKey: String, amount: Double) {
        val budget = MonthlyBudget(
            monthKey = monthKey,
            startingAmount = amount,
            updatedAt = System.currentTimeMillis()
        )
        monthlyBudgetDao.insertOrUpdateBudget(budget)
    }

    fun getAllBudgets(): Flow<List<MonthlyBudget>> {
        return monthlyBudgetDao.getAllBudgets()
    }

    suspend fun addExpenses(expenses: List<Expense>): List<Long> {
        return expenseDao.insertExpenses(expenses)
    }

    suspend fun addBudgets(budgets: List<MonthlyBudget>) {
        monthlyBudgetDao.insertBudgets(budgets)
    }

    suspend fun clearAllData() {
        expenseDao.deleteAllExpenses()
        monthlyBudgetDao.deleteAllBudgets()
    }
}
