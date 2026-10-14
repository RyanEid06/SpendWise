# WP38-A authentication implementation evidence

Current integrated outcome: all required exact-source CI and independent private2.1.4/code14 APK checks passed at `732065e5455ca4de734d4982a662c2819fdd01af`; [final report](WP38_REPORT.md), [artifact receipt](WP38_PRIVATE_APK.md). Historical local/pending statements below describe their recorded checkpoint. The owner reported the tested 2.1.4 build all working on 2026-10-14 and authorized public publication; [public receipt](WP38_PUBLIC_RELEASE.md). Exhaustive device coverage and Render/live-provider verification remain separate and unverified.

## Confirmed source defects and limits

The old plugin left `pendingCredentialCall`/`pendingCredentialToken` and cancellation quarantine outside terminal cleanup. A missing cancellation callback could therefore make later requests permanently busy. Its Android 11+ primary prompt used a separate negative-button credential prompt instead of the supported combined authenticator set. `LockScreen` awaited an unbounded callback; the session service held one boolean while that callback was pending. Clearing React busy alone would leave the underlying service blocked and its late result valid.

Pinned AndroidX **1.1.0** source was inspected from Google's Maven source JAR (ignored evidence under `artifacts/wp38`). Both public Activity and Fragment constructors use the **Activity** ViewModel; a new Fragment does not isolate callbacks. Therefore a cancellation timer that only clears a marker, then creates a new prompt on the same Activity, cannot guarantee an old platform callback will not reach the new callback. This justified one private internal `SpendWiseAuthenticationActivity` per operation. It is implementation plumbing for the existing authentication flow. No cryptographic format, alias, validity period, data migration policy or key replacement behavior changed.

The exact owner's phone failure remains **unverified without physical reproduction/logcat**. Source defects are proven; OEM callback behavior is not inferred from local mocks.

## Changes

- `SpendWiseAuthenticationActivity.java` owns exactly one AndroidX callback/ViewModel per attempt. API30+ uses capability-checked strong biometric plus device credential for primary, and credential-only for an explicit credential action. Combined/credential prompts never supply a negative button. API24–29 keeps the legacy Keyguard activity for positive timeouts, explicitly finishes that child on cancellation, and rejects credential-only at immediate lock. A prompt revision rejects duplicate/out-of-order biometric callbacks when switching to legacy credentials.
- The host is non-exported, uses `FLAG_SECURE`, rejects saved-state recreation, cancels on Back/user departure and has a 60-second terminal watchdog. Cancellation invalidates the token and closes the isolated host even if AndroidX never acknowledges. A canceled host scheduled but not yet created rejects itself using a monotonic operation cancellation watermark. Old host destruction cannot clear a newer host reference.
- `SpendWiseSecurityPlugin.java` owns the original Capacitor call and protected operation. Before touching pending markers, host results must match the active call, session token and operation ID. Every accepted terminal path clears all markers and the gate; late/duplicate results are ignored. The plugin watchdog cancels after 62 seconds independently of a missing host result. Cancellation acknowledgment follows token invalidation and host cancellation. Success still runs the actual existing AES-GCM Keystore encrypt/decrypt verification before resolving. The OS callback timestamp is carried through the host result rather than reset at plugin return.
- The internal host transition has an explicit lifecycle classification, including immediate lock; actual departure still cancels authentication through host departure and the existing screen-off/Home/Recents receiver. The host contains no financial screen. API30 credential-transition lifecycle behavior needs phone validation.
- `SecureSessionService.ts` invalidates the session revision and key-service secret generation **before** awaiting cancellation. It retains ownership until native acknowledgment, bounds cancellation at five seconds, and allows a later explicit attempt to retry failed cancellation. Ownership uses an identity so old `finally` cannot clear a newer attempt. Stale results cannot relock a newly successful session or clear its secret cache. `lock()` coordinates this same acknowledgment for a hung sensitive operation.
- `SecureKeyService.ts` checks its captured generation after asynchronous key-status lookup, preventing a canceled operation from launching a late prompt.
- `SecurityLifecycleCoordinator.ts` bounds a foreground operation at 65 seconds and waits for safe session/native cancellation before returning a recoverable result. A foreground-queued auto attempt remains queued while backgrounded, preserving existing behavior. `LockScreen.tsx` guards disposed/stale presentation writes and owns its busy release by request identity.
- Native logs use fixed outcome categories and local attempt numbers. They omit Android error strings, credential contents, device identifiers, finance data, keys and cryptographic material.

## Verification

Focused TypeScript command:

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/wp28-secure-auth-keystore.test.ts tests/wp37-auth.test.ts tests/wp37-auth-startup.test.ts tests/wp38-auth-recovery.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

The first five new recovery regressions were observed red before their corresponding implementation: absent recovery API (three), key-status lookup launching a stale prompt (one), and inability to retry cancellation after temporary bridge failure (one). They now pass using the real session and key services with only OS/Keystore transport mocked. A sixth regression covers background locking while a sensitive native operation remains hung. Focused latest result: **48 tests pass**, TypeScript compilation passes.

Native gate command:

```powershell
javac -cp "artifacts/wp38/junit-4.13.2.jar;artifacts/wp38/hamcrest-core-1.3.jar" -d artifacts/wp38/native-classes android/app/src/main/java/com/spendwise/app/NativeAuthenticationGate.java android/app/src/test/java/com/spendwise/app/NativeAuthenticationGateTest.java
java -cp "artifacts/wp38/native-classes;artifacts/wp38/junit-4.13.2.jar;artifacts/wp38/hamcrest-core-1.3.jar" org.junit.runner.JUnitCore com.spendwise.app.NativeAuthenticationGateTest
```

New native tests first failed compilation on the absent mode-selection/token-scoped cancellation API. The executable gate suite then returned **OK (9 tests)**, including existing tests unchanged and four new tests for API mode selection, legacy immediate rejection, duplicate/out-of-order terminals and finite cancel/timeout cleanup. The restricted shell's javac additionally reported a JDK ZIP filesystem `AccessDeniedException` while closing JARs; the parent reran in normal Windows context and confirmed **javac exit 0; JUnit OK (9 tests)**. Pure JVM tests prove the gate and mode policy, **not actual Android UI callback delivery**.

`tests/e2e/components/wp38-auth-recovery.spec.ts` uses Playwright's clock and the real LockScreen/coordinator/session/key-service chain. It checks that a hung call stays disabled until cancellation acknowledgment, then allows retry, ignores late old success without priming storage, keeps a newer attempt busy and finally permits protected secret loading for the new successful attempt. The parent confirmed the focused browser auth/Arabic/WP37 foreground group **8/8 passed**, including this recovery test.

Existing source contract tests were updated to read the new native host alongside the plugin and to refer to the moved native mode policy. Existing AES-GCM/alias/Keystore/FLAG_SECURE/key-invalidated and legacy credential assertions remain. Native mode behavior is additionally executable in the JVM gate suite. Parent WP38-B owns the Arabic `lockText` source-contract adjustment and browser copy/layout checks.

## Outstanding acceptance

Local Android SDK is unavailable at the configured path; Android compile/unit/instrumented encrypted-recovery gates must run in CI. No physical PIN/pattern/password, API24–29 device, canceled legacy child, Activity recreation, or in-place signed upgrade result is claimed here. In particular, validate `onUserLeaveHint` on the owner's OEM during the Android 11+ system credential switch, and validate Home/Recents/screen-off with the platform prompt over the private host. Any credential dismissal without protected-key verification or any post-cancel unlock is a release blocker.

Parent report owns immutable-head CI, complete regression results, signed private APK identity, physical acceptance and release recommendation. This lane made no commit/push, version/workflow change, merge, tag, publication, Render change or data deletion.

## Review correction: preserve the existing secure prompt backdrop

Independent review of `54085c2` identified a presentation regression: the private authentication host selected `AppTheme`, whose parent is `Theme.AppCompat.Light.DarkActionBar`. An Activity with no content therefore put light native decor and an action bar over the existing lock card, including in dark mode. Source inspection confirmed the manifest/theme inheritance before changing it.

The host now selects `AppTheme.AuthenticationHost`, inheriting the existing `AppTheme.NoActionBar`. It explicitly disables both native/AppCompat action bars and titles, uses a transparent translucent non-floating window, and disables its own dimming and starting preview. The OS authentication prompt controls its own dimming. Day/night system-bar styling continues through the existing parent theme. This is a full-size Activity using normal input/focus defaults; no touch-through, `showWhenLocked`, `turnScreenOn` or keyguard-dismiss flags were added. The existing runtime `FLAG_SECURE` remains.

The backdrop is the same already-rendered secure surface used by the existing OS biometric prompt: a lock card while locked, or the already-authorized settings/other sensitive screen while requesting fresh authentication. Translucency itself does not authorize storage access or render a new screen. Native result tokens, protected-key verification, session revisions, privacy shields and cancellation policies are unchanged.

Lifecycle implication: the Main Activity can remain **STARTED/paused** underneath a translucent host rather than receiving `onStop` solely because the host opened. Inspection of the installed Capacitor source confirms `appStateChange(false)` originates at Main `onStop`, while `appStateChange(true)` is emitted on resume. Therefore the internal transition need not trigger a synthetic background/privacy overlay that would hide the intended card. Real Home/screen-off still stops the app; the existing host user-departure callback, plugin departure receiver and session/cancellation gates remain responsible for cancellation. Returning focus still resumes Main. OEM/system credential transitions and actual window rendering require device/emulator validation; a resource audit cannot certify those callbacks.

Verification added:

```powershell
& ./scripts/wp38/audit-auth-host-theme.ps1
node node_modules/tsx/dist/cli.mjs --test tests/wp33-5-01-branding-auth.test.ts tests/wp37-auth.test.ts tests/wp37-auth-startup.test.ts tests/wp38-auth-recovery.test.ts
```

The executable XML audit resolves the manifest-selected local style inheritance through day/night and API24/API27 qualifiers. It first failed on the original `AppTheme` (`android:windowDisablePreview` missing; the original theme also lacked the required transparent/no-action-bar host contract). After the change it passed **four qualifier configurations plus the privacy/input/keyguard source/manifest guard**. Focused existing/authentication regressions passed **41/41**, and `git diff --check` passed.

`AuthenticationHostThemeTest` was added to Android instrumentation. It resolves the **compiled manifest-selected theme** with `ContextThemeWrapper` and `TypedArray` in day/night contexts, asserting the host is private, no-action-bar/no-title, translucent, non-floating, transparent, without added dimming or preview. It does not launch an authentication prompt or require enrolled credentials. Parent CI wires the exact class `com.spendwise.app.AuthenticationHostThemeTest`; local execution remains unavailable without the Android SDK. No existing test assertion was removed or relaxed for this correction.

## CI correction: lifecycle-aware Back and predictive gestures

Immutable `a626ecc` exposed two real Android lint errors in API36 job `115725139476` of combined run `38525612398`: **MissingSuperCall** and **GestureBackNavigation**, both on the private host's deprecated `Activity.onBackPressed` override. The retained evidence is `artifacts/wp38/ci-a626-native/reports/lint-results-debug.xml` (first two issues). Target36 predictive gestures can bypass that override; adding a super call would also risk bypassing the intended terminal cleanup. These CI failures are the authoritative red baseline.

`SpendWiseAuthenticationActivity.onCreate` now registers an enabled `OnBackPressedCallback` with `getOnBackPressedDispatcher().addCallback(this, ...)`. The Activity lifecycle owns registration/removal, and AndroidX handles both compatible button Back and predictive gesture dispatch. The callback invokes the existing `complete("cancelled", "AUTHENTICATION_CANCELLED")` terminal path. The deprecated override and its deprecation annotation were removed. Existing OS biometric/credential callbacks, token gates, finite deadlines, theme, encryption verification and data behavior are unchanged. No lint suppression, assertion relaxation or timeout change was introduced.

The already-wired `AuthenticationHostThemeTest` instrumentation class gained `backDispatcherCancelsHostBeforePromptAndDetachesOnDestroy`. It observes the real host after creation and dispatches Back at STARTED, after the production lifecycle-bound callback becomes active and before `onPostResume` can open an OS prompt. It checks immediate finishing, duplicate Back remaining terminal, and removal of enabled callbacks on destruction. This uses AndroidX test lifecycle observation only, with **no test-only production hook or abstraction**, and needs no enrolled credential. It exercises the actual Activity dispatcher/cancellation wiring; physical predictive gesture delivery through an OS prompt remains device acceptance.

Post-fix local checks: focused authentication/branding/startup suite **41/41 passed**; TypeScript compilation passed; existing native gate suite **JUnit OK (9 tests)**; all **four** effective theme/resource contexts and privacy/input/keyguard audit passed; `git diff --check` passed. Android lint and the new instrumentation method require the next CI head; they are not claimed locally green without the SDK. The separate native acceptance failure was classified by the parent as infrastructure (`GMS FontsProvider` process death); this correction does not change acceptance code or gates.
