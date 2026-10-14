package com.spendwise.app;

/** Monotonic, session-bound guard. Contains no Android UI or key material. */
final class NativeAuthenticationGate {
    static final int UNAVAILABLE = 0, BIOMETRIC = 1, CREDENTIAL = 2, COMBINED = 3,
        LEGACY_CREDENTIAL = 4, IMMEDIATE_UNSUPPORTED = 5;

    static int promptMode(int api, boolean strong, boolean credential, boolean combined, boolean explicitCredential, int timeout) {
        if (explicitCredential || !strong) {
            if (!credential) return UNAVAILABLE;
            if (api >= 30) return CREDENTIAL;
            return timeout > 0 ? LEGACY_CREDENTIAL : IMMEDIATE_UNSUPPORTED;
        }
        return api >= 30 && credential && combined ? COMBINED : BIOMETRIC;
    }
    static boolean canLaunchPrompt(boolean resumed, boolean fragmentStateSaved, boolean destroyed) {
        return resumed && !fragmentStateSaved && !destroyed;
    }
    private long serial = 0;
    private long active = 0;
    private long backgroundedAt = -1;
    private long timeoutMs = 0;

    synchronized long begin(long timeout) {
        if (active != 0) return 0;
        active = ++serial;
        timeoutMs = Math.max(0, timeout);
        backgroundedAt = -1;
        return active;
    }

    synchronized void background(long now) {
        if (active == 0) return;
        backgroundedAt = now;
    }

    synchronized boolean current(long token, long now) {
        if (token == 0 || token != active) return false;
        if (backgroundedAt < 0) return true;
        return now - backgroundedAt < timeoutMs;
    }

    synchronized void foreground() {
        backgroundedAt = -1;
    }

    synchronized boolean finish(long token) {
        if (token == 0 || token != active) return false;
        active = 0;
        backgroundedAt = -1;
        return true;
    }

    synchronized void cancel() {
        active = 0;
        backgroundedAt = -1;
    }

    synchronized boolean cancel(long token) {
        return finish(token);
    }
}
