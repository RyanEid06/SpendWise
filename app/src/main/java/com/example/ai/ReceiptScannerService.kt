package com.example.ai

import android.content.Context
import android.graphics.Bitmap
import com.example.BuildConfig
import com.example.ai.model.ReceiptScanResult
import com.example.data.model.CategoryRegistry
import com.example.util.DateUtils
import com.example.util.ImageUtils
import com.example.util.NetworkUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.TimeUnit

class ReceiptScannerService(private val context: Context) {

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    // Using gemini-3.5-flash as mandated for text/multimodal tasks by gemini-api skill
    private val modelName = "gemini-3.5-flash"
    private val baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/$modelName:generateContent"

    suspend fun scanReceipt(bitmap: Bitmap): Result<ReceiptScanResult> = withContext(Dispatchers.IO) {
        if (!NetworkUtils.isNetworkAvailable(context)) {
            return@withContext Result.failure(
                IOException("No internet connection. Please connect to the internet to scan receipts with Gemini AI.")
            )
        }

        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isBlank() || apiKey == "MY_GEMINI_API_KEY") {
            return@withContext Result.failure(
                IllegalStateException("Gemini API key is not configured. Please add your key in the AI Studio Secrets panel.")
            )
        }

        try {
            val base64Image = ImageUtils.bitmapToBase64(bitmap)
            val availableCategories = CategoryRegistry.defaultCategories.joinToString(", ") { it.name }

            val prompt = """
                Analyze this receipt image and extract the key details in pure JSON:
                - merchant: store or business name (string or null if unreadable)
                - totalAmount: final total amount paid as a positive number (number or null if not found)
                - date: transaction date formatted as YYYY-MM-DD (string or null if not found)
                - category: best matching category from this list: [$availableCategories]
                - items: list of item strings with item name and price (e.g. "Milk 2L - 3.50")
                - uncertaintyReason: string explaining any uncertainties (e.g. "Total missing", "Blurry text", "Date cut off"), or null if clear.

                IMPORTANT: If a value cannot be confidently read from the image, leave it null. Do not invent or hallucinate values.
                Output pure JSON matching:
                {
                  "merchant": "...",
                  "totalAmount": 12.34,
                  "date": "2026-09-26",
                  "category": "...",
                  "items": ["..."],
                  "uncertaintyReason": null
                }
            """.trimIndent()

            val requestJson = JSONObject().apply {
                val contentsArray = JSONArray().apply {
                    val contentObj = JSONObject().apply {
                        val partsArray = JSONArray().apply {
                            put(JSONObject().put("text", prompt))
                            put(JSONObject().apply {
                                val inlineData = JSONObject().apply {
                                    put("mimeType", "image/jpeg")
                                    put("data", base64Image)
                                }
                                put("inlineData", inlineData)
                            })
                        }
                        put("parts", partsArray)
                    }
                    put(contentObj)
                }
                put("contents", contentsArray)

                val generationConfig = JSONObject().apply {
                    put("responseMimeType", "application/json")
                    put("temperature", 0.1)
                }
                put("generationConfig", generationConfig)
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
                return@withContext Result.failure(IOException("Receipt analysis failed: $errorMessage"))
            }

            val responseBody = response.body?.string()
                ?: return@withContext Result.failure(IOException("Empty response from receipt scanner"))

            val rootJson = JSONObject(responseBody)
            val candidates = rootJson.optJSONArray("candidates")
            if (candidates == null || candidates.length() == 0) {
                return@withContext Result.failure(IOException("No receipt text could be recognized"))
            }

            val candidate = candidates.getJSONObject(0)
            val content = candidate.getJSONObject("content")
            val parts = content.getJSONArray("parts")
            val rawText = parts.getJSONObject(0).getString("text")

            val parsedResult = parseReceiptJson(rawText)
            Result.success(parsedResult)

        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseReceiptJson(rawJsonText: String): ReceiptScanResult {
        return try {
            val json = JSONObject(rawJsonText)
            val merchant = json.optString("merchant").takeIf { it.isNotBlank() && it != "null" }
            val totalAmount = if (json.has("totalAmount") && !json.isNull("totalAmount")) {
                json.optDouble("totalAmount").takeIf { !it.isNaN() && it > 0 }
            } else null

            val dateStr = json.optString("date").takeIf { it.isNotBlank() && it != "null" }
            var dateMillis: Long? = null
            var dateFormatted: String? = null

            if (dateStr != null) {
                try {
                    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                    val parsed = sdf.parse(dateStr)
                    if (parsed != null) {
                        dateMillis = parsed.time
                        dateFormatted = DateUtils.formatDate(dateMillis)
                    }
                } catch (_: Exception) {
                    dateFormatted = dateStr
                }
            }

            val rawCategory = json.optString("category").takeIf { it.isNotBlank() && it != "null" }
            val matchedCategory = if (rawCategory != null) {
                CategoryRegistry.defaultCategories.find {
                    it.name.equals(rawCategory, ignoreCase = true)
                }?.name ?: rawCategory
            } else null

            val itemsList = mutableListOf<String>()
            val itemsArray = json.optJSONArray("items")
            if (itemsArray != null) {
                for (i in 0 until itemsArray.length()) {
                    val item = itemsArray.optString(i)
                    if (item.isNotBlank() && item != "null") {
                        itemsList.add(item)
                    }
                }
            }

            val uncertainty = json.optString("uncertaintyReason").takeIf { it.isNotBlank() && it != "null" }
            val isUncertain = totalAmount == null || merchant == null || uncertainty != null

            val notesSummary = if (itemsList.isNotEmpty()) {
                "Items: " + itemsList.joinToString("; ")
            } else null

            ReceiptScanResult(
                merchant = merchant,
                totalAmount = totalAmount,
                dateMillis = dateMillis,
                dateFormatted = dateFormatted,
                category = matchedCategory,
                items = itemsList,
                notesSummary = notesSummary,
                isUncertain = isUncertain,
                uncertaintyReason = uncertainty
            )
        } catch (e: Exception) {
            ReceiptScanResult(
                isUncertain = true,
                uncertaintyReason = "Could not parse extracted receipt data: ${e.message}"
            )
        }
    }
}
