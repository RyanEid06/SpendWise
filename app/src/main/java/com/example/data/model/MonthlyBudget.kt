package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "monthly_budgets")
data class MonthlyBudget(
    @PrimaryKey
    val monthKey: String, // Format: "yyyy-MM", e.g. "2026-09"
    val startingAmount: Double,
    val updatedAt: Long = System.currentTimeMillis()
)
