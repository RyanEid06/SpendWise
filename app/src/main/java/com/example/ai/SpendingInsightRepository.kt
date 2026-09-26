package com.example.ai

import android.content.Context
import android.content.SharedPreferences
import com.example.ai.model.AiAnalysisResult
import com.example.ai.model.HistoricalSpendingSummary
import com.example.ai.model.InsightCardItem
import com.example.ai.model.InsightSeverity
import com.example.data.model.Expense
import com.example.util.DateUtils
import com.example.util.NetworkUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

sealed interface AiAnalysisUiState {
    data object Idle : AiAnalysisUiState
    data object Loading : AiAnalysisUiState
    data class Success(val result: AiAnalysisResult, val notice: String? = null) : AiAnalysisUiState
    data class Error(val message: String, val fallbackResult: AiAnalysisResult? = null) : AiAnalysisUiState
}

class SpendingInsightRepository(
    private val context: Context,
    private val spendingAnalyzer: SpendingAnalyzer = SpendingAnalyzer(),
    private val geminiService: GeminiSpendingService = GeminiSpendingService()
) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("spendwise_ai_insights", Context.MODE_PRIVATE)

    private val _analysisState = MutableStateFlow<AiAnalysisUiState>(loadCachedAnalysis())
    val analysisState: StateFlow<AiAnalysisUiState> = _analysisState.asStateFlow()

    fun getCachedResult(): AiAnalysisResult? {
        val cachedJson = prefs.getString(KEY_CACHED_RESULT, null) ?: return null
        return try {
            deserializeResult(cachedJson)
        } catch (_: Exception) {
            null
        }
    }

    private fun loadCachedAnalysis(): AiAnalysisUiState {
        val cached = getCachedResult()
        return if (cached != null) {
            AiAnalysisUiState.Success(cached)
        } else {
            AiAnalysisUiState.Idle
        }
    }

    suspend fun analyzeSpending(
        allExpenses: List<Expense>,
        targetMonth: DateUtils.MonthYear,
        currencyCode: String
    ) {
        if (allExpenses.isEmpty()) {
            _analysisState.value = AiAnalysisUiState.Error(
                "No expenses recorded yet. Please add some expenses before analyzing your spending."
            )
            return
        }

        _analysisState.value = AiAnalysisUiState.Loading

        // 1. Compute local statistical summary (Personal Learning)
        val summary = spendingAnalyzer.computeHistoricalSummary(allExpenses, targetMonth)

        val targetMonthExpenses = summary.currentMonthExpenses
        if (targetMonthExpenses.isEmpty()) {
            _analysisState.value = AiAnalysisUiState.Error(
                "No expenses recorded for ${targetMonth.getDisplayName()}. Switch to a month with recorded expenses to run analysis."
            )
            return
        }

        val localStatisticalResult = spendingAnalyzer.generateStatisticalAnalysis(summary, currencyCode)

        // 2. Check Network connectivity
        val isOnline = NetworkUtils.isNetworkAvailable(context)
        if (!isOnline) {
            // Provide local offline statistical analysis with a clear offline notice
            cacheResult(localStatisticalResult)
            _analysisState.value = AiAnalysisUiState.Success(
                result = localStatisticalResult,
                notice = "Offline Mode: Showing local statistical spending analysis. Connect to the internet for live Gemini AI insights."
            )
            return
        }

        // 3. Prepare privacy-conscious prompt
        val prompt = spendingAnalyzer.buildGeminiPrompt(summary, currencyCode)

        // 4. Call Gemini AI
        val geminiResult = geminiService.analyzeSpendingWithGemini(prompt, targetMonth.monthKey)

        geminiResult.fold(
            onSuccess = { aiResult ->
                cacheResult(aiResult)
                _analysisState.value = AiAnalysisUiState.Success(aiResult)
            },
            onFailure = { error ->
                // If Gemini call failed (e.g. invalid key or server error), provide fallback
                cacheResult(localStatisticalResult)
                _analysisState.value = AiAnalysisUiState.Success(
                    result = localStatisticalResult,
                    notice = "Using local statistical analysis (${error.localizedMessage ?: "Gemini service unavailable"})."
                )
            }
        )
    }

    private fun cacheResult(result: AiAnalysisResult) {
        try {
            val json = serializeResult(result)
            prefs.edit().putString(KEY_CACHED_RESULT, json).apply()
        } catch (_: Exception) {}
    }

    private fun serializeResult(result: AiAnalysisResult): String {
        val root = JSONObject().apply {
            put("timestamp", result.timestamp)
            put("analyzedMonthKey", result.analyzedMonthKey)
            put("isAiGenerated", result.isAiGenerated)
            put("spendingOverview", result.spendingOverview)
            put("historyContext", result.historyContext)
            put("biggestChanges", serializeCards(result.biggestChanges))
            put("unusualExpenses", serializeCards(result.unusualExpenses))
            put("recurringSpending", serializeCards(result.recurringSpending))
            put("areasToReview", serializeCards(result.areasToReview))
        }
        return root.toString()
    }

    private fun serializeCards(cards: List<InsightCardItem>): JSONArray {
        val array = JSONArray()
        cards.forEach { c ->
            val obj = JSONObject().apply {
                put("title", c.title)
                put("explanation", c.explanation)
                put("numbers", c.numbers)
                put("category", c.category ?: "")
                put("severity", c.severity.name)
            }
            array.put(obj)
        }
        return array
    }

    private fun deserializeResult(jsonString: String): AiAnalysisResult {
        val root = JSONObject(jsonString)
        return AiAnalysisResult(
            timestamp = root.optLong("timestamp", System.currentTimeMillis()),
            analyzedMonthKey = root.optString("analyzedMonthKey", ""),
            isAiGenerated = root.optBoolean("isAiGenerated", false),
            spendingOverview = root.optString("spendingOverview", ""),
            historyContext = root.optString("historyContext", ""),
            biggestChanges = deserializeCards(root.optJSONArray("biggestChanges")),
            unusualExpenses = deserializeCards(root.optJSONArray("unusualExpenses")),
            recurringSpending = deserializeCards(root.optJSONArray("recurringSpending")),
            areasToReview = deserializeCards(root.optJSONArray("areasToReview"))
        )
    }

    private fun deserializeCards(array: JSONArray?): List<InsightCardItem> {
        if (array == null) return emptyList()
        val list = mutableListOf<InsightCardItem>()
        for (i in 0 until array.length()) {
            val obj = array.optJSONObject(i) ?: continue
            list.add(
                InsightCardItem(
                    title = obj.optString("title", ""),
                    explanation = obj.optString("explanation", ""),
                    numbers = obj.optString("numbers", ""),
                    category = obj.optString("category").takeIf { it.isNotBlank() },
                    severity = try {
                        InsightSeverity.valueOf(obj.optString("severity", "INFO"))
                    } catch (_: Exception) {
                        InsightSeverity.INFO
                    }
                )
            )
        }
        return list
    }

    fun clearCache() {
        prefs.edit().remove(KEY_CACHED_RESULT).apply()
        _analysisState.value = AiAnalysisUiState.Idle
    }

    companion object {
        private const val KEY_CACHED_RESULT = "cached_analysis_result"
    }
}
