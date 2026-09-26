package com.example.data.model

import androidx.compose.ui.graphics.Color

data class CategoryInfo(
    val name: String,
    val iconEmoji: String,
    val color: Color
)

object CategoryRegistry {
    val defaultCategories: List<CategoryInfo> = listOf(
        CategoryInfo("Food", "🍔", Color(0xFFF97316)), // Orange
        CategoryInfo("Groceries", "🛒", Color(0xFF10B981)), // Emerald Green
        CategoryInfo("Transportation", "🚗", Color(0xFF0EA5E9)), // Sky Blue
        CategoryInfo("Shopping", "🛍️", Color(0xFFEC4899)), // Pink
        CategoryInfo("Entertainment", "🎬", Color(0xFF8B5CF6)), // Purple
        CategoryInfo("Bills", "📄", Color(0xFFEF4444)), // Red
        CategoryInfo("Subscriptions", "📱", Color(0xFF6366F1)), // Indigo
        CategoryInfo("Health", "💊", Color(0xFF14B8A6)), // Teal
        CategoryInfo("Education", "📚", Color(0xFFF59E0B)), // Amber
        CategoryInfo("Electronics", "💻", Color(0xFF3B82F6)), // Blue
        CategoryInfo("Travel", "✈️", Color(0xFF06B6D4)), // Cyan
        CategoryInfo("Other", "🏷️", Color(0xFF64748B)) // Slate
    )

    fun getCategoryInfo(name: String): CategoryInfo {
        return defaultCategories.find { it.name.equals(name, ignoreCase = true) }
            ?: CategoryInfo(name = name, iconEmoji = "🏷️", color = Color(0xFF64748B))
    }
}
