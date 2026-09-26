package com.example.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

sealed interface BiometricStatus {
    data object Ready : BiometricStatus
    data object NotEnrolled : BiometricStatus
    data object NoHardware : BiometricStatus
    data class Unavailable(val message: String) : BiometricStatus
}

sealed interface BiometricAuthResult {
    data object Success : BiometricAuthResult
    data object Canceled : BiometricAuthResult
    data class Failed(val message: String) : BiometricAuthResult
}

object BiometricAuthManager {

    private const val AUTHENTICATORS = Authenticators.BIOMETRIC_STRONG or Authenticators.DEVICE_CREDENTIAL

    fun getBiometricStatus(context: Context): BiometricStatus {
        val biometricManager = BiometricManager.from(context)
        return when (biometricManager.canAuthenticate(AUTHENTICATORS)) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricStatus.Ready
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricStatus.NotEnrolled
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricStatus.NoHardware
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> BiometricStatus.Unavailable("Biometric hardware currently unavailable")
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> BiometricStatus.Unavailable("Security update required for biometric authentication")
            else -> BiometricStatus.Unavailable("Biometric authentication not supported on this device")
        }
    }

    fun canAuthenticate(context: Context): Boolean {
        val status = getBiometricStatus(context)
        return status is BiometricStatus.Ready
    }

    fun authenticate(
        activity: FragmentActivity,
        onResult: (BiometricAuthResult) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock SpendWise")
            .setSubtitle("Confirm your identity to access your expenses")
            .setAllowedAuthenticators(AUTHENTICATORS)
            .build()

        val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onResult(BiometricAuthResult.Success)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                        errorCode == BiometricPrompt.ERROR_CANCELED
                    ) {
                        onResult(BiometricAuthResult.Canceled)
                    } else {
                        onResult(BiometricAuthResult.Failed(errString.toString()))
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Android handles inline retry for incorrect biometrics
                }
            }
        )

        biometricPrompt.authenticate(promptInfo)
    }
}
