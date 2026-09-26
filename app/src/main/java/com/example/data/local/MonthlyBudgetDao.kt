package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.data.model.MonthlyBudget
import kotlinx.coroutines.flow.Flow

@Dao
interface MonthlyBudgetDao {
    @Query("SELECT * FROM monthly_budgets WHERE monthKey = :monthKey LIMIT 1")
    fun getBudgetForMonth(monthKey: String): Flow<MonthlyBudget?>

    @Query("SELECT * FROM monthly_budgets")
    fun getAllBudgets(): Flow<List<MonthlyBudget>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateBudget(budget: MonthlyBudget)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBudgets(budgets: List<MonthlyBudget>)

    @Query("DELETE FROM monthly_budgets WHERE monthKey = :monthKey")
    suspend fun deleteBudgetForMonth(monthKey: String)

    @Query("DELETE FROM monthly_budgets")
    suspend fun deleteAllBudgets()
}
