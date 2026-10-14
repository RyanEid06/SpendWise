package com.spendwise.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class NativeAuthenticationGateTest {
    @Test public void modernPrimaryUsesCombinedOnlyWhenSupportedAndCredentialActionStaysExplicit() {
        assertEquals(NativeAuthenticationGate.COMBINED, NativeAuthenticationGate.promptMode(30, true, true, true, false, 0));
        assertEquals(NativeAuthenticationGate.CREDENTIAL, NativeAuthenticationGate.promptMode(30, true, true, true, true, 0));
        assertEquals(NativeAuthenticationGate.BIOMETRIC, NativeAuthenticationGate.promptMode(30, true, true, false, false, 0));
        assertEquals(NativeAuthenticationGate.CREDENTIAL, NativeAuthenticationGate.promptMode(30, false, true, true, false, 0));
        assertEquals(NativeAuthenticationGate.UNAVAILABLE, NativeAuthenticationGate.promptMode(30, true, false, false, true, 60));
    }

    @Test public void legacyCredentialNeverWeakensImmediatePolicyOrUsesUnsupportedCombinedPrompt() {
        for (int api = 24; api <= 29; api++) {
            assertEquals(NativeAuthenticationGate.BIOMETRIC, NativeAuthenticationGate.promptMode(api, true, true, true, false, 60));
            assertEquals(NativeAuthenticationGate.LEGACY_CREDENTIAL, NativeAuthenticationGate.promptMode(api, true, true, true, true, 60));
            assertEquals(NativeAuthenticationGate.IMMEDIATE_UNSUPPORTED, NativeAuthenticationGate.promptMode(api, false, true, false, false, 0));
        }
    }

    @Test public void duplicateTerminalAndOutOfOrderCancelCannotSettleOrCancelNewerRequest() {
        NativeAuthenticationGate gate = new NativeAuthenticationGate();
        long first = gate.begin(60000);
        assertTrue(gate.finish(first));
        assertFalse(gate.finish(first));
        long second = gate.begin(60000);
        assertFalse(gate.cancel(first));
        assertTrue(gate.current(second, 0));
        assertTrue(gate.cancel(second));
        assertFalse(gate.finish(second));
    }

    @Test public void timedOutHostHasFiniteTerminalCleanupAndNeverAcceptsLateSuccess() {
        NativeAuthenticationGate gate = new NativeAuthenticationGate();
        long first = gate.begin(60000);
        gate.background(0);
        assertFalse(gate.current(first, 60000));
        assertTrue(gate.cancel(first));
        long second = gate.begin(60000);
        assertFalse(gate.current(first, 60001));
        assertFalse(gate.finish(first));
        assertTrue(gate.finish(second));
    }
    @Test public void promptLaunchRequiresResumedActivityAndUnsavedFragmentState() {
        assertFalse(NativeAuthenticationGate.canLaunchPrompt(false, false, false));
        assertFalse(NativeAuthenticationGate.canLaunchPrompt(true, true, false));
        assertFalse(NativeAuthenticationGate.canLaunchPrompt(true, false, true));
        assertTrue(NativeAuthenticationGate.canLaunchPrompt(true, false, false));
    }
    @Test public void serializesAndRejectsStaleCallbacks() {
        NativeAuthenticationGate gate = new NativeAuthenticationGate();
        long first = gate.begin(60000);
        assertTrue(first > 0);
        assertEquals(0, gate.begin(60000));
        gate.cancel();
        long second = gate.begin(60000);
        assertFalse(gate.current(first, 0));
        assertTrue(gate.current(second, 0));
        assertFalse(gate.finish(first));
        assertTrue(gate.finish(second));
        assertFalse(gate.current(second, 0));
    }

    @Test public void homeTimeoutAndScreenOffInvalidatePendingAuthentication() {
        NativeAuthenticationGate gate = new NativeAuthenticationGate();
        long session = gate.begin(60000);
        gate.background(1000);
        assertTrue(gate.current(session, 60999));
        assertFalse(gate.current(session, 61000));
        gate.cancel();
        session = gate.begin(0);
        gate.background(1000);
        assertFalse(gate.current(session, 1000));
        gate.cancel();
        session = gate.begin(60000);
        gate.cancel(); // Screen-off always invalidates, including credential challenges.
        assertFalse(gate.current(session, 1001));
    }

    @Test public void systemCredentialTransitionNeverBypassesImmediateLock() {
        NativeAuthenticationGate gate = new NativeAuthenticationGate();
        long session = gate.begin(0);
        gate.background(1000);
        assertFalse(gate.current(session, 1001));
        gate.cancel(); // A Home broadcast or screen-off still terminates this session.
        assertFalse(gate.current(session, 1002));
    }

    @Test public void credentialChallengeCannotReturnAfterConfiguredNonzeroTimeout() {
        NativeAuthenticationGate gate = new NativeAuthenticationGate();
        long session = gate.begin(60000);
        gate.background(1000);
        assertFalse(gate.current(session, 61000));
    }
}
