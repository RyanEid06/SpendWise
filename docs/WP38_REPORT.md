# WP38 — 2.1.4/code14 hotfix report

Branch: `codex/wp38-auth-gemini-reliability`. Baseline: `16ea6870243d67daa28cfbc6e5d0e1126416fe47` (remote main verified2026-10-14). [Approved plan and owner execution boundaries](WP38_PLAN.md), [execution ledger](WP38_PROGRESS.md).

## Root causes and changes

### Android authentication

Native terminal cleanup retained pending/cancelling markers, and a missing native completion could leave React/service request ownership stuck. Additionally, AndroidX biometric1.1.0 keeps callbacks in an Activity-scoped ViewModel even with its Fragment constructor. Clearing markers or creating a new Fragment alone cannot safely isolate a cancelled prompt from a later request.

WP38 uses a private non-exported authentication Activity per attempt, keeping AndroidX and OS-managed fingerprint/PIN/pattern/password. API30+ uses supported combined or explicit credential prompts; API24–29 keeps legacy credential confirmation for positive timeouts and fails closed for immediate credential-only lock. Native tokens and unique operation results reject old/duplicate callbacks; bounded cancellation settles the bridge and cannot authorise protected operations. The existing Keystore verification/wrap/unwrap remains the success authority, retaining aliases, AES-GCM, five-second key policy, data formats and migrations. No key/data reset is introduced.

The lock/coordinator/service recovery deadline invalidates service and key generations before native cancellation acknowledgment; a late result/finally cannot unlock or clear a newer session. A failed acknowledgment stays fail closed and can be retried when the bridge recovers. Exact occurrence on the owner's phone remains unconfirmed without a fresh reproduction/logcat; automated reproductions establish code defects and fixes, not OEM certification.

### Arabic lock UX

The existing lock card/design and EN/FR wording stay intact. Arabic uses the approved concise title, description, cancellation, fingerprint-retry and recovery explanation. Latin SpendWise is isolated with `bdi dir=ltr` in RTL lock markup and Unicode directional isolates in application-owned native prompt strings. Distinct security-operation titles remain semantic. Android system-owned instructions remain controlled by the phone.

Changed: `src/screens/LockScreen.tsx`, `src/utils/translations.ts`, `src/security/authenticationCopy.ts`, focused native-copy/browser regressions.320px Light/Dark screenshots inspected; physical OS-overlay checks remain pending.

### Gemini reliability

See [detailed Gemini evidence and file list](WP38_GEMINI_REPORT.md). Qualified service routes opt into at most one distinct alternate after invalid JSON/schema/quality output within the original total attempts/deadline. Safety/quota/permanent errors/cancellation/deadline stay terminal, and all schema/financial validation repeats unchanged. No provider/model/dependency/architecture change.

A shared quota latch guards both handlers and visible controls across all four tasks, honors supplied Retry-After and existing valid context resets. Local preparation and fallback cache failures clear loading/in-flight/progress, and incomplete fallback is not published/cached. Smart Capture/Receipt keep previous validated extraction/photos on failure. No live requests or Render inspection/settings/deployment changes were performed.

## Verification status — final automated candidate

Exact reviewed application/workflow source: `732065e5455ca4de734d4982a662c2819fdd01af`. All six required workflows **SUCCESS** at this source; [artifact receipt](WP38_PRIVATE_APK.md) contains links and independent verification values. Final documentation is a docs-only child of this source.

| Evidence | Result |
| --- | --- |
| Full local Node22 suite | 687cases:686pass,0fail,1existing real-PostgreSQL skip |
| Combined web/PostgreSQL CI | **687/687 passed,0skipped**; production build and existing component/browser/accessibility/visual/performance gates passed |
| Focused authentication/Arabic browser | 8/8passed, real session/key/coordinator/LockScreen with OS boundary mocked, bounded hung recovery and stale-success rejection |
| Gemini focused Node/browser | 165pass,0fail,1existing database skip;20browser cases passed |
| Local native state gate / resource audit | JUnit9/9passed;4day/nightAPI24/27theme contexts and privacy guards passed |
| Combined API36 native | Compile/JUnit/lint, both navigation flows and actual-host instrumentation **2tests/0failures/0errors** passed |
| Full acceptance / encrypted recovery | Both combined jobs passed |
| Isolated native gates | All5jobs passed |
| Required PR workflows | Android Build, Auth Recovery, Gemini Runtime and WP32 E2E passed |
| Private signed build38589986178 | Passed, including repeated synthetic regressions, web build, native signing and identity guards |
| Independent downloaded APK | Valid Google apksigV2/permanent certificate, exact package2.1.4/code14/source/run/hash and compiled HTTPS endpoint |
| Owner phone acceptance | **GREEN — OWNER REPORTED** “It officially all works”, 2026-10-14; no detailed OEM/API matrix supplied |
| Effective Render routes / live Gemini | **OWNER-DEFERRED / UNVERIFIED**, no production action |

Local `npm run verify` passed on Node22 (existing bundle-size warning). WP32 runner19/19 and failure-injection11/11 passed; local component105/106 plus one unchanged successful retry, and remaining browser/accessibility/visual86/86 passed. The initial component interruption was a destroyed execution context during Home geometry; no assertion/selector/timeout was changed. CI subsequently passed the full gates.

Luna High independent immutable16ea687..54085c2 review found one Important host presentation defect, fixed by the private full-size translucent/no-action-bar/no-preview host theme. Existing secured content remains beneath the OS prompt without added touch-through/keyguard privileges. Compiled day/night resources and actual-host Back/duplicate/detach are now proven by final native instrumentation. No other actionable static findings were reported; physical OS/OEM/upgrade/live results were not certified.

Historical failures remain in [WP38_PROGRESS.md](WP38_PROGRESS.md): deprecated Back override caused real target36 lint errors and was repaired with the existing lifecycle-aware AndroidX dispatcher; unqualified instrumentation selected unrelated Cordova Kotlin duplicates and was scoped to `:app:connectedDebugAndroidTest`. One prior acceptance run lost SpendWise after a documented GMS FontsProvider death; one isolated build failed in IncrementalSplitterRunnable packaging before emulator with unspecified cause. Final unchanged application gates passed on732065e. No assertions, security checks, selectors or timeout budgets were weakened; retained logs are not erased or relabeled green.

## Routing and budgets

Repository defaults, verified synthetically for each of smart-capture, scan-receipt, analyze and explain-trends: `gemini-3.5-flash-lite` -> `gemini-3.8-flash`, thinking `low`. Backend operation90s, attempt50s, max2; client115s unchanged. Effective production overrides, model availability/free quota and cold/warm live timings remain **UNVERIFIED / OWNER-DEFERRED**. Backend recovery changes require a separately approved deployment; building the APK does not deploy them.

## Version, artifact and remaining acceptance

Candidate metadata:2.1.4/code14; `com.spendwise.app`; original permanent signing certificate. Package/lockfile root versions and deliberate current-version test/runbook/workflow expectations updated; dependency entries unchanged. Private immutable-source build and independent verification passed: [APK receipt](WP38_PRIVATE_APK.md), [machine-readable values](WP38_APK_RECEIPT.json). Install over existing2.1.3 without uninstall/reset. The owner accepted phone testing on 2026-10-14; no detailed OEM/API/per-scenario measurements were supplied. The [checklist](WP38_DEVICE_ACCEPTANCE.md) remains for regressions and untested matrix coverage. Official public tag/build/download verification is recorded separately in [WP38_PUBLIC_RELEASE.md](WP38_PUBLIC_RELEASE.md).

Release recommendation: **GREEN for the owner-accepted 2.1.4 public release**. The owner has authorized main integration, official Latest release/tag and deletion of completed branches after verification. Publication is in progress; Render effective routing/live-provider checks remain separately unverified, with no settings changes or manual calls included.
