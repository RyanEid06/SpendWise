package com.example.ui.components

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import com.example.ai.ReceiptScannerService
import com.example.ai.model.ReceiptScanResult
import com.example.data.model.CategoryRegistry
import com.example.data.model.Expense
import com.example.util.CurrencyConfig
import com.example.util.DateUtils
import com.example.util.ImageUtils
import kotlinx.coroutines.launch
import java.io.File

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AddEditExpenseDialog(
    initialExpense: Expense? = null,
    defaultDate: Long = System.currentTimeMillis(),
    currencyCode: String,
    onSave: (amount: Double, description: String, category: String, date: Long, note: String?) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val receiptScannerService = remember { ReceiptScannerService(context) }
    val currency = CurrencyConfig.getCurrency(currencyCode)

    var amountText by remember {
        mutableStateOf(
            if (initialExpense != null) String.format("%.2f", initialExpense.amount) else ""
        )
    }
    var descriptionText by remember {
        mutableStateOf(initialExpense?.description ?: "")
    }
    var selectedCategory by remember {
        mutableStateOf(initialExpense?.category ?: CategoryRegistry.defaultCategories.first().name)
    }
    var selectedDateMillis by remember {
        mutableLongStateOf(initialExpense?.date ?: defaultDate)
    }
    var noteText by remember {
        mutableStateOf(initialExpense?.note ?: "")
    }

    var amountError by remember { mutableStateOf<String?>(null) }
    var descriptionError by remember { mutableStateOf<String?>(null) }
    var showDatePicker by remember { mutableStateOf(false) }

    // Receipt scanning states
    var isScanningReceipt by remember { mutableStateOf(false) }
    var scanErrorMessage by remember { mutableStateOf<String?>(null) }
    var showSourceSheet by remember { mutableStateOf(false) }
    var lastScannedResult by remember { mutableStateOf<ReceiptScanResult?>(null) }
    var tempCameraFile by remember { mutableStateOf<File?>(null) }
    var tempCameraUri by remember { mutableStateOf<Uri?>(null) }

    fun processReceiptImage(uri: Uri) {
        isScanningReceipt = true
        scanErrorMessage = null
        coroutineScope.launch {
            try {
                val bitmap = ImageUtils.loadAndOptimizeBitmap(context, uri)
                if (bitmap == null) {
                    scanErrorMessage = "Unable to read the image file. Please try another image."
                    isScanningReceipt = false
                    tempCameraFile?.delete()
                    return@launch
                }

                val result = receiptScannerService.scanReceipt(bitmap)
                result.fold(
                    onSuccess = { extracted ->
                        lastScannedResult = extracted

                        // Fill in extracted fields without overwriting with blanks
                        extracted.totalAmount?.let {
                            amountText = String.format("%.2f", it)
                            amountError = null
                        }
                        extracted.merchant?.let {
                            descriptionText = it
                            descriptionError = null
                        }
                        extracted.category?.let {
                            selectedCategory = it
                        }
                        extracted.dateMillis?.let {
                            selectedDateMillis = it
                        }
                        if (!extracted.notesSummary.isNullOrBlank()) {
                            noteText = if (noteText.isBlank()) {
                                extracted.notesSummary
                            } else {
                                "$noteText\n${extracted.notesSummary}"
                            }
                        }
                    },
                    onFailure = { error ->
                        scanErrorMessage = error.localizedMessage ?: "Failed to analyze receipt. You can enter details manually."
                    }
                )
            } catch (e: Exception) {
                scanErrorMessage = "Error scanning receipt: ${e.localizedMessage}"
            } finally {
                isScanningReceipt = false
                tempCameraFile?.delete()
            }
        }
    }

    // Photo picker launcher (Gallery)
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            processReceiptImage(uri)
        }
    }

    // Camera capture launcher
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        val uri = tempCameraUri
        if (success && uri != null) {
            processReceiptImage(uri)
        } else {
            tempCameraFile?.delete()
        }
    }

    // Camera permission launcher
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            try {
                val (file, uri) = ImageUtils.createReceiptTempFile(context)
                tempCameraFile = file
                tempCameraUri = uri
                cameraLauncher.launch(uri)
            } catch (e: Exception) {
                scanErrorMessage = "Could not initialize camera storage: ${e.message}"
            }
        } else {
            scanErrorMessage = "Camera permission was denied. You can select a photo from your gallery instead."
        }
    }

    fun startCameraCapture() {
        showSourceSheet = false
        val hasPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (hasPermission) {
            try {
                val (file, uri) = ImageUtils.createReceiptTempFile(context)
                tempCameraFile = file
                tempCameraUri = uri
                cameraLauncher.launch(uri)
            } catch (e: Exception) {
                scanErrorMessage = "Could not initialize camera storage: ${e.message}"
            }
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    fun startGalleryPicker() {
        showSourceSheet = false
        galleryLauncher.launch(
            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
        )
    }

    // Date Picker Dialog
    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = selectedDateMillis
        )

        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let {
                            selectedDateMillis = it
                        }
                        showDatePicker = false
                    },
                    modifier = Modifier.testTag("date_picker_confirm")
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showDatePicker = false },
                    modifier = Modifier.testTag("date_picker_cancel")
                ) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // Bottom Sheet for Choosing Photo Source
    if (showSourceSheet) {
        ModalBottomSheet(
            onDismissRequest = { showSourceSheet = false },
            sheetState = rememberModalBottomSheetState()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp)
            ) {
                Text(
                    text = "Scan Receipt",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Image is securely sent to Google Gemini for OCR extraction and never permanently stored.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(20.dp))

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .clickable { startCameraCapture() }
                        .testTag("scan_source_camera"),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = "Take Photo",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Capture receipt with your camera",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .clickable { startGalleryPicker() }
                        .testTag("scan_source_gallery"),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.PhotoLibrary,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = "Choose from Gallery",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Select an existing receipt image",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(28.dp))
            }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .padding(vertical = 24.dp)
                .testTag("add_edit_expense_dialog"),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (initialExpense == null) "Add Expense" else "Edit Expense",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Scan Receipt Button (Primary Action)
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .clickable(enabled = !isScanningReceipt) { showSourceSheet = true }
                        .testTag("scan_receipt_button"),
                    color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CameraAlt,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.secondary,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = "Scan Receipt",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer
                                )
                                Text(
                                    text = "Auto-extract merchant, total, date & items",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.8f)
                                )
                            }
                        }

                        if (isScanningReceipt) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        } else {
                            OutlinedButton(
                                onClick = { showSourceSheet = true },
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                modifier = Modifier.height(34.dp)
                            ) {
                                Text("Scan", fontSize = 12.sp)
                            }
                        }
                    }
                }

                // Scanning Progress Banner
                AnimatedVisibility(visible = isScanningReceipt) {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp),
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Analyzing receipt with Gemini AI vision...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Error Message Banner
                AnimatedVisibility(visible = scanErrorMessage != null) {
                    if (scanErrorMessage != null) {
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 10.dp),
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.8f)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.WarningAmber,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = scanErrorMessage!!,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }
                        }
                    }
                }

                // Scanned Confirmation Review Card (When receipt was extracted)
                AnimatedVisibility(visible = lastScannedResult != null) {
                    val scan = lastScannedResult
                    if (scan != null) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp)
                                .testTag("receipt_confirmation_card"),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
                            )
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
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Extracted Receipt Data",
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                                    ) {
                                        Text(
                                            text = "Review & Edit Below",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.primary,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "Merchant:",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                                        )
                                        Text(
                                            text = scan.merchant ?: "Uncertain (left blank)",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.SemiBold,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            text = "Total:",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                                        )
                                        Text(
                                            text = if (scan.totalAmount != null) CurrencyConfig.format(scan.totalAmount, currencyCode) else "Uncertain",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(6.dp))

                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Column {
                                        Text(
                                            text = "Date:",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                                        )
                                        Text(
                                            text = scan.dateFormatted ?: DateUtils.formatDate(selectedDateMillis),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(
                                            text = "Category:",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                                        )
                                        Text(
                                            text = scan.category ?: selectedCategory,
                                            style = MaterialTheme.typography.bodySmall,
                                            fontWeight = FontWeight.Medium,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                }

                                if (scan.items.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "${scan.items.size} line items found (added to notes)",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                if (scan.uncertaintyReason != null) {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "Note: ${scan.uncertaintyReason}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Amount Field
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { input ->
                        if (input.isEmpty() || input.matches(Regex("^\\d*(\\.\\d{0,2})?$"))) {
                            amountText = input
                            amountError = null
                        }
                    },
                    label = { Text("Amount *") },
                    placeholder = { Text("0.00") },
                    leadingIcon = {
                        Text(
                            text = currency.symbol,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = MaterialTheme.colorScheme.primary
                        )
                    },
                    isError = amountError != null,
                    supportingText = {
                        if (amountError != null) {
                            Text(amountError!!, color = MaterialTheme.colorScheme.error)
                        }
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("expense_amount_input")
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Description Field (Merchant / Store)
                OutlinedTextField(
                    value = descriptionText,
                    onValueChange = {
                        descriptionText = it
                        descriptionError = null
                    },
                    label = { Text("Description / Merchant *") },
                    placeholder = { Text("e.g. Carrefour, Starbucks") },
                    isError = descriptionError != null,
                    supportingText = {
                        if (descriptionError != null) {
                            Text(descriptionError!!, color = MaterialTheme.colorScheme.error)
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Sentences
                    ),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("expense_description_input")
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Category Selection
                Text(
                    text = "Category *",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Spacer(modifier = Modifier.height(8.dp))

                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CategoryRegistry.defaultCategories.forEach { category ->
                        val isSelected = category.name.equals(selectedCategory, ignoreCase = true)
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { selectedCategory = category.name }
                                .testTag("category_chip_${category.name}"),
                            shape = RoundedCornerShape(12.dp),
                            color = if (isSelected) {
                                category.color.copy(alpha = 0.2f)
                            } else {
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                            },
                            border = if (isSelected) {
                                androidx.compose.foundation.BorderStroke(1.5.dp, category.color)
                            } else null
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = category.iconEmoji, fontSize = 16.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = category.name,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) category.color else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Date Picker trigger
                Text(
                    text = "Date *",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Spacer(modifier = Modifier.height(8.dp))

                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .clickable { showDatePicker = true }
                        .border(
                            1.dp,
                            MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                            RoundedCornerShape(14.dp)
                        )
                        .testTag("expense_date_picker_button"),
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = DateUtils.formatDate(selectedDateMillis),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Icon(
                            imageVector = Icons.Default.CalendarToday,
                            contentDescription = "Select Date",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Optional Note
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    label = { Text("Optional Note / Itemized Breakdown") },
                    placeholder = { Text("e.g. Lunch with friends or scanned item list") },
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Sentences
                    ),
                    maxLines = 4,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("expense_note_input")
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(
                        onClick = onDismiss,
                        modifier = Modifier.testTag("cancel_expense_button")
                    ) {
                        Text("Cancel")
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Button(
                        onClick = {
                            val amount = amountText.toDoubleOrNull()
                            var hasError = false

                            if (amount == null || amount <= 0) {
                                amountError = "Please enter an amount greater than 0"
                                hasError = true
                            }

                            if (descriptionText.isBlank()) {
                                descriptionError = "Description cannot be empty"
                                hasError = true
                            }

                            if (!hasError && amount != null) {
                                onSave(
                                    amount,
                                    descriptionText.trim(),
                                    selectedCategory,
                                    selectedDateMillis,
                                    noteText.trim().ifBlank { null }
                                )
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.testTag("save_expense_button")
                    ) {
                        Text(if (initialExpense == null) "Save Expense" else "Update Expense")
                    }
                }
            }
        }
    }
}
