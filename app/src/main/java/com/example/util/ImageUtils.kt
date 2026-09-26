package com.example.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import kotlin.math.max

object ImageUtils {

    fun createReceiptTempFile(context: Context): Pair<File, Uri> {
        val receiptsDir = File(context.cacheDir, "receipts").apply {
            if (!exists()) mkdirs()
        }
        val file = File(receiptsDir, "receipt_temp_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        return Pair(file, uri)
    }

    fun loadAndOptimizeBitmap(context: Context, uri: Uri, maxDimension: Int = 1200): Bitmap? {
        return try {
            val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
            val fullBitmap = BitmapFactory.decodeStream(inputStream)
            inputStream?.close()

            if (fullBitmap == null) return null

            // Read EXIF orientation
            var rotatedBitmap = fullBitmap
            try {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    val exif = ExifInterface(stream)
                    val orientation = exif.getAttributeInt(
                        ExifInterface.TAG_ORIENTATION,
                        ExifInterface.ORIENTATION_NORMAL
                    )
                    val rotationDegrees = when (orientation) {
                        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                        else -> 0f
                    }
                    if (rotationDegrees != 0f) {
                        val matrix = Matrix().apply { postRotate(rotationDegrees) }
                        rotatedBitmap = Bitmap.createBitmap(
                            fullBitmap, 0, 0, fullBitmap.width, fullBitmap.height, matrix, true
                        )
                    }
                }
            } catch (_: Exception) {}

            // Scale down if larger than maxDimension
            val width = rotatedBitmap.width
            val height = rotatedBitmap.height
            val largest = max(width, height)

            if (largest > maxDimension) {
                val scale = maxDimension.toFloat() / largest
                val scaledWidth = (width * scale).toInt()
                val scaledHeight = (height * scale).toInt()
                Bitmap.createScaledBitmap(rotatedBitmap, scaledWidth, scaledHeight, true)
            } else {
                rotatedBitmap
            }
        } catch (e: Exception) {
            null
        }
    }

    fun bitmapToBase64(bitmap: Bitmap): String {
        val outputStream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, outputStream)
        return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
    }
}
