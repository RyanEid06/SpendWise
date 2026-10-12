# WP35 Combined Integration and APK Implementation Plan

> Current status (2026-10-11): **working and GREEN through WP36**, including CI, the deployed backend, private signed 2.1.2/code12 APK and owner phone acceptance. WP37 is upcoming; main stays untouched until after WP37. See [current status](../../STATUS.md). This document retains its historical checkpoint/specification; earlier pending deployment/device statements are superseded by that sign-off.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After WP35.3 passes, combine the three approved lanes, verify the combined behavior, conditionally merge main and build the permanent-keystore signed APK requested by the user.

**Architecture:** Integrate on `codex/wp35-integration` from the verified main base. Preserve WP35.1's durable authentication and shared recovery; add WP35.2's existing budgets to that transport, then forward real signals to WP35.3's UI. Keep one transport and existing JSON interfaces.

**Tech Stack:** TypeScript, React, Express, PostgreSQL17, Capacitor8.5.2, Android SDK36, Node22, Playwright and pinned Maestro2.11.0.

**Spec:** `docs/SpendWise_WP35_Implementation_Plan.md` at `c19a960ff49a18ebfc2f2eab1ccba45c16476402`, supplied WP35.3 objective, and user's subsequent conditional merge-and-APK instruction. `docs/WP35_1_OPERATIONS.md`, `docs/WP35_2_REVIEW.md`, `docs/WP35_3_REVIEW.md` are lane contracts, not substitutes for the spec.

## Global constraints

- WP35.3 exact-head CI must pass before any lane merge. Preserve all three feature branches.
- Main starts at `7d00b2dafadf829f63d2b6074b08d08c00ca352d`; revalidate before integration and main merge. WP35.1 checkpoint `c19a960`; WP35.2 checkpoint `97055ed8`; WP35.3 final tested code/receipt refs must be recorded.
- Preserve encryption, signing, keys, identity/revocation history, local data, protected drafts and backups.
- Preserve server90s shared ingress/provider budget, attempt50s and global2-attempt default, client115s processing/270s overall. No reset of budgets on stale-token refresh. No model/thinking/rate-guard change; candidate routing stays disabled.
- No new live Gemini calls, production deployment/settings/resources, version/tag/publication or physical-device installation. Main merge and APK build are conditionally authorized by the user. Confirm Render auto-deployment behavior before pushing main; a merge must not silently bypass durable-store cutover prerequisites.
- Simulated tests, real isolated PostgreSQL, emulator evidence, actual Google results, live Render and physical acceptance remain separately labeled. Real Render/phone/cutover acceptance is pending.
- Inline execution remains authorized; do not ask for redundant design/merge approval. One independent whole-integration review is required before main merge.

## Review focus

- One subscriber cancels during shared readiness/auth: its AI POST must never dispatch, while other subscribers complete and receive real phase signals.
- Headers arrive but body stalls; one stale-token rejection precedes another dispatch: processing and overall deadlines must bound both sends and late output.
- Recovery leader cancels, follower remains: observer cleanup must not leak callbacks or deliver another caller's unrelated dispatch. Each dispatch retains its operation correlation; shared phases expose the actual shared recovery relationship.
- Revoked/unknown identities after restart or DB outage: exact unknown-installation recovery only, no clearing revocation history, unauthenticated fallback or ephemeral Render file mode.
- Three-button navigation/keyboard and manual drafts during Retry/tab changes: actual app tabs must be selected and Save/focused fields remain reachable without double insets.

### Task 1: Integrate backend and durable-auth contracts

**Files:** merge existing lane changes in `server/config.ts`, `server/routes/{analysis,receiptScan,smartCapture,trends}.ts`, `server/logging/aiLogging.ts`, `server/observability/{aggregates,safeLogging}.ts`, `package*.json`, `.env.example`; preserve WP35.1 store/middleware and WP35.2 operation context/schema implementation. Add `tests/wp35-combined-config.test.ts` only for uncovered combined invariants.

**Interfaces:** consumes `FileInstallationRegistry`, `PostgresInstallationRegistry`, `InstallationAuthService`, WP35.2 operation context and existing route schemas; produces one combined backend configuration and request correlation path.

- [ ] Verify WP35.3 green/clean and all exact refs, finalize its report, create the integration branch from current main. Merge WP35.1, then WP35.2 and WP35.3 while resolving overlapping files by the contracts below, never by accepting a whole conflicting side blindly.
- [ ] Add failing combined configuration tests: Render refuses file auth under both host profiles, default server operation budget90000 is below client115000, routing is disabled, durable-store errors remain503 and revocation denial survives restart.
- [ ] Run `node --import tsx --test tests/wp35-combined-config.test.ts` and capture the failing combined contract before any corrective implementation. Existing lane tests remain authoritative and unchanged unless their intended contract changes explicitly.
- [ ] Combine host-profile config once, preserve WP35.1 durable store/TLS enforcement and WP35.2 runtime/schema/budget fields. Provider telemetry reuses `res.locals.requestId`; no second correlation generator.
- [ ] Run full `npx --yes --package=node@22 node --import tsx --test tests/*.test.ts` plus `npm run verify`; commit resolved integration and ledger results only after appropriate checks pass.

### Task 2: Combine recovery, processing bounds and progress subscribers

**Files:** modify `src/security/AuthenticatedApiClient.ts`, `src/security/RecoveryTransaction.ts` only if needed for shared observer lifecycle, retain `src/security/aiOperationBudget.ts`, `src/utils/api.ts`, `src/app/hooks/aiOperation.ts`; create `tests/wp35-combined-client.test.ts`; adapt overlapping lane transport tests to the actual combined interface without dropping assertions.

**Interfaces:** `AuthenticatedApiClient.fetch(path: string, init: AiRequestInit = {}, timeoutMs = 15000): Promise<Response>` retains WP35.1 constructor injection. `AiRequestInit.onPhase` receives actual start/success/failure observations compatible with the existing structural adapter. `withOperationDeadline(work,270000,parent)` remains the overall bound; the existing115000 processing allowance covers both dispatch bodies.

- [ ] Add failing integration tests for readiness→register/challenge/verify→dispatch→checking; shared subscribers including a late joiner and leader cancellation; cancelled auth never dispatches; request headers/phase telemetry/provider/disconnect use the same operation correlation in the single-operation end-to-end path.
- [ ] Add failing budget tests for stalled body, explicit stale-token refresh with one shared processing allowance, non-token401 no resend, timeout vs explicit cancellation, late output after Retry and no duplicate submission. Reuse WP35.1 real signing/registry fixture and WP35.2 fake clock/network fixtures.
- [ ] Run `node --import tsx --test tests/wp35-combined-client.test.ts` and record actual failures.
- [ ] Keep WP35.1 readiness/auth transaction and exact `UNKNOWN_INSTALLATION` semantics. Reuse incoming `X-Request-ID` if valid. Wrap the complete call with WP35.2 overall deadline; decrement one processing allowance only for dispatch/body time across permitted sends. Preserve abort reasons so deadlines stay TimeoutError.
- [ ] Forward per-caller actual readiness/auth events only while subscribed to that work, replay an already-active phase to a joining caller, and keep dispatch events scoped to their own operation. Observer failures cannot break auth; cancelled callers unsubscribe; no fabricated timer/model stages.
- [ ] Run all WP35 auth/runtime/progress/client/correlation tests and full Node22 suite, then build; commit and record exact counts and any deliberate test-interface adaptations.

### Task 3: Preserve feature UI and exercise the combined client

**Files:** resolve `src/app/hooks/useAiAnalysis.ts`, `src/components/{SmartCaptureCard,ReceiptScanCard}.tsx`, `src/screens/StatisticsScreen.tsx`, `src/utils/apiErrors.ts`, diagnostics contracts and translations; preserve all WP35.3 modal/progress/result validators. Update `tests/e2e/browser/wp35-progress.spec.ts` and overlapping continuity/recovery tests using `mockReadyAuthenticatedBackend` from WP35.1 helpers.

**Interfaces:** feature operation guards, `AiProgressPanel`, `parseAnalysisResult`, `parseTrendResult`, explicit Apply/Save and local-fallback identity remain WP35.3 behavior; AI calls consume WP35.2 named timeout constants rather than baseline30s/45s call-site literals.

- [ ] Add browser assertions for a held actual health request showing readiness, held challenge/verify showing secure connection, dispatch showing waiting, correct cancellation, daily quota without Retry and no auto-save/manual-field loss. Existing four-feature/language/theme matrix stays intact.
- [ ] Run the targeted new browser cases RED before resolving any missing signal/fixture behavior.
- [ ] Use healthy authenticated synthetic fixtures with tokens meeting WP35.1's existing minimum32-character contract. Keep fault-injection ownership with each test, rather than hiding recovery behind a mock client.
- [ ] Update the timeout UI test to advance beyond the existing115s processing bound rather than the old45s photo bound, without increasing production budgets. Preserve EN/FR/AR, reduced motion, local labels, retained work and encrypted draft assertions.
- [ ] Run `npm run test:wp32` serially plus full Node22/build; commit and inspect representative generated screenshots.

### Task 4: Combined CI and immutable review gate

**Files:** create `.github/workflows/wp35-integration.yml`, modify `.github/workflows/android-build.yml` to make deployed live Gemini smoke explicitly opt-in via manual boolean input defaultfalse, retain isolated guards and WP35.3 exact-inset probe. Create `docs/WP35_INTEGRATION_REVIEW.md` and continue the decision ledger.

**Interfaces:** dedicated branch CI must cover full Node22/security/diagnostics, WP32 components/browser/a11y/visual, real loopback PostgreSQL17 durability, SDK36 debug build, existing full native acceptance and relevant isolated/recovery gates. Native endpoints remain synthetic/unreachable; no Google credential is supplied.

- [ ] Reuse proven pinned runners and failure-local artifacts; add trigger for `codex/wp35-integration` with docs-only paths ignored. Audit every workflow/flow for unintended live generation before dispatch.
- [ ] Replace automatic live-smoke condition in main Android CI with explicit manual opt-in. Keep the smoke script and its assertions available; document that live backend proof is pending, not green. Do not alter Render settings.
- [ ] Push integration, record exact run IDs and observe sparsely. Inspect any failure's history/logcat/screenshots/trace first; fix real issues with regressions, retaining financial/security assertions. Rerun only failed jobs where supported.
- [ ] When local changes stabilize, request one fresh independent review of immutable main-base..integration-head using the documented five review-focus cases. Reproduce/fix Important findings in one repair pass with RED/GREEN and full appropriate verification; record declined-to-judge items and rulings.
- [ ] Finalize report exact source refs, changed-file manifest, actual CI/DB/emulator screenshots/geometry and remaining live/physical/cutover gates. Stop before main push if Render auto-deploy would perform an unapproved production rollout.

### Task 5: DEFERRED — conditional main merge and signed APK handoff

Latest user instruction overrides this task: stop after combined integration CI and independent review are green, keeping all three lanes only on `codex/wp35-integration`, and report before any further WP, main merge, deployment or APK. The historical steps below are retained for possible later authorization; do not execute them now.

**Files:** reuse existing candidate signing/provenance verification helpers; add a build-only manual candidate workflow if the existing guarded candidate workflow cannot produce the requested artifact without live calls. No version or signing identity change.

**Interfaces:** candidate package `com.spendwise.app`, existing `version.json`2.1.0/build10 unless the user explicitly authorizes another version; permanent certificate SHA256 `e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965`. Source commit, run ID, version, certificate and APK SHA256 must be independently verified.

- [ ] Revalidate unchanged main and all combined green/review receipts. Confirm main push has no unauthorized deployment side effect; complete concrete integration evidence before requesting any missing deployment authorization.
- [ ] Merge the green integration branch into main without deleting feature branches; push main under the user's conditional authorization. Observe the complete final-main automated run; no new live calls.
- [ ] Build a permanent-keystore signed candidate at the exact merged main source, preserving secret masking and existing signature/provenance assertions. Upload only a workflow artifact; no tag or GitHub Release publication.
- [ ] Download and verify package/version/certificate/source/hash; deliver a clearly named WP35 candidate APK and checksum sidecar, independently verify any Desktop copy. Label backend cutover/live Render/phone acceptance pending, and make no physical update claim.
- [ ] Disable ten-minute heartbeat and mark goal complete only when the extended merge-and-APK request is verified. Include rulings/deferred items from the ledger in final handoff.

## Preflight rulings

The user's explicit execution and conditional merge instruction supplies authorization to proceed inline after the gates; the skill's generic plan-review prompt does not require asking again. Cost if this interpretation is wrong: the user receives a concrete tested integration for review before the conditional main push, not an unauthorized deployment.

Moving live smoke to explicit manual opt-in is necessary to honor the no-new-Gemini-calls constraint during main CI. Cost: automatic CI will establish simulated/emulator/backend-contract correctness while actual live-provider availability stays separately pending.

No independent implementation agents are needed. One fresh final integration reviewer is the only delegated work mandated by the execution workflow.

Self-review: tasks1–3 cover lane contracts, cancellation/correlation/budgets and UI/draft/native behavior; task4 supplies actual combined regression/DB/emulator evidence and fresh review; task5 covers conditional main and signed artifact provenance. Production cutover, real idle/live generation and physical installation remain explicit unperformed boundaries, not silently waived test claims.
