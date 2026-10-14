# SpendWise WP38 — Android Authentication, Arabic Lock UX & Gemini Reliability Hotfix

> Execution authorization, 2026-10-14: implement WP38 on `codex/wp38-auth-gemini-reliability`, prepare and independently verify the private signed 2.1.4/code14 APK, then stop for the owner's acceptance. All Render inspection/live-provider checks and phone-only checks are deferred to the owner. No questions during execution; record unavailable checks in the handoff. No main merge, production deployment, tag/public release or branch deletion. Required build workflow metadata/branch changes are included; immutable source, endpoint, package and permanent signer guards remain intact. Home/background invalidates an interrupted authentication, while a fresh foreground authentication and established lock timeout behavior remain permitted. Candidate readiness is distinct from physical/production acceptance.

**Target:** SpendWise **2.1.4 / Android `versionCode` 14** (candidate; apply version bump only after changes and tests are ready).  
**Baseline:** current verified `main` carrying WP37 / 2.1.3 code 13. Do **not** blindly assume a commit hash—verify the exact checkout and clean worktree first.  
**Work branch suggestion:** `fix/wp38-auth-gemini-reliability`.  
**Implementation owner:** Codex.  
**Scope:** **bug fixes only**. No feature expansion, architectural rewrite, design refresh, or speculative optimization.  
**Release policy:** prepare a private signed in-place-upgrade test APK and report; **do not merge, tag, publish, or change Render settings without owner approval**.

## 0. Inputs, symptoms and proven source facts

The owner tested 2.1.3 on a physical Android phone:
- Strong fingerprint authentication works.
- Selecting phone PIN/pattern/password may appear to complete but leaves SpendWise locked or stuck at **“Unlocking…”**.
- Dismissing the fingerprint prompt and then dismissing the credential prompt can strand the lock UI with a disabled button. Relaunching the app restores the ability to retry.
- Arabic lock copy is overly long, awkward and visually inconsistent with the concise English card; mixed LTR brand/RTL copy is poorly handled.
- Gemini Spending Analysis/Statistics sometimes succeeds after ~45–50 seconds, while an earlier attempt may fall back to local analysis. The first failure has **not** been diagnosed from request logs; don't claim the cause is known.

Source inspection in supplied 2.1.3 archive shows:
- `android/app/src/main/java/com/spendwise/app/SpendWiseSecurityPlugin.java`: an Android 11+ strong-biometric prompt uses a negative button to launch a **separate** credential-only prompt. It maintains `activeAuthCall`, `pendingCredentialCall`, `cancellingPromptAttempt`, `activeAuthToken`, `promptAttempt`, and an authentication gate. Some terminal cleanup paths omit pending/cancellation fields; a stale `AUTHENTICATION_BUSY` state is a credible failure mechanism, but phone logcat is still required to pinpoint the exact occurrence.
- `src/screens/LockScreen.tsx`: `busy` disables both unlock/recovery buttons; the view has no recovery action if the native operation never settles. Existing foreground/lifecycle coordination must remain intact.
- `src/utils/translations.ts`, `src/security/authenticationCopy.ts`: long Arabic main/native/recovery copy.
- `server/geminiReliability.ts`: transient retries and per-operation deadlines exist, but **`AI_INVALID_RESPONSE` is non-retryable**, so invalid JSON/schema output immediately fails and can trigger local analysis.
- `server/taskRouting.ts`, `server/config.ts`, `server/services/GeminiService.ts`: four tasks (`smart-capture`, `scan-receipt`, `analyze`, `explain-trends`) have qualified model routes, but **explicit** deployment environment variables override defaults; live Render values were not verified in this audit.
- `src/screens/StatisticsScreen.tsx`, `src/app/hooks/useAiAnalysis.ts`: local fallback is prepared **before** the enclosing `try` block; an exception there can evade ordinary cleanup. Several screens disable the progress-panel Retry after quota exhaustion but leave primary Analyze/Refresh actions active.
- Existing budgets: client Gemini processing timeout **115,000 ms**; backend default operation budget **90,000 ms**, attempt timeout **50,000 ms**, maximum **2** attempts. These are configuration defaults and should not be raised without evidence.

## 1. WP38-A — Android native authentication (P0, release blocker)

**Likely files**: `android/app/src/main/java/com/spendwise/app/SpendWiseSecurityPlugin.java`, `src/screens/LockScreen.tsx`, `src/platform/android/AndroidSecurityAdapter.ts`, `src/security/SecurityLifecycleCoordinator.ts`, `src/security/SecureSessionService.ts` (only if an actual failing path requires it), and matching tests.

**A1. Fix API 30+ primary prompt.** Use AndroidX's supported single-prompt authenticator set `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` for primary authentication on Android 11+ **when both are supported**. Let Android own the switch from fingerprint to device screen lock. Do not supply `setNegativeButtonText` when the combined authenticator set includes `DEVICE_CREDENTIAL`. For explicit “use phone PIN/pattern/password”, use the supported `DEVICE_CREDENTIAL`-only prompt on API 30+. If strong biometric or credential capability is unavailable, select an actually supported, safe mode based on capability checks. No automatic device-credential launch after Back/X/cancel.

**A2. Preserve API 24–29 behavior.** Keep the existing supported legacy `KeyguardManager` credential confirmation for positive timeouts; **do not** introduce unsupported `DEVICE_CREDENTIAL`-only or combined AndroidX prompt combinations on older APIs. Preserve fail-closed behavior for **immediate lock (`0s`) + credential-only** on API 24–29; show the existing localized limitation message rather than weaken the key/timeout policy.

**A3. Make native terminal cleanup complete and race-safe.** Audit every success, user cancel, programmatic cancel, Home/screen-off, timeout, prompt launch exception, credential activity return, lifecycle destruction and stale callback. Every *terminal* operation must settle its Capacitor call exactly once, release the authentication gate and safely clear active/pending/cancelling markers. Stale callbacks must be rejected by token/attempt/session-revision identity and must never settle or unlock a newer operation. Handle pending legacy external credential activity without permitting overlapping credential prompts or accepting a late successful return after cancellation. Do not merely zero `cancellingPromptAttempt` prematurely if the old prompt still has an outstanding callback; design a finite, token-scoped completion/cleanup path that cannot wedge future requests.

**A4. Unstick React lock UX without weakening security.** In `LockScreen.tsx`, every terminal cancel/error returns to idle and re-enables **Unlock SpendWise / Try fingerprint again** and the supported PIN recovery button. If a native call fails to settle, use a **bounded recovery mechanism** coordinated with native `cancelAuthentication`, cancellation acknowledgment/token invalidation and presentation/session revision; do not just set `busy=false` while an old authentication remains valid in the background. Prevent repeated taps and duplicate prompts. Respect existing foreground-only auto-unlock behavior, `StrictMode` replay, and background privacy shield. No credential bypass and no auto-unlock after a cancelled/stale native result.

**A5. Verify real protected storage.** Completing the PIN system UI is not enough: verify the actual Keystore-authenticated protected-key operation / encrypted-data access before declaring unlock successful. Preserve existing keys, key aliases, biometric policy, 5-second key validity, lock timeouts, legacy migrations and fail-closed key-invalidated behavior. Never wipe user data, recreate an established key as a workaround, or disable App Lock.

**A6. Include actionable, safe diagnostics.** Emit bounded outcome/category and attempt/request identifiers for native authentication (e.g., prompt type, cancel/busy/stale/launch-failed/Keystore verification), without storing or logging PIN/password, decrypted content, hardware identifiers, secrets, raw finance data or cryptographic material. Correlate phone logcat to one failed test.

## 2. WP38-B — Arabic lock-screen and prompt copy (P1)

**Likely files:** `src/screens/LockScreen.tsx`, `src/utils/translations.ts`, `src/security/authenticationCopy.ts`, narrowly relevant localized tests.

Preserve the existing card: logo, title, concise description, primary button, explanation and optional credential recovery action. Do not redesign English/French or alter the already-approved “SpendWise is locked” page styling. Make Arabic semantically parallel to English, concise, and native-feeling.

**Approved target Arabic wording (adjust spelling only where needed for naturalness):**

| Element | Arabic copy |
| --- | --- |
| Lock title | `SpendWise مقفل` |
| Description | `استخدم بصمة الإصبع أو قفل شاشة هاتفك لفتح SpendWise.` |
| Primary button | `فتح SpendWise` |
| In-progress state | `جارٍ فتح SpendWise…` |
| Recovery explanation | `أعد المحاولة بالبصمة أو استخدم قفل شاشة هاتفك.` |
| Explicit credential action | `استخدام رمز الهاتف أو النمط أو كلمة المرور` |
| Fingerprint retry | `إعادة المحاولة بالبصمة` |
| User cancelled | `تم إلغاء التحقق. يمكنك المحاولة مجددًا.` |

The Android **OS-controlled** prompt may show hardware-specific instructions (for example, “Touch in-display fingerprint sensor”) in the device's system language; SpendWise cannot guarantee translation of system-owned text. Localize only application-owned prompt title/subtitle/button text. Preserve accurate, distinct security-operation titles for settings, backup and migration; do not replace them globally with generic unlock copy. Use appropriate `dir="rtl"` and bidi isolation around the Latin `SpendWise` brand; test punctuation/wrapping on a narrow Android viewport and in dark/light modes. Ensure buttons and status content do not collide with Android system authentication overlays. Maintain EN/FR regression coverage.

## 3. WP38-C — Gemini small reliability fixes (P1, avoid overhaul)

**Likely files:** `server/geminiReliability.ts`, `server/services/GeminiService.ts`, `server/config.ts`, `server/taskRouting.ts`, `src/screens/StatisticsScreen.tsx`, `src/screens/AiInsightsScreen.tsx`, `src/app/hooks/useAiAnalysis.ts`, `src/components/SmartCaptureCard.tsx`, `src/components/ReceiptScanCard.tsx`, corresponding tests. Touch only required files.

**C1. Deployment routing audit, before changing anything.** Read effective Render variables through an authorized channel (never print secret values). Verify `GEMINI_TASK_ROUTES`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL(S)`, `GEMINI_VERIFIED_MODELS`, `GEMINI_ROUTING_QUALITY_APPROVED`, operation budgets and max attempts. Check that all four task routes resolve to actually verified models with usable distinct fallbacks and intended low thinking level. The historical WP36 route is primary `gemini-3.5-flash-lite` -> verified fallback `gemini-3.8-flash`, but **do not change live deployment settings or models** without confirming availability, quality, free-tier quotas, and owner approval. Keep 90s/115s budgets and existing cold-start handling unless a reproduced failure proves a targeted adjustment necessary. If production values are unavailable, record **unverified**, not “fixed”.

**C2. Bounded invalid-response recovery.** For `AI_INVALID_RESPONSE` caused by malformed JSON or strict schema/quality-validation failure, allow **at most one** alternate *verified and distinct* model attempt **only if** there is remaining deadline budget and it won't violate current attempt, rate, quota or safety limits. Never retry content blocked/safety refusal, permanent configuration/authentication failure, known daily quota exhaustion, client cancellation or expired deadline. Do not relax `matchesGeminiSchema`, task-specific validators, deterministic statistics facts, or acceptance of financial numbers. No third chain, uncontrolled retries or billing surprises. If no qualifying alternate is available, keep current local fallback. Add a test for invalid JSON then valid fallback, invalid output with exhausted budget, repeated invalid output, content blocked, quota exceeded, cancellation and correct retry telemetry.

**C3. Consistent quota-exhaustion behavior across visible controls.** When a request is classified `quota_exhausted`, both progress-panel Retry **and** main Analyze/Refresh/Scan controls must respect the same non-retryable state for that context. Guard handlers as well as buttons; display a short localized reason and retain results/drafts. Avoid permanently disabling AI after the quota window changes or a new valid context begins; use existing reset/retry-after semantics rather than hardcoded forever-state. Preserve ordinary retry for genuine transient 429, 503 and network errors. Apply to Statistics, Spending Analysis, Smart Capture and Receipt Scanner only where applicable.

**C4. Protect fallback creation and cleanup.** Move `StatisticsEngine.generateLocalTrendExplanation(...)` and the `SpendingAnalyzer` summary/fallback preparation into the relevant protected operation scope. Guarantee that a thrown local-calculation exception clears loading/in-flight/progress state and shows a recoverable error rather than hanging. Never cache a failed/incomplete fallback as a valid result; avoid stale updates after cancellation or context switch. Preserve current validated local-only result and truthful “local” badge/notice when it succeeds. Leave verified numerical calculations unchanged.

**C5. Focused operational observability.** Use existing sanitized structured logging/request IDs to distinguish Render readiness/auth delay, Gemini provider timeouts/retries/429/quota/5xx, invalid schema, local fallback, user cancellation and final success. No API keys, prompts with private finance/image content, receipts or raw transaction details in logs. Don't claim 45–50s successful responses are bugs; avoid default timeout inflation.

## 4. Required verification — must not weaken existing gates

**Local automated regression, then CI on the exact tested commit**:
1. `npm run verify`; security/auth tests (`tests/wp28-secure-auth-keystore.test.ts`, `tests/wp37-auth.test.ts`, `tests/wp37-auth-startup.test.ts`), relevant component/browser tests, existing AI reliability/operations/validation tests (`tests/wp35-gemini-runtime.test.ts`, `tests/wp35-client-runtime.test.ts`, `tests/wp35-result-validation.test.ts`, `tests/reliability.test.ts`), and new WP38 tests. Run equivalent CI gate commands from the current repository, not fabricated script names.
2. Add focused JVM/native auth-state tests (including duplicate/out-of-order callbacks and settling once), Android Gradle compile/unit tests, and existing Android native encrypted-recovery acceptance. **Never** relax an old assertion, Maestro selector or timeout just to turn the suite green. Document environment-only skips or CI blockers truthfully.
3. Android auth physical tests (at least the owner's failing phone, plus a second API/OEM if available): successful strong fingerprint; PIN; pattern; password where configured; switch from biometric to credential; X/Back on fingerprint; X/Back on credential; twice cancelled -> retry; rapid taps; timeout; app Home/background/screen-off; activity recreation; post-cancel late result; invalidated key; migration; app-lock timeouts 0/60/300/900 seconds. Verify actual protected data loads **only after successful authorized authentication**. Older API 24–29 tests must preserve documented immediate-credential rejection. Do not mark untested combinations green.
4. Arabic EN/FR/AR lock-card and native prompt checks: narrow phone, dark/light, bidi brand, button enabled after cancel, system-auth overlay; no layout regression.
5. Gemini deterministic mocks: cold readiness, warm request, primary success, transient 429/503/timeouts with fallback, verified alternate after invalid JSON/schema, permanent quota, content block, cancellation mid-request, both models failing, low remaining budget, failed local fallback, stale result, duplicate request. Verify four routes and that local results are clearly labeled. With authorized live credentials, run one cold and one warm request for each of four tasks, record request IDs and outcome/timing with no sensitive data. Live operations remain subject to quotas.
6. In-place upgrade test from installed 2.1.3 to private 2.1.4 code 14 APK **with the same application ID and original signing certificate**, no uninstall/data reset. Confirm stored transactions, encrypted local data, backups and secure lock still work.

**Hard fail / stop conditions:** any PIN/auth path that only dismisses the OS prompt but fails protected-key verification; any unlocking after X/Back/cancel/timeout/Home; any persistent `Unlocking…`; loss of existing user data or credentials; changed crypto/backup formats; acceptance of invalid Gemini financial output; uncontrolled request loops; unapproved billing/quota/config changes; failed CI or unexplained new regression.

## 5. Delivery and approval sequence

1. Confirm `main` baseline/clean tree and identify exact current code; create one WP38 branch. Produce a short before-state root-cause note and focused reproductions, distinguishing proven code issues from unverified phone/runtime causes.
2. Implement **WP38-A** first, then **WP38-B**, then **WP38-C**. Keep commits narrowly scoped; don't start adjacent WPs or refactor unrelated screens.
3. Write/update WP38 tests and `docs/WP38_REPORT.md`: modified files, precise root causes, tests run/results, fail/skip categories, known Android OEM limitations, Gemini routing verification status, deployment changes (if none, say none), and remaining risks.
4. Run the complete relevant CI/test suite against the immutable WP38 head. Fix real red failures; don't mask them. Build a **private** signed 2.1.4/code 14 APK matching the established package/signing identity. Provide artifact identity/hash, location, and in-place upgrade instructions.
5. Pause for owner physical-device acceptance, especially PIN and cancel->retry. **Do not merge to main, trigger Render production deployment, create a public release or delete branches until expressly authorized.**

## 6. Codex completion format

Return these sections, with evidence rather than blanket “green” claims:
- **Root causes:** confirmed code defects vs suspected but not yet reproduced symptoms.
- **Changes:** by WP38-A/B/C, with exact paths.
- **Tests:** commands, pass/fail/skip totals, native CI and phone result separately.
- **Gemini:** four effective route configurations (model names only, no secrets), 90s/115s budget status, and actual logged failures if available.
- **Version/APK:** version name/code, signed APK filename, SHA-256, source commit, upgrade compatibility.
- **Remaining risks and GREEN/RED release recommendation.**

**Definition of done:** no hanging authentication UI; PIN/pattern/password routes correctly authorize access when supported; cancellations and stale callbacks stay locked yet are immediately recoverable; Arabic lock screen is concise and properly bidi-aligned; Gemini issues C1–C4 are resolved or explicitly marked unverifiable/blocked; no unrelated behavior or data/security regression; private candidate and evidence packet ready for owner approval.
