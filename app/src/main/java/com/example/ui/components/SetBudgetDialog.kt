package com.example.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.util.CurrencyConfig

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SetBudgetDialog(
    monthName: String,
    currentStartingAmount: Double,
    currencyCode: String,
    onSave: (Double) -> Unit,
    onDismiss: () -> Unit
) {
    val currency = CurrencyConfig.getCurrency(currencyCode)
    var amountText by remember {
        mutableStateOf(if (currentStartingAmount > 0) String.format("%.2f", currentStartingAmount) else "")
    }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val quickAmounts = listOf(500, 1000, 1500, 2000, 3000, 5000)

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.AccountBalanceWallet,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text(
                text = "Starting Budget for $monthName",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Enter how much starting money/income you have budgeted for $monthName. This is specific to this month only.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { input ->
                        // Allow digits and at most one decimal point
                        if (input.isEmpty() || input.matches(Regex("^\\d*(\\.\\d{0,2})?$"))) {
                            amountText = input
                            errorMessage = null
                        }
                    },
                    label = { Text("Starting Money") },
                    leadingIcon = { Text(currency.symbol, fontWeight = FontWeight.Bold) },
                    isError = errorMessage != null,
                    supportingText = {
                        if (errorMessage != null) {
                            Text(errorMessage!!, color = MaterialTheme.colorScheme.error)
                        }
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("budget_amount_input")
                )

                Text(
                    text = "Quick Presets:",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    quickAmounts.forEach { preset ->
                        SuggestionChip(
                            onClick = {
                                amountText = preset.toString()
                                errorMessage = null
                            },
                            label = { Text(CurrencyConfig.format(preset.toDouble(), currencyCode)) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amount = amountText.toDoubleOrNull()
                    if (amount == null || amount <= 0) {
                        errorMessage = "Please enter an amount greater than 0"
                    } else {
                        onSave(amount)
                    }
                },
                modifier = Modifier.testTag("save_budget_button")
            ) {
                Text("Save Budget")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("cancel_budget_button")
            ) {
                Text("Cancel")
            }
        },
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.testTag("set_budget_dialog")
    )
}
