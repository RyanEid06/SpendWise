package com.example.util

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Utility functions for month calculations, timestamps, and formatting.
 * Uses Calendar and SimpleDateFormat for complete compatibility across Android API levels.
 */
object DateUtils {

    /**
     * Represents a specific Year and Month (e.g. 2026, 9 for September 2026).
     * month is 1-indexed (1 = January, 12 = December).
     */
    data class MonthYear(
        val year: Int,
        val month: Int // 1 to 12
    ) {
        val monthKey: String
            get() = String.format(Locale.US, "%04d-%02d", year, month)

        fun previous(): MonthYear {
            return if (month == 1) {
                MonthYear(year - 1, 12)
            } else {
                MonthYear(year, month - 1)
            }
        }

        fun next(): MonthYear {
            return if (month == 12) {
                MonthYear(year + 1, 1)
            } else {
                MonthYear(year, month + 1)
            }
        }

        fun getDisplayName(): String {
            val cal = Calendar.getInstance().apply {
                set(Calendar.YEAR, year)
                set(Calendar.MONTH, month - 1)
                set(Calendar.DAY_OF_MONTH, 1)
            }
            val formatter = SimpleDateFormat("MMMM yyyy", Locale.getDefault())
            return formatter.format(cal.time)
        }

        fun getStartOfMonthTimestamp(): Long {
            val cal = Calendar.getInstance().apply {
                set(Calendar.YEAR, year)
                set(Calendar.MONTH, month - 1)
                set(Calendar.DAY_OF_MONTH, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            return cal.timeInMillis
        }

        fun getEndOfMonthTimestamp(): Long {
            val cal = Calendar.getInstance().apply {
                set(Calendar.YEAR, year)
                set(Calendar.MONTH, month - 1)
                val maxDay = getActualMaximum(Calendar.DAY_OF_MONTH)
                set(Calendar.DAY_OF_MONTH, maxDay)
                set(Calendar.HOUR_OF_DAY, 23)
                set(Calendar.MINUTE, 59)
                set(Calendar.SECOND, 59)
                set(Calendar.MILLISECOND, 999)
            }
            return cal.timeInMillis
        }
    }

    fun currentMonthYear(): MonthYear {
        val cal = Calendar.getInstance()
        return MonthYear(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
    }

    fun formatDate(timestamp: Long): String {
        val formatter = SimpleDateFormat("MMMM d, yyyy", Locale.getDefault())
        return formatter.format(Date(timestamp))
    }

    fun formatShortDate(timestamp: Long): String {
        val formatter = SimpleDateFormat("MMM d", Locale.getDefault())
        return formatter.format(Date(timestamp))
    }

    fun getMonthYearFromTimestamp(timestamp: Long): MonthYear {
        val cal = Calendar.getInstance().apply {
            timeInMillis = timestamp
        }
        return MonthYear(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1)
    }
}
