package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChangeCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ai.AiAnalysisUiState
import com.example.ai.model.AiAnalysisResult
import com.example.ai.model.InsightCardItem
import com.example.ai.model.InsightSeverity
import com.example.data.model.CategoryRegistry
import com.example.ui.components.MonthSelector
import com.example.util.DateUtils

@Composable
fun AiInsightsScreen(
    currentMonthYear: DateUtils.MonthYear,
    uiState: AiAnalysisUiState,
    onPreviousMonth: () -> Unit,
    onNextMonth: () -> Unit,
    onAnalyzeClick: () -> Unit,
    onAddExpenseClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .testTag("ai_insights_screen"),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 600.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header: Month Selector
            item(key = "ai_month_selector") {
                MonthSelector(
                    currentMonthYear = currentMonthYear,
                    onPreviousMonth = onPreviousMonth,
                    onNextMonth = onNextMonth
                )
            }

            // Hero Action Banner
            item(key = "ai_action_card") {
                ElevatedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("ai_analyze_banner_card"),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.elevatedCardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    ),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(
                                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.2f),
                                        CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.secondary,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "AI Spending Analysis",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer
                                )
                                Text(
                                    text = "Analyze historical patterns for ${currentMonthYear.getDisplayName()}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.8f)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = onAnalyzeClick,
                            enabled = uiState !is AiAnalysisUiState.Loading,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.secondary,
                                contentColor = MaterialTheme.colorScheme.onSecondary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("analyze_my_spending_btn")
                        ) {
                            if (uiState is AiAnalysisUiState.Loading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = MaterialTheme.colorScheme.onSecondary,
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text("Analyzing spending patterns...")
                            } else {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (uiState is AiAnalysisUiState.Success) "Re-Analyze Spending" else "Analyze My Spending",
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }

            // State Handling
            when (uiState) {
                is AiAnalysisUiState.Idle -> {
                    item(key = "idle_state") {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(28.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Psychology,
                                    contentDescription = null,
                                    modifier = Modifier.size(52.dp),
                                    tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
                                )
                                Spacer(modifier = Modifier.height(14.dp))
                                Text(
                                    text = "Ready to uncover insights",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Tap 'Analyze My Spending' to evaluate your historical categories, identify unusual spikes, and highlight recurring purchases without judgment.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }

                is AiAnalysisUiState.Loading -> {
                    item(key = "loading_state") {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(44.dp),
                                    color = MaterialTheme.colorScheme.secondary
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = "Evaluating personal spending baselines...",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Comparing current month against historical category averages.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }

                is AiAnalysisUiState.Error -> {
                    item(key = "error_state") {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Info,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "Notice",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = uiState.message,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    Button(
                                        onClick = onAddExpenseClick,
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("+ Add Expense")
                                    }
                                    OutlinedButton(
                                        onClick = onAnalyzeClick,
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("Retry")
                                    }
                                }
                            }
                        }
                    }
                }

                is AiAnalysisUiState.Success -> {
                    val result = uiState.result

                    // Notice Banner if local fallback was used
                    if (uiState.notice != null) {
                        item(key = "fallback_notice") {
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Info,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        text = uiState.notice,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    // Section 1: Spending Overview Card
                    item(key = "spending_overview_card") {
                        OverviewCard(
                            overviewText = result.spendingOverview,
                            historyContext = result.historyContext,
                            isAiGenerated = result.isAiGenerated
                        )
                    }

                    // Section 2: Biggest Changes
                    if (result.biggestChanges.isNotEmpty()) {
                        item(key = "biggest_changes_card") {
                            InsightCategoryCard(
                                title = "Biggest Changes",
                                icon = Icons.Default.ChangeCircle,
                                iconColor = MaterialTheme.colorScheme.primary,
                                items = result.biggestChanges
                            )
                        }
                    }

                    // Section 3: Unusual Expenses
                    if (result.unusualExpenses.isNotEmpty()) {
                        item(key = "unusual_expenses_card") {
                            InsightCategoryCard(
                                title = "Unusual Expenses",
                                icon = Icons.Default.Search,
                                iconColor = Color(0xFFD97706), // Amber
                                items = result.unusualExpenses
                            )
                        }
                    }

                    // Section 4: Recurring Spending
                    if (result.recurringSpending.isNotEmpty()) {
                        item(key = "recurring_spending_card") {
                            InsightCategoryCard(
                                title = "Recurring Spending",
                                icon = Icons.Default.Repeat,
                                iconColor = Color(0xFF6366F1), // Indigo
                                items = result.recurringSpending
                            )
                        }
                    }

                    // Section 5: Potential Problem Areas / Areas to Review
                    if (result.areasToReview.isNotEmpty()) {
                        item(key = "areas_to_review_card") {
                            InsightCategoryCard(
                                title = "Potential Areas to Review",
                                icon = Icons.AutoMirrored.Filled.TrendingUp,
                                iconColor = MaterialTheme.colorScheme.error,
                                items = result.areasToReview
                            )
                        }
                    }
                }
            }

            // Bottom Spacer
            item(key = "insights_bottom_spacer") {
                Spacer(modifier = Modifier.height(72.dp))
            }
        }
    }
}

@Composable
fun OverviewCard(
    overviewText: String,
    historyContext: String,
    isAiGenerated: Boolean
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("spending_overview_card"),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Spending Overview",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isAiGenerated) {
                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f)
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                ) {
                    Text(
                        text = if (isAiGenerated) "Gemini AI" else "Statistical",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (isAiGenerated) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = overviewText,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
                lineHeight = 22.sp
            )

            if (historyContext.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = historyContext,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun InsightCategoryCard(
    title: String,
    icon: ImageVector,
    iconColor: Color,
    items: List<InsightCardItem>
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(iconColor.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = iconColor,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            items.forEach { item ->
                InsightItemRow(item = item)
            }
        }
    }
}

@Composable
fun InsightItemRow(item: InsightCardItem) {
    val categoryInfo = item.category?.let { CategoryRegistry.getCategoryInfo(it) }

    val (badgeBg, badgeText, badgeLabel) = when (item.severity) {
        InsightSeverity.POSITIVE -> Triple(
            Color(0xFFD1FAE5),
            Color(0xFF065F46),
            "Positive"
        )
        InsightSeverity.NOTABLE -> Triple(
            Color(0xFFFEF3C7),
            Color(0xFF92400E),
            "Notable"
        )
        InsightSeverity.REVIEW -> Triple(
            Color(0xFFFEE2E2),
            Color(0xFF991B1B),
            "Review"
        )
        InsightSeverity.INFO -> Triple(
            MaterialTheme.colorScheme.surfaceVariant,
            MaterialTheme.colorScheme.onSurfaceVariant,
            "Pattern"
        )
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    if (categoryInfo != null) {
                        Text(text = categoryInfo.iconEmoji, fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                    }
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = badgeBg
                ) {
                    Text(
                        text = badgeLabel,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = badgeText,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = item.explanation,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 20.sp
            )

            if (item.numbers.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = item.numbers,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}
