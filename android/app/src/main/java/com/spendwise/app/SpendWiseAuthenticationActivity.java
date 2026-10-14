package com.spendwise.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import java.lang.ref.WeakReference;
import java.util.concurrent.atomic.AtomicLong;

/** One internal lifecycle owner per operation: AndroidX 1.1.0 stores callbacks
 * in an Activity ViewModel even for its Fragment constructor. Never share that
 * ViewModel with the next operation, including after a missing cancel callback. */
public final class SpendWiseAuthenticationActivity extends FragmentActivity {
    private static final int CREDENTIAL_REQUEST = 38;
    private static final AtomicLong SERIAL = new AtomicLong();
    private static long cancelledThrough;
    private static WeakReference<SpendWiseAuthenticationActivity> host = new WeakReference<>(null);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final NativeAuthenticationGate terminal = new NativeAuthenticationGate();
    private long terminalToken;
    private long operation;
    private BiometricPrompt prompt;
    private boolean legacyCredential;
    private boolean launching;
    private long promptRevision;

    static long nextOperation() { return SERIAL.incrementAndGet(); }

    static void cancel(long operation) {
        cancelledThrough = Math.max(cancelledThrough, operation);
        SpendWiseAuthenticationActivity activity = host.get();
        if (activity != null && activity.operation == operation) {
            activity.complete("cancelled", "AUTHENTICATION_CANCELLED");
        }
    }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        operation = getIntent().getLongExtra("operation", 0);
        terminalToken = terminal.begin(0);
        // AndroidX connects this lifecycle-bound callback to both button Back
        // and API36 predictive gestures. Always use the same terminal cleanup
        // as OS prompt cancellation; never rely on Activity.onBackPressed.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                complete("cancelled", "AUTHENTICATION_CANCELLED");
            }
        });
        host = new WeakReference<>(this);
        if (operation == 0 || operation <= cancelledThrough || savedInstanceState != null) {
            complete("cancelled", "AUTHENTICATION_STALE");
            return;
        }
        // Authentication has its own finite deadline, independent of app lock
        // inactivity policy. This only cancels; it never grants an auth window.
        handler.postDelayed(() -> complete("cancelled", "AUTHENTICATION_TIMEOUT"), 60_000);
    }

    @Override protected void onPostResume() {
        super.onPostResume();
        if (launching || !terminal.current(terminalToken, 0)) return;
        launching = true;
        launchAuthentication();
    }

    private boolean supported(int authenticators) {
        try { return BiometricManager.from(this).canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS; }
        catch (Exception ignored) { return false; }
    }

    @SuppressWarnings("deprecation")
    private void launchAuthentication() {
        if (!terminal.current(terminalToken, 0)) return;
        final long attempt = ++promptRevision;
        KeyguardManager manager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        boolean credential = manager != null && manager.isDeviceSecure();
        boolean strong = supported(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        boolean modern = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
        boolean credentialSupported = credential && (!modern || supported(BiometricManager.Authenticators.DEVICE_CREDENTIAL));
        boolean combined = modern && strong && credentialSupported && supported(
            BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        int mode = NativeAuthenticationGate.promptMode(Build.VERSION.SDK_INT, strong, credentialSupported, combined,
            "device-credential".equals(getIntent().getStringExtra("method")), getIntent().getIntExtra("timeout", 300));
        if (mode == NativeAuthenticationGate.IMMEDIATE_UNSUPPORTED) {
            complete("unavailable", "CREDENTIAL_IMMEDIATE_LOCK_UNSUPPORTED");
            return;
        }
        if (mode == NativeAuthenticationGate.UNAVAILABLE) {
            complete("unavailable", "SECURE_DEVICE_CREDENTIAL_UNAVAILABLE");
            return;
        }
        String title = getIntent().getStringExtra("title");
        String reason = getIntent().getStringExtra("reason");
        try {
            if (mode == NativeAuthenticationGate.LEGACY_CREDENTIAL) {
                Intent intent = manager.createConfirmDeviceCredentialIntent(title, reason);
                if (intent == null) { complete("unavailable", "SECURE_DEVICE_CREDENTIAL_UNAVAILABLE"); return; }
                legacyCredential = true;
                intent.addFlags(Intent.FLAG_ACTIVITY_NO_USER_ACTION);
                startActivityForResult(intent, CREDENTIAL_REQUEST);
                return;
            }
            prompt = new BiometricPrompt(this, ContextCompat.getMainExecutor(this), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationError(int code, CharSequence ignored) {
                    if (attempt != promptRevision || !terminal.current(terminalToken, 0)) return;
                    // Only legacy biometric-only prompts expose our explicit
                    // credential button. Back/X never starts another prompt.
                    if (code == BiometricPrompt.ERROR_NEGATIVE_BUTTON && !modern && credential
                        && getIntent().getIntExtra("timeout", 300) > 0) {
                        prompt = null;
                        getIntent().putExtra("method", "device-credential");
                        launchAuthentication();
                        return;
                    }
                    boolean cancelled = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_CANCELED
                        || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON;
                    complete(cancelled ? "cancelled" : "error", "BIOMETRIC_" + code);
                }
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult ignored) {
                    if (attempt != promptRevision) return;
                    complete("success", null);
                }
            });
            BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title == null || title.isEmpty() ? "SpendWise" : title)
                .setSubtitle(reason == null || reason.isEmpty() ? "Confirm your identity to continue." : reason)
                .setConfirmationRequired(false);
            if (mode == NativeAuthenticationGate.CREDENTIAL) {
                builder.setAllowedAuthenticators(BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            } else if (mode == NativeAuthenticationGate.COMBINED) {
                builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            } else {
                builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG);
                builder.setNegativeButtonText(!modern && credential && getIntent().getIntExtra("timeout", 300) > 0
                    ? getIntent().getStringExtra("credentialButton") : getIntent().getStringExtra("cancelButton"));
            }
            prompt.authenticate(builder.build());
        } catch (Exception ignored) { complete("error", "AUTHENTICATION_PROMPT_FAILED"); }
    }

    @Override protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        complete("cancelled", "AUTHENTICATION_BACKGROUND");
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == CREDENTIAL_REQUEST) complete(resultCode == Activity.RESULT_OK ? "success" : "cancelled",
            resultCode == Activity.RESULT_OK ? null : "CREDENTIAL_CANCELLED");
    }

    private void complete(String status, String code) {
        if (!terminal.finish(terminalToken)) return;
        handler.removeCallbacksAndMessages(null);
        // Finish the legacy child explicitly. A dismissed host alone can leave
        // an external credential activity pending in the task's back stack.
        try {
            if (legacyCredential) { finishActivity(CREDENTIAL_REQUEST); legacyCredential = false; }
            if (prompt != null && !"success".equals(status)) prompt.cancelAuthentication();
        } catch (Exception ignored) {
            // Token invalidation is already terminal; an OEM cancellation
            // exception must still return and finish this isolated host.
        }
        Intent result = new Intent().putExtra("operation", operation).putExtra("status", status).putExtra("code", code);
        if ("success".equals(status)) result.putExtra("authSucceededAtElapsedRealtimeMs", SystemClock.elapsedRealtime());
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    @Override protected void onDestroy() {
        complete("cancelled", "AUTHENTICATION_DESTROYED");
        SpendWiseAuthenticationActivity current = host.get();
        if (current == this) host.clear();
        super.onDestroy();
    }
}
