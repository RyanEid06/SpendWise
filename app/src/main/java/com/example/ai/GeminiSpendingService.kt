package com.example.ai

import com.example.BuildConfig
import com.example.ai.model.AiAnalysisResult
import com.example.ai.model.InsightCardItem
import com.example.ai.model.InsightSeverity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class GeminiSpendingService {

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    // Using gemini-3.5-flash as mandated for text analysis by gemini-api skill
    private val modelName = "gemini-3.5-flash"
    private val baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/$modelName:generateContent"

    suspend fun analyzeSpendingWithGemini(
        prompt: String,
        monthKey: String
    ): Result<AiAnalysisResult> = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY

        if (apiKey.isBlank() || apiKey == "MY_GEMINI_API_KEY") {
            return@withContext Result.failure(
                IllegalStateException("Gemini API key is not configured. Please add your key in the AI Studio Secrets panel.")
            )
        }

        try {
            val requestJson = JSONObject().apply {
                val contentsArray = JSONArray().apply {
                    val contentObj = JSONObject().apply {
                        val partsArray = JSONArray().apply {
                            put(JSONObject().put("text", prompt))
                        }
                        put("parts", partsArray)
                    }
                    put(contentObj)
                }
                put("contents", contentsArray)

                val generationConfig = JSONObject().apply {
                    put("responseMimeType", "application/json")
                    put("temperature", 0.2)
                }
                put("generationConfig", generationConfig)

                val systemInstruction = JSONObject().apply {
                    val parts = JSONArray().apply {
                        put(JSONObject().put("text", "You are an objective financial analytics assistant. Distinguish between unusual expenses and inherently bad expenses. Provide constructive, non-judgmental spending insights."))
                    }
                    put("parts", parts)
                }
                put("systemInstruction", systemInstruction)
            }

            val requestBody = requestJson.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$baseUrl?key=$apiKey")
                .post(requestBody)
                .build()

            val response = okHttpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: ""
                val errorMessage = try {
                    val errorJson = JSONObject(errorBody)
                    errorJson.optJSONObject("error")?.optString("message") ?: "HTTP ${response.code}"
                } catch (_: Exception) {
                    "HTTP ${response.code}: $errorBody"
                }
                return@withContext Result.failure(IOException("Gemini API call failed: $errorMessage"))
            }

            val responseBody = response.body?.string()
                ?: return@withContext Result.failure(IOException("Empty response from Gemini API"))

            val rootJson = JSONObject(responseBody)
            val candidates = rootJson.optJSONArray("candidates")
            if (candidates == null || candidates.length() == 0) {
                return@withContext Result.failure(IOException("No candidates returned from Gemini API"))
            }

            val firstCandidate = candidates.getJSONObject(0)
            val content = firstCandidate.getJSONObject("content")
            val parts = content.getJSONArray("parts")
            val rawText = parts.getJSONObject(0).getString("text")

            val parsedResult = parseGeminiJsonResponse(rawText, monthKey)
            Result.success(parsedResult)

        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseGeminiJsonResponse(jsonString: String, monthKey: String): AiAnalysisResult {
        val json = JSONObject(jsonString)

        val spendingOverview = json.optString("spendingOverview", "Spending analysis complete.")
        val historyContext = json.optString("historyContext", "")

        val biggestChanges = parseInsightItems(json.optJSONArray("biggestChanges"), InsightSeverity.NOTABLE)
        val unusualExpenses = parseInsightItems(json.optJSONArray("unusualExpenses"), InsightSeverity.NOTABLE)
        val recurringSpending = parseInsightItems(json.optJSONArray("recurringSpending"), InsightSeverity.INFO)
        val areasToReview = parseInsightItems(json.optJSONArray("areasToReview"), InsightSeverity.REVIEW)

        return AiAnalysisResult(
            timestamp = System.currentTimeMillis(),
            analyzedMonthKey = monthKey,
            isAiGenerated = true,
            spendingOverview = spendingOverview,
            historyContext = historyContext,
            biggestChanges = biggestChanges,
            unusualExpenses = unusualExpenses,
            recurringSpending = recurringSpending,
            areasToReview = areasToReview
        )
    }

    private fun parseInsightItems(
        jsonArray: JSONArray?,
        defaultSeverity: InsightSeverity
    ): List<InsightCardItem> {
        if (jsonArray == null) return emptyList()
        val list = mutableListOf<InsightCardItem>()
        for (i in 0 until jsonArray.length()) {
            val item = jsonArray.optJSONObject(i) ?: continue
            val title = item.optString("title", "Observation")
            val explanation = item.optString("explanation", "")
            val numbers = item.optString("numbers", "")
            val category = item.optString("category").takeIf { it.isNotBlank() }
            val severityStr = item.optString("severity", defaultSeverity.name)
            val severity = try {
                InsightSeverity.valueOf(severityStr)
            } catch (_: Exception) {
                defaultSeverity
            }

            list.add(
                InsightCardItem(
                    title = title,
                    explanation = explanation,
                    numbers = numbers,
                    category = category,
                    severity = severity
                )
            )
        }
        return list
    }
}
