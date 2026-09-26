package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.data.model.Expense
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses WHERE date >= :startDate AND date <= :endDate ORDER BY date DESC, id DESC")
    fun getExpensesForDateRange(startDate: Long, endDate: Long): Flow<List<Expense>>

    @Query("SELECT * FROM expenses ORDER BY date DESC, id DESC")
    fun getAllExpenses(): Flow<List<Expense>>

    @Query("SELECT * FROM expenses WHERE date >= :startDate AND date <= :endDate ORDER BY amount DESC, date DESC LIMIT :limit")
    fun getTopExpenses(startDate: Long, endDate: Long, limit: Int = 3): Flow<List<Expense>>

    @Query("SELECT * FROM expenses WHERE id = :id LIMIT 1")
    fun getExpenseById(id: Long): Flow<Expense?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: Expense): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpenses(expenses: List<Expense>): List<Long>

    @Update
    suspend fun updateExpense(expense: Expense)

    @Delete
    suspend fun deleteExpense(expense: Expense)

    @Query("DELETE FROM expenses WHERE id = :id")
    suspend fun deleteExpenseById(id: Long)

    @Query("DELETE FROM expenses")
    suspend fun deleteAllExpenses()
}
