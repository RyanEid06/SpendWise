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

## Verification status

- Clean baseline focused Node tests:70/70 passed.
- Native state gate compiled with JDK21 in normal Windows context; JUnit9/9 passed.
- Focused authentication/Arabic browser:8/8 passed, including real session/key/coordinator/LockScreen with only OS boundary mocked,65s hung recovery, cancellation acknowledgment and stale old success rejection.
- Gemini scope:165passed,0failed,1existing real-PostgreSQL skip;20browser cases passed. Parent integration check36/36 passed.
- Normal Windows production TypeScript/Vite build passed before final metadata; sandbox esbuild access denial recorded separately.
- Full preliminary host24 suite:686cases,682pass/3fail/1skip;2explicit Node22 benchmark guards and1obsolete busy-expression source assertion. The bidi assertion was structurally updated and portable official Node22.23.3 checksum-verified without changing the machine runtime. Final2.1.4/code14 full Node suite: **687cases,686passed,0failed,1existing real-PostgreSQL skip** (34.8s). Combined CI supplies the isolated PostgreSQL test database.
- Exact-source Android compile/unit/lint/native encrypted recovery/full acceptance, final independent Luna High review and signed APK identity/source/hash checks: pending.

No existing behavior/assertion/selector/timeout was weakened. Native source-contract checks follow moved prompt ownership and are supplemented by executable JVM/browser state tests. The Gemini actual-service invalid-schema assertion now requires the two exact approved models and zero task validation for invalid schema; generic executor assertions remain unchanged. Metadata guards will deliberately advance to the owner-selected2.1.4/code14.

## Routing and budgets

Repository defaults, verified synthetically for each of smart-capture, scan-receipt, analyze and explain-trends: `gemini-3.5-flash-lite` -> `gemini-3.8-flash`, thinking `low`. Backend operation90s, attempt50s, max2; client115s unchanged. Effective production overrides, model availability/free quota and cold/warm live timings remain **UNVERIFIED / OWNER-DEFERRED**. Backend recovery changes require a separately approved deployment; building the APK does not deploy them.

## Version, artifact and remaining acceptance

Candidate metadata:2.1.4/code14; `com.spendwise.app`; original permanent signing certificate. Package/lockfile root versions and deliberate current-version test/runbook/workflow expectations updated; dependency entries unchanged. Private immutable-source build/independent artifact receipt pending. Install over existing2.1.3 without uninstall/reset. Physical PIN/pattern/password, cancellation/overlays/OEM/API matrix and in-place real-data upgrade remain owner checks in [WP38_DEVICE_ACCEPTANCE.md](WP38_DEVICE_ACCEPTANCE.md).

Release recommendation: **candidate verification in progress; production release not approved**. Main merge, Render deployment/settings, tag/public release and branch deletion remain unauthorized.
