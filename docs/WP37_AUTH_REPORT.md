# WP37 native authentication and lifecycle report

> Historical domain implementation evidence. Final required CI, main deployment, private2.1.3/code13 delivery and owner-reported manual acceptance are recorded in [current status](STATUS.md) and [WP37 review](WP37_REVIEW.md).


Source stable on 2026-10-12. Branch: `fix/wp37-localization-native-auth-ux`. This report covers Task 1 and the coordinator-authorized bootstrap/lifecycle integration in `src/main.tsx` and `useAppLockLifecycle.ts`. Version/signing/deployment settings were not changed. No commit was created by the auth agent.

## Confirmed causes and preserved behavior

1. `SecureKeyService` sent the fixed English title `Unlock SpendWise` and sometimes the same reason. Other callsites passed English strings or internal sensitive-operation IDs. Twelve semantic actions now resolve to intentionally distinct EN/FR/AR title/reason and recovery copy at the Android adapter boundary. Security decisions use actions/outcomes, never translated strings. The selected stored app language is read without requiring database/bootstrap initialization.
2. The old `authenticating` Boolean only controlled Privacy Shield; it did not serialize operations or revoke callbacks. Rapid requests could run two protected operations, and a successful pending callback could set the session to unlocked after a foreground timeout had locked it. Session revision checks cover the entire async key operation and final shield reconciliation. A lock invalidates pending results, releases cached secrets and requests native cancellation. Native sessions separately use monotonic tokens, attempt IDs, terminal settlement and outstanding-prompt/activity guards.
3. Releasing secrets during an awaited verification could be followed by secret priming into the newly cleared cache. Key-operation generations now reject stale verification, priming, unwrap/generation and policy rotation results before exposing or activating protected material.
4. Missing/invalidated established keys could be recreated automatically when the wrapped-secret registry was empty, including during policy changes. Both establishment and rotation now fail closed regardless of registry emptiness. Completed migration with lost active-key metadata also fails closed. Failed verification deletes an alias only when the native result explicitly says this operation created it; existing aliases are preserved.
5. Native cancellation during legacy migration could still unlock through the legacy compatibility branch. Explicit cancellation now remains locked while preserving the old PIN. The existing migration-unavailable compatibility result remains pending and cannot open encrypted storage in bootstrap.
6. Bootstrap opened storage before AppShell mounted its lifecycle hook. One shared listener and event-time queue now spans bootstrap, storage opening and AppShell; startup waits for foreground and checks the session revision/state before and after storage initialization. A timeout during storage opening cannot render Home, even if storage initialization finishes later.
7. Migration issues were detected but displayed generic authentication failure. LockScreen now displays localized repair, migration-pending and protected-key messages without rendering internal codes. Retry/recovery controls appear after an attempt and do not automatically launch recovery.

Already correct and preserved: ordinary `onAuthenticationFailed` is nonterminal; Android manages repeated scan attempts. LockScreen automatic authentication remains one shot per presentation. Strong biometric, AES-GCM, Keystore-backed storage, five-second authentication validity, web PIN protection and `FLAG_SECURE` remain intact. Success still requires the protected verify/wrap/unwrap operation; a system authentication UI callback alone does not open data.

## Supported native routes and explicit limitation

| Android/API | Primary route with strong biometrics | Explicit/system credential route | Immediate App Lock (timeout 0) |
| --- | --- | --- | --- |
| API24–27 | AndroidX `BIOMETRIC_STRONG` | OS `createConfirmDeviceCredentialIntent` for a positive configured timeout | Strong biometric route; external credential recovery unsupported and fails closed before launch |
| API28–29 | AndroidX `BIOMETRIC_STRONG` | OS confirmation activity; no unsupported AndroidX strong+credential or credential-only combination | Same fail-closed external-credential limit |
| API30+ | AndroidX `BIOMETRIC_STRONG` | Explicit AndroidX `DEVICE_CREDENTIAL` prompt | Supported API route; actual OEM/Keystore acceptance pending |

On legacy APIs the confirmation activity may itself offer biometrics. It is OS-owned credential recovery, not a claim that AndroidX credential-only authentication works before API30. All PIN/pattern/password input belongs to Android.

The primary route goes directly to OS credential confirmation when no usable strong biometric exists and that route is supported. A supported native negative button explicitly requests phone credentials. Cancel/Back/user-cancel, ordinary mismatches, hardware errors and lockout never automatically launch a new credential prompt. Temporary/permanent lockout have typed outcomes and localized recovery copy.

External credential confirmation necessarily stops the calling activity. Public legacy APIs cannot reliably distinguish that system-owned interval from Home while the credential activity covers the app. Accordingly there is **no immediate-lock exemption**. API24–29 timeout0 rejects credential primary/recovery before launching, hides the unsupported recovery control, and explains the limitation in EN/FR/AR. The service also refuses to newly configure timeout0 on a legacy credential-only device. Existing users already in that unsupported combination remain fail closed; no timeout is changed automatically and no recovery/reset of financial data is attempted.

For positive timeouts, the native gate counts the external activity's entire stopped interval using `elapsedRealtime`; callback/resume after the deadline is rejected. API30+ credential prompts do not use the legacy external-activity flag. Screen-off cancels an active prompt, and Home/Recents broadcasts are supplemental cancellation signals only. The deprecated/undocumented Home reason is not the timeout authority. Without those broadcasts, the stopped-interval deadline and resume/callback checks still enforce the configured timeout.

Official API references checked this turn:

- [Android biometric authentication guidance](https://developer.android.com/identity/sign-in/biometric-auth): unsupported authenticator combinations on older Android releases.
- [KeyguardManager confirmation intent](https://developer.android.com/reference/android/app/KeyguardManager#createConfirmDeviceCredentialIntent(java.lang.CharSequence,%20java.lang.CharSequence)): system confirmation activity, possible biometric presentation, API29 deprecation.
- [ACTION_CLOSE_SYSTEM_DIALOGS](https://developer.android.com/reference/android/content/Intent#ACTION_CLOSE_SYSTEM_DIALOGS): deprecated API31; supplemental signal only.
- [AndroidX PromptInfo.Builder](https://developer.android.com/reference/androidx/biometric/BiometricPrompt.PromptInfo.Builder): credential-only unsupported before API30 and strong+credential unsupported on API28–29 in the pinned biometric API.

## Sensitive boundaries and integration

Owned authentication callsites were migrated for unlock, enable/disable lock, security configuration, replace restore, clear data, readable export, legacy upgrade/repair, opening/protecting local data and key rotation. `SensitiveAuthenticationReason` retains existing IDs as semantic action keys; they never become native UI text. External Settings/backup services already pass those semantic IDs and do not need native prompt strings.

All five sensitive reauthentication scopes are covered by stale-result tests: `disable-app-lock`, `security-configuration`, `replace-restore`, `clear-app-data`, `plaintext-export`. Native background cancellation also locks an already-open session when reauthentication was started from a sensitive surface. The coordinator/backup owner integrates the exported localized limitation message into Settings.

The shared lifecycle coordinator replaces the hook's separate lifecycle subscription while retaining the existing browser visibility helper for its callers/tests. Native/background events are timestamped when delivered, before asynchronous classification. AppShell subscribes to the existing coordinator; there is no unsubscribe/resubscribe gap between startup and the app. The listener intentionally lasts for the WebView lifetime. `sessionRevision` is additive snapshot metadata, not persisted security state.

Native bridge additions are optional response metadata or additive methods/options. Missing older timing/created/recovery metadata is tolerated conservatively. The signed app bundles matching JS and native code; new recovery behavior requires that matching native plugin. Existing encrypted state/wrapped-secret formats, five-second key validity, key aliases and backend contracts are unchanged. No backend deployment order is involved in this domain.

## Executed evidence

Meaningful RED observations before fixes included stale-success unlock, two simultaneous protected operations, immediate-background pending success, automatic established-key replacement, missing semantic copy, secret priming after release, deletion of an existing alias on cancelled setup, lost active metadata replacement, sensitive-session background cancellation, cancelled legacy upgrade, absent capability classification, adapter language/method forwarding, configuring an unusable legacy immediate lock, and missing-key policy rotation. The native gate's old external-credential immediate exemption was explicitly made RED and removed. The bootstrap queue/revision regressions were written before their new coordinator implementation.

Supported runtime: Node22.23.3 from `C:\Users\Administrator\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin` prepended to PATH.

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/wp26-app-shell-refactor.test.ts tests/wp27-service-boundaries.test.ts tests/wp28-secure-auth-keystore.test.ts tests/wp29-encrypted-at-rest.test.ts tests/wp32-failure-injection.test.ts tests/wp33-5-startup-timing.test.ts tests/wp33-5-01-branding-auth.test.ts tests/wp37-auth.test.ts tests/wp37-auth-startup.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Result: **107 tests passed, 0 failed**; TypeScript passed. Log: `artifacts/wp37-auth-node.log`. New tests: auth20 and startup4. Legacy source assertions were updated to require the supported OS confirmation/API30 branches and forbid the removed unsupported combination; startup ordering and one-shot guards remain asserted.

```powershell
node node_modules/tsx/dist/cli.mjs --test tests/wp32-android-runner.test.ts
```

Result in approved normal context: **19 passed, 0 failed** (`artifacts/wp37-auth-runner.log`). The initial sandbox run failed before exercising scripts because Git Bash could not create its Windows shared-memory objects (`NtCreateDirectoryObject`, `0xC0000022`); assertions were not changed to hide that environment failure.

The pure Java production gate and `NativeAuthenticationGateTest` were compiled directly with Java21 `javac`, then run via the existing Gradle distribution's JUnit4.13.2/Hamcrest1.3 jars. Result: **4 tests passed**. This verifies token serialization/stale rejection, Home timeout, strict immediate lock, screen-off revocation and positive-timeout credential deadline logic. Compiled output is local `artifacts/wp37-auth-jvm`; this is JVM logic proof, not Android UI or hardware-auth proof.

```powershell
# From android/, using existing Gradle cache
.\gradlew.bat :app:testDebugUnitTest --tests com.spendwise.app.NativeAuthenticationGateTest --offline
```

Not completed locally: the sandbox first denied access to the Gradle wrapper cache lock; the approved normal-context retry failed before compilation with `java.io.IOException: Unable to establish loopback connection`. The configured Android SDK path is also unavailable locally. No Android plugin compile, Gradle unit result, instrumentation result, emulator result, signed APK or physical-device result is claimed by this report. Coordinator owns combined checks, CI, native build/lint, private APK and final review.

## Remaining native/device acceptance

CODE automated verdict: focused Node/TypeScript/JVM checks pass. Android build/CI verdict: pending coordinator. DEVICE/OEM verdict: **PENDING**, including the explicitly unsupported legacy immediate-credential combination.

- Run API24–27, API28–29 and API30+ builds/tests with the pinned AndroidX biometric1.1.0 and actual platform activities.
- On two physical phones where available, verify distinct localized EN/FR/AR native title/reason and native OS-owned labels; verify biometric retry remains open after one mismatch.
- Verify temporary/permanent lockout and hardware-unavailable recovery, explicit Cancel/Back without automatic recovery, then an explicitly requested supported phone credential challenge.
- Prove a protected Keystore round-trip after successful strong biometric and successful credential confirmation, including credential-only devices. An authentication UI success is insufficient.
- While each supported prompt is open, press Home and switch off the screen; return before/after configured 60/300/900-second deadlines. Repeat with immediate lock for biometric/API30+ routes. Stale success must not open Home or protected data.
- API24–29 timeout0: verify both primary credential-only and explicit recovery are refused before launching; verify clear localized limitation and unchanged timeout/key/data. Existing unsupported configuration requires explicit owner acceptance of the fail-closed limitation, not an unsupported GREEN claim.
- Exercise rapid taps, cancellation followed by retry, old external activity callback after cancellation, activity/process recreation, missing/invalidated keys with both populated and empty wrapped registries, and Home during delayed startup storage opening.

Mocked Node results and pure JVM gate tests do not substitute for any of these native/device checks.

## CI recovery follow-up — background prompt launch (2026-10-12)

Combined run `38249951357`, recovery job `114813352446`, failed on exact pushed head `185ccc8` (reviewed application source `4547b7e`). Initial device credential setup, Add fields, encrypted-at-rest audit and locked-DOM redaction passed. The subsequent `background-unlock` phase timed out waiting for `com.android.systemui:id/lockPassword`. The hierarchy showed SpendWise's locked surface and `Unlocking…`, with no native PIN dialog. Evidence is retained under `artifacts/wp37/ci-38249951357-recovery`; launch-interval application logs were absent from the collected failure logcat. No claim is made that the runner explicitly cleared logcat or that a specific native error was observed.

The production lifecycle/component sequence contains a confirmed defect: immediate `onNativeBackground` locks and notifies AppShell while Android remains stopped; AppShell mounts LockScreen with automatic authentication; LockScreen previously invoked its unlock callback immediately. A unique real-component fixture reproducing this sequence with React StrictMode failed all three pre-fix browser assertions: the native unlock callback ran once in the background, where zero calls were required. This distinguishes the reproduced application defect from a speculative Maestro selector change. AndroidX's [upstream compatibility implementation](https://raw.githubusercontent.com/androidx/androidx/androidx-main/biometric/biometric/src/main/java/androidx/biometric/BiometricPrompt.java) also returns without starting authentication when FragmentManager state has been saved. That source corroborates the unsafe launch mechanism; it is not a captured native trace from the failed CI run or proof about the patched emulator.

The fix gates all native LockScreen modes through the shared lifecycle queue before either bootstrap or AppShell unlock callbacks run. It captures the session revision before waiting and rejects a queued attempt after a later lock/cancellation or disposal of that presentation. StrictMode effect replay preserves the single automatic request. The native bridge independently checks that the Activity is resumed, FragmentManager state is not saved, and the Activity is not finishing/destroyed before starting either biometric or credential UI. An unsafe launch now resolves `cancelled / AUTHENTICATION_NOT_FOREGROUND` instead of relying on AndroidX to produce a callback. Existing immediate lock, Home/screen-off cancellation, key validity, explicit recovery behavior and one-shot auto authentication were retained. No Maestro wait/selector/assertion was relaxed.

Final focused verification on this follow-up source:

- Real LockScreen browser tests: **3/3 passed**, following observed **3/3 RED** on the original production component. Cases cover background-to-foreground single launch, cancelled queued request, and disposed presentation. Unique tracked fixture/spec: `tests/e2e/components/wp37-auth.html`, `wp37-auth-harness.tsx`, `wp37-auth.spec.ts`. The existing component CI configuration discovers the spec; local execution used an ignored scratch configuration on isolated port4190. Final log: `artifacts/wp37/auth-foreground-browser-green.log`.
- Node affected checks: **75/75 passed** across WP26, WP28, WP29, WP33.5 branding/auth and both WP37 auth suites. Coordinator tests additionally cover foreground classification and revision/disposal cancellation. Log: `artifacts/wp37/auth-foreground-node.log`.
- TypeScript passed; `git diff --check` passed.
- Pure JVM authentication gate: **5/5 passed**, including the new resumed/saved-state/destroyed readiness policy. The initial new readiness test could not compile before its production helper existed; the independent real-component RED above demonstrates the original behavior defect.

These focused checks do not establish Android plugin compilation, native prompt appearance or encrypted-draft recovery on the corrected APK. Coordinator owns review, combined checks, the new exact-head native recovery run, APK and integration. Existing active CI runs were preserved; this agent made no commit or push.
