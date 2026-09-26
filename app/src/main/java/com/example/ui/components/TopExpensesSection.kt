package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.CategoryRegistry
import com.example.data.model.Expense
import com.example.util.CurrencyConfig

@Composable
fun TopExpensesSection(
    topExpenses: List<Expense>,
    currencyCode: String,
    onExpenseClick: (Expense) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("top_expenses_section"),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Top 3 Biggest Expenses",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                if (topExpenses.isNotEmpty()) {
                    Text(
                        text = "${topExpenses.size} items",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            if (topExpenses.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No expenses recorded this month yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    topExpenses.forEachIndexed { index, expense ->
                        val categoryInfo = CategoryRegistry.getCategoryInfo(expense.category)
                        val rankColor = when (index) {
                            0 -> Color(0xFFEAB308) // Gold
                            1 -> Color(0xFF94A3B8) // Silver
                            2 -> Color(0xFFB45309) // Bronze
                            else -> MaterialTheme.colorScheme.outline
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f))
                                .clickable { onExpenseClick(expense) }
                                .padding(horizontal = 12.dp, vertical = 10.dp)
                                .testTag("top_expense_item_$index"),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Rank Badge
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .background(rankColor.copy(alpha = 0.15f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "${index + 1}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = rankColor
                                )
                            }

                            Spacer(modifier = Modifier.width(10.dp))

                            // Category Emoji
                            Text(
                                text = categoryInfo.iconEmoji,
                                fontSize = 18.sp
                            )

                            Spacer(modifier = Modifier.width(10.dp))

                            // Description & Category
                            Column(
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = expense.description,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = expense.category,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            // Amount
                            Text(
                                text = CurrencyConfig.format(expense.amount, currencyCode),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }
        }
    }
}
