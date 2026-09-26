package com.example.util

import java.text.NumberFormat
import java.util.Locale

data class CurrencyOption(
    val code: String,
    val symbol: String,
    val name: String,
    val symbolPrefix: Boolean = true
)

object CurrencyConfig {
    val supportedCurrencies = listOf(
        CurrencyOption("USD", "$", "US Dollar (USD)"),
        CurrencyOption("EUR", "€", "Euro (EUR)"),
        CurrencyOption("GBP", "£", "British Pound (GBP)"),
        CurrencyOption("CAD", "CA$", "Canadian Dollar (CAD)"),
        CurrencyOption("AUD", "AU$", "Australian Dollar (AUD)"),
        CurrencyOption("JPY", "¥", "Japanese Yen (JPY)", symbolPrefix = true),
        CurrencyOption("INR", "₹", "Indian Rupee (INR)")
    )

    const val DEFAULT_CURRENCY_CODE = "USD"

    fun getCurrency(code: String): CurrencyOption {
        return supportedCurrencies.find { it.code.equals(code, ignoreCase = true) }
            ?: supportedCurrencies.first()
    }

    fun format(amount: Double, currencyCode: String = DEFAULT_CURRENCY_CODE): String {
        val currency = getCurrency(currencyCode)
        val numberFormat = NumberFormat.getNumberInstance(Locale.US).apply {
            minimumFractionDigits = if (currency.code == "JPY") 0 else 2
            maximumFractionDigits = if (currency.code == "JPY") 0 else 2
        }
        val formattedNumber = numberFormat.format(amount)
        return if (currency.symbolPrefix) {
            "${currency.symbol}$formattedNumber"
        } else {
            "$formattedNumber ${currency.symbol}"
        }
    }
}
