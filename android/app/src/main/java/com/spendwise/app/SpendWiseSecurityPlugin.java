package com.spendwise.app;

import android.app.KeyguardManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.security.keystore.UserNotAuthenticatedException;
import android.util.Base64;
import android.view.WindowManager;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.UnrecoverableKeyException;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.concurrent.Executor;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SpendWiseSecurity")
public class SpendWiseSecurityPlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS_PREFIX = "spendwise.local-kek.v";
    private static final String WRAP_FORMAT = "spendwise-wrap-v1";
    private static final String INSTALLATION_IDENTITY_ALIAS =
        "spendwise.installation-identity.v1";
    private static final int GCM_TAG_BITS = 128;
    private static final int AUTH_VALIDITY_SECONDS = 5;

    private interface AuthSuccess {
        void run();
    }

    private String aliasFor(int version) {
        return ALIAS_PREFIX + version;
    }

    private int requiredVersion(PluginCall call) {
        Integer version = call.getInt("keyVersion");
        if (version == null || version < 1 || version > 1000) {
            call.reject("Invalid key version.", "INVALID_KEY_VERSION");
            return -1;
        }
        return version;
    }

    private boolean authRequired(PluginCall call) {
        Boolean value = call.getBoolean("authenticationRequired");
        return value != null && value;
    }

    private JSObject keyResult(
        String status,
        String alias,
        int keyVersion,
        boolean authenticationRequired,
        String code
    ) {
        JSObject result = new JSObject();
        result.put("status", status);
        result.put("alias", alias);
        result.put("keyVersion", keyVersion);
        result.put("authenticationRequired", authenticationRequired);
        if (code != null) result.put("code", code);
        return result;
    }

    private JSObject authResult(String status, String code, String message) {
        JSObject result = new JSObject();
        result.put("status", status);
        if (code != null) result.put("code", code);
        if (message != null) result.put("message", message);
        return result;
    }

    private KeyStore loadKeyStore() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        return keyStore;
    }

    private SecretKey loadSecretKey(String alias) throws Exception {
        KeyStore keyStore = loadKeyStore();
        if (!keyStore.containsAlias(alias)) return null;
        return (SecretKey) keyStore.getKey(alias, null);
    }

    private String inspectKeyStatus(String alias) {
        try {
            SecretKey key = loadSecretKey(alias);
            if (key == null) return "missing";
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, key);
                return "present";
            } catch (UserNotAuthenticatedException expected) {
                return "present";
            } catch (KeyPermanentlyInvalidatedException invalidated) {
                return "invalidated";
            }
        } catch (UnrecoverableKeyException unrecoverable) {
            return "unrecoverable";
        } catch (Exception error) {
            return "error";
        }
    }

    private boolean deviceCredentialAvailable() {
        KeyguardManager manager =
            (KeyguardManager) getContext().getSystemService(android.content.Context.KEYGUARD_SERVICE);
        return manager != null && manager.isDeviceSecure();
    }

    private boolean strongBiometricAvailable() {
        try {
            return BiometricManager.from(getContext()).canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
            ) == BiometricManager.BIOMETRIC_SUCCESS;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean canAuthenticate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                return BiometricManager.from(getContext()).canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                ) == BiometricManager.BIOMETRIC_SUCCESS;
            } catch (Exception ignored) {
                return strongBiometricAvailable() || deviceCredentialAvailable();
            }
        }
        return strongBiometricAvailable() || deviceCredentialAvailable();
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("canAuthenticate", canAuthenticate());
        result.put("biometricStrongAvailable", strongBiometricAvailable());
        result.put("deviceCredentialAvailable", deviceCredentialAvailable());
        result.put(
            "combinedAuthenticatorsSupported",
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
        );
        call.resolve(result);
    }

    private void promptForAuthentication(
        PluginCall call,
        String title,
        String reason,
        AuthSuccess success
    ) {
        if (!canAuthenticate()) {
            call.resolve(
                authResult(
                    "unavailable",
                    "SECURE_DEVICE_CREDENTIAL_UNAVAILABLE",
                    "Set a secure Android screen lock or strong biometric and try again."
                )
            );
            return;
        }

        getActivity().runOnUiThread(() -> {
            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt prompt = new BiometricPrompt(
                (FragmentActivity) getActivity(),
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(
                        int errorCode,
                        CharSequence errorString
                    ) {
                        super.onAuthenticationError(errorCode, errorString);
                        boolean cancelled =
                            errorCode == BiometricPrompt.ERROR_USER_CANCELED
                                || errorCode == BiometricPrompt.ERROR_CANCELED
                                || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON;
                        call.resolve(
                            authResult(
                                cancelled ? "cancelled" : "error",
                                "BIOMETRIC_" + errorCode,
                                errorString == null ? null : errorString.toString()
                            )
                        );
                    }

                    @Override
                    public void onAuthenticationSucceeded(
                        BiometricPrompt.AuthenticationResult result
                    ) {
                        super.onAuthenticationSucceeded(result);
                        success.run();
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        // The system prompt remains open. Do not resolve the call or count
                        // a transient biometric mismatch as an application-level unlock.
                    }
                }
            );

            BiometricPrompt.PromptInfo.Builder builder =
                new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title == null || title.isEmpty() ? "SpendWise" : title)
                    .setSubtitle(
                        reason == null || reason.isEmpty()
                            ? "Authenticate to continue"
                            : reason
                    )
                    .setConfirmationRequired(false);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                builder.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                );
            } else {
                builder.setDeviceCredentialAllowed(true);
            }

            prompt.authenticate(builder.build());
        });
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        promptForAuthentication(
            call,
            call.getString("title", "SpendWise"),
            call.getString("reason", "Authenticate to continue"),
            () -> call.resolve(authResult("success", null, null))
        );
    }

    @PluginMethod
    public void ensureKey(PluginCall call) {
        int version = requiredVersion(call);
        if (version < 0) return;
        boolean requireAuthentication = authRequired(call);
        String alias = aliasFor(version);

        String existing = inspectKeyStatus(alias);
        if (!"missing".equals(existing)) {
            call.resolve(
                keyResult(existing, alias, version, requireAuthentication, null)
            );
            return;
        }

        if (requireAuthentication && !canAuthenticate()) {
            call.resolve(
                keyResult(
                    "unavailable",
                    alias,
                    version,
                    true,
                    "SECURE_DEVICE_CREDENTIAL_UNAVAILABLE"
                )
            );
            return;
        }

        try {
            KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                KEYSTORE
            );
            KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true);

            if (requireAuthentication) {
                builder.setUserAuthenticationRequired(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    builder.setUserAuthenticationParameters(
                        AUTH_VALIDITY_SECONDS,
                        KeyProperties.AUTH_BIOMETRIC_STRONG
                            | KeyProperties.AUTH_DEVICE_CREDENTIAL
                    );
                } else {
                    builder.setUserAuthenticationValidityDurationSeconds(
                        AUTH_VALIDITY_SECONDS
                    );
                }
            }

            generator.init(builder.build());
            generator.generateKey();
            call.resolve(
                keyResult("present", alias, version, requireAuthentication, null)
            );
        } catch (Exception error) {
            call.resolve(
                keyResult(
                    "error",
                    alias,
                    version,
                    requireAuthentication,
                    "KEY_GENERATION_FAILED"
                )
            );
        }
    }

    @PluginMethod
    public void getKeyStatus(PluginCall call) {
        int version = requiredVersion(call);
        if (version < 0) return;
        boolean requireAuthentication = authRequired(call);
        String alias = aliasFor(version);
        call.resolve(
            keyResult(
                inspectKeyStatus(alias),
                alias,
                version,
                requireAuthentication,
                null
            )
        );
    }

    private void verifyKeyNow(
        PluginCall call,
        int version,
        boolean requireAuthentication
    ) {
        String alias = aliasFor(version);
        byte[] clear = "spendwise-key-check-v1".getBytes(StandardCharsets.UTF_8);
        try {
            SecretKey key = loadSecretKey(alias);
            if (key == null) {
                JSObject result = authResult("error", "KEY_MISSING", null);
                result.put("keyStatus", "missing");
                call.resolve(result);
                return;
            }

            Cipher encrypt = Cipher.getInstance("AES/GCM/NoPadding");
            encrypt.init(Cipher.ENCRYPT_MODE, key);
            encrypt.updateAAD("spendwise-key-check-aad-v1".getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = encrypt.doFinal(clear);
            byte[] nonce = encrypt.getIV();

            Cipher decrypt = Cipher.getInstance("AES/GCM/NoPadding");
            decrypt.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(GCM_TAG_BITS, nonce)
            );
            decrypt.updateAAD("spendwise-key-check-aad-v1".getBytes(StandardCharsets.UTF_8));
            byte[] roundTrip = decrypt.doFinal(ciphertext);
            boolean verified = MessageDigest.isEqual(clear, roundTrip);
            Arrays.fill(roundTrip, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);

            if (!verified) {
                call.resolve(authResult("error", "KEY_VERIFICATION_FAILED", null));
                return;
            }
            call.resolve(authResult("success", null, null));
        } catch (UserNotAuthenticatedException error) {
            JSObject result = authResult(
                "error",
                "USER_NOT_AUTHENTICATED",
                "Authentication expired before the protected key operation completed."
            );
            result.put("keyStatus", "present");
            call.resolve(result);
        } catch (KeyPermanentlyInvalidatedException error) {
            JSObject result = authResult("error", "KEY_INVALIDATED", null);
            result.put("keyStatus", "invalidated");
            call.resolve(result);
        } catch (UnrecoverableKeyException error) {
            JSObject result = authResult("error", "KEY_UNRECOVERABLE", null);
            result.put("keyStatus", "unrecoverable");
            call.resolve(result);
        } catch (Exception error) {
            JSObject result = authResult("error", "KEY_VERIFICATION_FAILED", null);
            result.put("keyStatus", inspectKeyStatus(alias));
            call.resolve(result);
        } finally {
            Arrays.fill(clear, (byte) 0);
        }
    }

    @PluginMethod
    public void verifyKey(PluginCall call) {
        int version = requiredVersion(call);
        if (version < 0) return;
        boolean requireAuthentication = authRequired(call);
        String status = inspectKeyStatus(aliasFor(version));
        if (!"present".equals(status)) {
            JSObject result = authResult("error", "KEY_" + status.toUpperCase(), null);
            result.put("keyStatus", status);
            call.resolve(result);
            return;
        }

        if (!requireAuthentication) {
            verifyKeyNow(call, version, false);
            return;
        }

        promptForAuthentication(
            call,
            call.getString("title", "Unlock SpendWise"),
            call.getString("reason", "Authenticate to continue"),
            () -> verifyKeyNow(call, version, true)
        );
    }

    private byte[] aadFor(String purpose, int version, String alias) {
        return (
            "spendwise|wrap-v1|" + purpose + "|" + version + "|" + alias
        ).getBytes(StandardCharsets.UTF_8);
    }

    private JSObject wrapBytes(
        byte[] secret,
        String purpose,
        int version,
        boolean requireAuthentication
    ) throws Exception {
        String alias = aliasFor(version);
        SecretKey key = loadSecretKey(alias);
        if (key == null) throw new IllegalStateException("KEY_MISSING");

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        cipher.updateAAD(aadFor(purpose, version, alias));
        byte[] ciphertext = cipher.doFinal(secret);

        JSObject wrapped = new JSObject();
        wrapped.put("format", WRAP_FORMAT);
        wrapped.put("keyVersion", version);
        wrapped.put("alias", alias);
        wrapped.put("purpose", purpose);
        wrapped.put(
            "nonceBase64",
            Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
        );
        wrapped.put(
            "ciphertextBase64",
            Base64.encodeToString(ciphertext, Base64.NO_WRAP)
        );
        Arrays.fill(ciphertext, (byte) 0);
        return wrapped;
    }

    private byte[] unwrapBytes(JSObject wrapped) throws Exception {
        String format = wrapped.getString("format");
        String purpose = wrapped.getString("purpose");
        String alias = wrapped.getString("alias");
        Integer version = wrapped.getInteger("keyVersion");
        String nonceBase64 = wrapped.getString("nonceBase64");
        String ciphertextBase64 = wrapped.getString("ciphertextBase64");

        if (
            !WRAP_FORMAT.equals(format)
                || purpose == null
                || alias == null
                || version == null
                || !alias.equals(aliasFor(version))
                || nonceBase64 == null
                || ciphertextBase64 == null
        ) {
            throw new IllegalArgumentException("INVALID_WRAPPED_SECRET");
        }

        SecretKey key = loadSecretKey(alias);
        if (key == null) throw new IllegalStateException("KEY_MISSING");

        byte[] nonce = Base64.decode(nonceBase64, Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(ciphertextBase64, Base64.NO_WRAP);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(GCM_TAG_BITS, nonce)
            );
            cipher.updateAAD(aadFor(purpose, version, alias));
            return cipher.doFinal(ciphertext);
        } finally {
            Arrays.fill(nonce, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
        }
    }

    private void wrapCallNow(
        PluginCall call,
        int version,
        boolean requireAuthentication,
        String purpose,
        byte[] secret
    ) {
        try {
            JSObject result = authResult("success", null, null);
            result.put(
                "wrapped",
                wrapBytes(secret, purpose, version, requireAuthentication)
            );
            call.resolve(result);
        } catch (UserNotAuthenticatedException error) {
            JSObject result = authResult("error", "USER_NOT_AUTHENTICATED", null);
            result.put("keyStatus", "present");
            call.resolve(result);
        } catch (KeyPermanentlyInvalidatedException error) {
            JSObject result = authResult("error", "KEY_INVALIDATED", null);
            result.put("keyStatus", "invalidated");
            call.resolve(result);
        } catch (Exception error) {
            JSObject result = authResult("error", "SECRET_WRAP_FAILED", null);
            result.put("keyStatus", inspectKeyStatus(aliasFor(version)));
            call.resolve(result);
        } finally {
            Arrays.fill(secret, (byte) 0);
        }
    }

    @PluginMethod
    public void generateWrappedSecret(PluginCall call) {
        int version = requiredVersion(call);
        if (version < 0) return;
        boolean requireAuthentication = authRequired(call);
        String purpose = call.getString("purpose");
        Integer byteLength = call.getInt("byteLength");
        if (
            purpose == null
                || !purpose.matches("^[A-Za-z0-9._-]{1,80}$")
                || byteLength == null
                || byteLength < 16
                || byteLength > 64
        ) {
            call.reject("Invalid protected-secret parameters.", "INVALID_SECRET_PARAMETERS");
            return;
        }

        Runnable action = () -> {
            byte[] secret = new byte[byteLength];
            new SecureRandom().nextBytes(secret);
            wrapCallNow(call, version, requireAuthentication, purpose, secret);
        };

        Boolean authenticate = call.getBoolean("authenticate");
        if (requireAuthentication && (authenticate == null || authenticate)) {
            promptForAuthentication(
                call,
                call.getString("title", "Unlock SpendWise"),
                call.getString("reason", "Protect local SpendWise data"),
                action::run
            );
        } else {
            action.run();
        }
    }

    @PluginMethod
    public void wrapSecret(PluginCall call) {
        int version = requiredVersion(call);
        if (version < 0) return;
        boolean requireAuthentication = authRequired(call);
        String purpose = call.getString("purpose");
        String secretBase64 = call.getString("secretBase64");
        if (
            purpose == null
                || !purpose.matches("^[A-Za-z0-9._-]{1,80}$")
                || secretBase64 == null
        ) {
            call.reject("Invalid protected-secret parameters.", "INVALID_SECRET_PARAMETERS");
            return;
        }

        byte[] secret;
        try {
            secret = Base64.decode(secretBase64, Base64.NO_WRAP);
        } catch (Exception error) {
            call.reject("Invalid protected-secret encoding.", "INVALID_SECRET_ENCODING");
            return;
        }

        Runnable action =
            () -> wrapCallNow(call, version, requireAuthentication, purpose, secret);
        Boolean authenticate = call.getBoolean("authenticate");
        if (requireAuthentication && (authenticate == null || authenticate)) {
            promptForAuthentication(
                call,
                call.getString("title", "Unlock SpendWise"),
                call.getString("reason", "Protect local SpendWise data"),
                action::run
            );
        } else {
            action.run();
        }
    }

    private void unwrapCallNow(PluginCall call, JSObject wrapped) {
        String alias = wrapped.getString("alias");
        try {
            byte[] secret = unwrapBytes(wrapped);
            JSObject result = authResult("success", null, null);
            result.put(
                "secretBase64",
                Base64.encodeToString(secret, Base64.NO_WRAP)
            );
            Arrays.fill(secret, (byte) 0);
            call.resolve(result);
        } catch (AEADBadTagException error) {
            JSObject result = authResult("error", "WRAPPED_SECRET_TAMPERED", null);
            result.put("keyStatus", "present");
            call.resolve(result);
        } catch (UserNotAuthenticatedException error) {
            JSObject result = authResult("error", "USER_NOT_AUTHENTICATED", null);
            result.put("keyStatus", "present");
            call.resolve(result);
        } catch (KeyPermanentlyInvalidatedException error) {
            JSObject result = authResult("error", "KEY_INVALIDATED", null);
            result.put("keyStatus", "invalidated");
            call.resolve(result);
        } catch (UnrecoverableKeyException error) {
            JSObject result = authResult("error", "KEY_UNRECOVERABLE", null);
            result.put("keyStatus", "unrecoverable");
            call.resolve(result);
        } catch (Exception error) {
            JSObject result = authResult("error", "SECRET_UNWRAP_FAILED", null);
            result.put(
                "keyStatus",
                alias == null ? "error" : inspectKeyStatus(alias)
            );
            call.resolve(result);
        }
    }

    @PluginMethod
    public void unwrapSecret(PluginCall call) {
        JSObject wrapped = call.getObject("wrapped");
        boolean requireAuthentication = authRequired(call);
        if (wrapped == null) {
            call.reject("Wrapped secret is required.", "INVALID_WRAPPED_SECRET");
            return;
        }

        Runnable action = () -> unwrapCallNow(call, wrapped);
        Boolean authenticate = call.getBoolean("authenticate");
        if (requireAuthentication && (authenticate == null || authenticate)) {
            promptForAuthentication(
                call,
                call.getString("title", "Unlock SpendWise"),
                call.getString("reason", "Open protected local data"),
                action::run
            );
        } else {
            action.run();
        }
    }

    @PluginMethod
    public void deleteKey(PluginCall call) {
        int version = requiredVersion(call);
        if (version < 0) return;
        boolean deleted = false;
        try {
            KeyStore keyStore = loadKeyStore();
            String alias = aliasFor(version);
            if (keyStore.containsAlias(alias)) {
                keyStore.deleteEntry(alias);
                deleted = true;
            }
        } catch (Exception ignored) {
            deleted = false;
        }
        JSObject result = new JSObject();
        result.put("deleted", deleted);
        call.resolve(result);
    }

    private KeyPair ensureInstallationKeyPair() throws Exception {
        KeyStore keyStore = loadKeyStore();
        if (keyStore.containsAlias(INSTALLATION_IDENTITY_ALIAS)) {
            KeyStore.PrivateKeyEntry entry = (KeyStore.PrivateKeyEntry) keyStore.getEntry(
                INSTALLATION_IDENTITY_ALIAS,
                null
            );
            if (entry == null || entry.getPrivateKey() == null || entry.getCertificate() == null) {
                throw new IllegalStateException("Installation identity is unavailable.");
            }
            return new KeyPair(
                entry.getCertificate().getPublicKey(),
                entry.getPrivateKey()
            );
        }

        KeyPairGenerator generator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            KEYSTORE
        );
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            INSTALLATION_IDENTITY_ALIAS,
            KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY
        )
            .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .build();
        generator.initialize(spec);
        return generator.generateKeyPair();
    }

    @PluginMethod
    public void ensureInstallationIdentity(PluginCall call) {
        try {
            KeyPair pair = ensureInstallationKeyPair();
            JSObject result = new JSObject();
            result.put("algorithm", "ECDSA_P256_SHA256");
            result.put(
                "publicKeyBase64",
                Base64.encodeToString(pair.getPublic().getEncoded(), Base64.NO_WRAP)
            );
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                "Installation identity is unavailable.",
                "INSTALLATION_IDENTITY_FAILED"
            );
        }
    }

    @PluginMethod
    public void signInstallationPayload(PluginCall call) {
        String payload = call.getString("payload");
        if (payload == null || payload.isEmpty() || payload.length() > 8192) {
            call.reject("Invalid signing payload.", "INVALID_SIGNING_PAYLOAD");
            return;
        }

        try {
            KeyPair pair = ensureInstallationKeyPair();
            Signature signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(pair.getPrivate());
            signer.update(payload.getBytes(StandardCharsets.UTF_8));
            JSObject result = new JSObject();
            result.put(
                "signatureBase64",
                Base64.encodeToString(signer.sign(), Base64.NO_WRAP)
            );
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                "Installation signing failed.",
                "INSTALLATION_SIGNING_FAILED"
            );
        }
    }

    @PluginMethod
    public void setPrivacyShield(PluginCall call) {
        Boolean enabledValue = call.getBoolean("enabled");
        boolean enabled = enabledValue != null && enabledValue;
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            } else {
                getActivity().getWindow().clearFlags(
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            }
            JSObject result = new JSObject();
            result.put("enabled", enabled);
            call.resolve(result);
        });
    }
}
