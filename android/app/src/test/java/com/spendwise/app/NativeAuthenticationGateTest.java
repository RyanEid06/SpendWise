package com.spendwise.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class NativeAuthenticationGateTest {
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
