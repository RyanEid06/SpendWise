package com.example.data.preferences

import android.content.Context
import android.content.SharedPreferences
import com.example.util.CurrencyConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemeMode {
    SYSTEM,
    LIGHT,
    DARK
}

enum class LockTimeoutOption(val seconds: Int, val label: String) {
    IMMEDIATELY(0, "Immediately"),
    ONE_MINUTE(60, "After 1 minute"),
    FIVE_MINUTES(300, "After 5 minutes"),
    FIFTEEN_MINUTES(900, "After 15 minutes");

    companion object {
        fun fromSeconds(seconds: Int): LockTimeoutOption {
            return entries.find { it.seconds == seconds } ?: FIVE_MINUTES
        }
    }
}

class UserPreferences(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("spendwise_prefs", Context.MODE_PRIVATE)

    private val _currencyCode = MutableStateFlow(
        prefs.getString(KEY_CURRENCY, CurrencyConfig.DEFAULT_CURRENCY_CODE) ?: CurrencyConfig.DEFAULT_CURRENCY_CODE
    )
    val currencyCode: StateFlow<String> = _currencyCode.asStateFlow()

    private val _themeMode = MutableStateFlow(
        try {
            ThemeMode.valueOf(prefs.getString(KEY_THEME, ThemeMode.SYSTEM.name) ?: ThemeMode.SYSTEM.name)
        } catch (_: Exception) {
            ThemeMode.SYSTEM
        }
    )
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    private val _appLockEnabled = MutableStateFlow(
        prefs.getBoolean(KEY_APP_LOCK_ENABLED, false)
    )
    val appLockEnabled: StateFlow<Boolean> = _appLockEnabled.asStateFlow()

    private val _lockTimeoutSeconds = MutableStateFlow(
        prefs.getInt(KEY_LOCK_TIMEOUT_SECONDS, LockTimeoutOption.FIVE_MINUTES.seconds)
    )
    val lockTimeoutSeconds: StateFlow<Int> = _lockTimeoutSeconds.asStateFlow()

    fun setCurrencyCode(code: String) {
        prefs.edit().putString(KEY_CURRENCY, code).apply()
        _currencyCode.value = code
    }

    fun setThemeMode(mode: ThemeMode) {
        prefs.edit().putString(KEY_THEME, mode.name).apply()
        _themeMode.value = mode
    }

    fun setAppLockEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_APP_LOCK_ENABLED, enabled).apply()
        _appLockEnabled.value = enabled
    }

    fun setLockTimeoutSeconds(seconds: Int) {
        prefs.edit().putInt(KEY_LOCK_TIMEOUT_SECONDS, seconds).apply()
        _lockTimeoutSeconds.value = seconds
    }

    companion object {
        private const val KEY_CURRENCY = "pref_currency_code"
        private const val KEY_THEME = "pref_theme_mode"
        private const val KEY_APP_LOCK_ENABLED = "pref_app_lock_enabled"
        private const val KEY_LOCK_TIMEOUT_SECONDS = "pref_lock_timeout_seconds"
    }
}
