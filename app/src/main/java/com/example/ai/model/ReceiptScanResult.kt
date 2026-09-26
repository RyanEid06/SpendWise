package com.example.ai.model

data class ReceiptScanResult(
    val merchant: String? = null,
    val totalAmount: Double? = null,
    val dateMillis: Long? = null,
    val dateFormatted: String? = null,
    val category: String? = null,
    val items: List<String> = emptyList(),
    val notesSummary: String? = null,
    val isUncertain: Boolean = false,
    val uncertaintyReason: String? = null
)
