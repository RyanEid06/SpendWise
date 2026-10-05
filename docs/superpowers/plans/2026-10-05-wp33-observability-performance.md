# WP33 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if selected by the user. Track steps with checkboxes.

**Goal:** Deliver privacy-safe support diagnostics, bounded backend aggregates and measured large-ledger performance with all retained gates green.

**Architecture:** Runtime allowlists protect technical records at collection, reload and export. Existing service boundaries emit safe state/errors and bounded aggregates. Synthetic tools exercise actual shared ledger/crypto/backup functions and separate browser/native measurements from Node approximations.

**Tech Stack:** Node 22, TypeScript/tsx, React, Express, Playwright, existing JSZip/hash-wasm/WebCrypto and Capacitor Android/SQLCipher. No new product dependencies.

**Spec:** `docs/superpowers/specs/2026-10-05-wp33-observability-performance-design.md` (approved by user on 2026-10-05).

## Global Constraints

- Work only on `wp33/observability-performance`; do not merge or delete it.
- WP33 only; preserve app 2.0.0/code 6 and all WP25-WP32 security/recovery behavior.
- No external telemetry, analytics SDK, user activity timeline or raw sensitive logging.
- At most 128 recent technical records, seven-day retention, 64 KiB persisted diagnostics.
- Backend dimensions are fixed; at most 512 latency samples per operation.
- Fixtures: 0, 100, 1,000, 10,000 and 25,000 synthetic expenses.
- Timing thresholds follow measured baselines; correctness/bounds failures always block.
- Stage explicit paths. Use supported Node 22 for recorded evidence.
- Production release, security certification, real-device/TalkBack work remain WP34.

## Review Focus

- Poisoned local diagnostics must be discarded without corrupting financial data; Task 1 tests malformed JSON, unknown fields and storage exceptions.
- Arbitrary request paths/error objects must not become log labels; Task 3 sends sensitive sentinels through real HTTP/error/log boundaries.
- Aborted requests and shutdown must not duplicate counts or leak listeners/timers; Task 3 verifies close/finish and scheduler teardown.
- Backup duplicate matching uses a strict floating-point tolerance, not rounded equality; Task 5 tests both predicates and amount-boundary collisions against the old planner.
- Timing environments and baseline coverage must match; Task 6 tests mismatches, missing operations, invalid timings and severe/warning regressions.

## Task 1: Client diagnostics contract and bounded store

**Files:** Create `src/services/diagnostics/contract.ts`, `src/services/diagnostics/DiagnosticStore.ts`, `src/services/diagnostics/diagnostics.ts`; test `tests/wp33-diagnostics.test.ts`.

**Interfaces:** `DiagnosticStore(storage: KeyValueStore | null, now?: () => number)` exposes `record(input: unknown): void`, `setState(input: unknown): void`, `report(): DiagnosticReport`, `clear(): void`. `measureDiagnostic<T>(operation: DiagnosticOperation, work: () => Promise<T>): Promise<T>` passes through results/errors while collecting a safe outcome. Types and enum allowlists live in `contract.ts`.

- [ ] Write tests asserting forbidden sentinel fields/messages are absent from JSON, unknown operation/code strings are replaced, nonfinite/negative numeric values rejected, output copies cannot mutate retained data, poisoned reload is sanitized, 129th record evicts oldest, seven-day expiry and 64 KiB bound hold.
- [ ] Run `tsx --test tests/wp33-diagnostics.test.ts`; confirm failure before implementation.
- [ ] Implement allowlist construction (no spreading untrusted objects), safe localStorage access, count/byte/time bounds and best-effort persistence. Report constant app/version/schema/backup metadata separately from caller input. Persist only technical errors/recovery state, not routine user-action chronology.
- [ ] Re-run focused tests; all pass, including storage read/write/remove failure handling.
- [ ] Commit only the contract/store and tests once verified.

## Task 2: Client integration and explicit report control

**Files:** Modify `src/main.tsx`, `src/utils/localDataStore.ts`, `src/data/NativeEncryptedDatabaseService.ts`, `src/utils/attachmentStorage.ts`, `src/features/backup/BackupService.ts`, `src/utils/api.ts`, `src/app/hooks/useAiAnalysis.ts`, `src/app/hooks/useExpenseDeleteUndo.ts`, `src/screens/SettingsScreen.tsx`; create `src/features/settings/TechnicalDiagnostics.tsx`, `src/services/diagnostics/exportDiagnostics.ts`; tests `tests/wp33-diagnostics-integration.test.ts`, `tests/e2e/components/diagnostics.spec.ts` and component harness.

**Interfaces:** `TechnicalDiagnostics({language}: {language: Language})` provides inspect/export/clear controls; `exportTechnicalDiagnostics(): Promise<void>` sanitizes a fresh report and calls existing `exportTextFile`. Normal initialization sets allowlisted platform/schema/migration/capability state; startup failure can expose the same control without loading the ledger.

- [ ] Add tests for safe failure events at existing storage/backup/API/Undo boundaries and for unchanged rethrow/results; assert raw error console output is removed. Add rendered preview/export/clear, accessible controls, EN/FR/AR and poisoned-storage sentinel checks.
- [ ] Run focused Node/component tests and observe intended failures.
- [ ] Wrap existing operations without changing their ordering/security decisions; emit only allowlisted failure codes and aggregate timing. Do not pass expense/state/passphrase/body/Error objects into recorders. Avoid per-search/navigation/CRUD-success event logs.
- [ ] Add localized technical-only explanation, fresh sanitization at export and clearly named JSON file; user action is the only export trigger. Keep Settings order and viewport/modal behavior.
- [ ] Run focused checks plus WP20/WP23/WP26-WP30 and affected component tests; fix locally, then commit explicit paths.

## Task 3: Bounded backend metrics and logging

**Files:** Create `server/observability/aggregates.ts`, `server/observability/requestObservability.ts`, `server/observability/safeLogging.ts`; modify `server/app.ts`, `server/startServer.ts`, `server/logging/aiLogging.ts`, `server/logging/securityLogging.ts`, `server/middleware/errors.ts`, `server/middleware/authentication.ts`, `server/middleware/requestLimits.ts`, `server/middleware/rateLimit.ts`, `server/routes/auth.ts`, `server/services/GeminiService.ts`, `server/geminiReliability.ts`; test `tests/wp33-backend-observability.test.ts`.

**Interfaces:** `OperationalAggregates` exposes `recordRequest(route, status, elapsedMs, aborted)`, `recordFailure(reason)`, `recordProvider(modelRole, elapsedMs, succeeded)`, `snapshot()`, `reset()` with fixed enum arguments/runtime validation. `observeApiRequests` maps route to known labels before middleware work. `startAggregateReporting(metrics, emit, intervalMs?)` returns a teardown function and uses an unref timer in Node.

- [ ] Write HTTP/unit tests for success/401/auth proof failures/invalid JSON/413/429/quota/provider retry/fallback and exact count behavior. Send sensitive bodies, route/query/header/error/model strings and capture every owned console boundary; assert sentinels absent and health contract unchanged.
- [ ] Add finite-dimension/512-sample/percentile/saturation/finish-close/listener-cleanup/suppression/timer teardown tests. Observe failures before implementation.
- [ ] Implement fixed counters and bounded windows; register observer before HTTPS/CORS/auth/parsers. Add safe reason recording at semantic failure points instead of inspecting raw bodies.
- [ ] Wrap actual provider attempts to observe latency, successful/failed outcomes and fallback role; preserve two attempts, timeout and fallback conditions. Emit rate-bounded logs and low-cadence aggregate summaries; never create a public metrics endpoint or growing log file.
- [ ] Report admission bounds and worst-case configured provider-attempt multiplier accurately; no claimed dollar/token billing precision.
- [ ] Run focused checks plus reliability/WP27/WP31; commit explicit paths.

## Task 4: Fixtures, large-ledger reference correctness and baseline runner

**Files:** Create `scripts/wp33/fixtures.ts`, `scripts/wp33/benchmark.ts`, `scripts/wp33/measure.ts`, `tests/wp33-large-ledger.test.ts`, `tests/wp33-benchmark.test.ts`.

**Interfaces:** `createSyntheticLedger(size: number, seed?: number): FinancialState` returns valid deterministic data; `runBenchmarks(options): Promise<BenchmarkReport>` returns environment, revision, fixture identity, per-size/operation sample count/median/spread and correctness receipts. Fixtures can concentrate dates into one month for rendering tests.

- [ ] Test determinism/validity for all five sizes, independent integer-cent totals, category/month references, History IDs/groups/filters and deterministic rankings, local AI summaries, input immutability, currency conversion, persistence restart and Undo/delete conservation.
- [ ] Test actual Backup v3 round trips, replace/merge with isolated adapters, duplicate/id/currency behavior and integrity analysis. Keep media count/manifest size below existing ZIP/8-photo/8 MiB/512 MiB limits; include rejection cases without widening any protection.
- [ ] Observe failures, then implement test-only fixture generation and independent references.
- [ ] Implement warmup/repeated samples and consumed-output validation for actual storage/init/read, History, Statistics/ranking/detail, AI summaries, v3 create/header/decrypt/parse/restore planning/restore merge and media integrity/codec operations. Fresh adapters per sample; fixed clock/timezone; real KDF costs.
- [ ] Run all required sizes, preserve pre-optimization report under ignored `artifacts/wp33/`, record environment/sample variation and label adapter/pure-operation measurements accurately. No native claims from mocks.
- [ ] Commit fixture/test/runner code, not large archives or secrets.

## Task 5: Evidenced scaling repairs

**Files:** Modify `src/utils/backupV2.ts` if baseline supports it; any further History/Statistics changes require their own evidenced equivalence tests. Test `tests/wp33-restore-equivalence.test.ts`.

**Interfaces:** Preserve `planBackupV2Restore(manifest, existingState, replaceExisting): BackupV2RestorePlan` and every existing result/rejection rule.

- [ ] Keep a test-local copy of the pre-change planner as the reference. Assert identical output for seeded large merges, duplicates within imports, ID conflicts/reassignment, trimmed/case-normalized descriptions/categories and amounts around strict 0.001 boundaries. Observe regression failures before modifying the planner.
- [ ] Build ID indexes and compatible duplicate indexes that preserve both original predicates and strict amount tolerance. Avoid a rounded fingerprint that merges distinct entries or splits tolerance-near entries. Preserve order and skipped ID/media mappings.
- [ ] Run equivalence, WP30/media-backup/persistence and large-ledger checks. Re-run only affected benchmark operations; show pre/post evidence. Leave clean code alone when measurements do not justify change.
- [ ] Commit the measured repair and tests only when equivalent.

## Task 6: Browser/native measurements and regression budgets

**Files:** Create `scripts/wp33/budgets.ts`, `tests/wp33-budget.test.ts`, `tests/e2e/performance/large-ledger.spec.ts`, `scripts/run-wp33-native-benchmark.sh` and compact `scripts/wp33/baselines/*.json` after measuring; reuse existing fixture/import/native inspection runners.

**Interfaces:** `compareBenchmark(report: BenchmarkReport, baseline: BenchmarkBaseline): BudgetResult` distinguishes warning, severe repeated regression, incomparable environment and missing/invalid coverage. Budget artifacts include threshold policy and reason per operation/size.

- [ ] Add tests for unchanged results, measured severe relative regressions, noisy warning-only cases, environment mismatches, missing sizes/operations, NaN/negative samples and absent baseline; observe failures then implement validation/comparison.
- [ ] Run actual History/Statistics initial rendering/search at concentrated and distributed scales in isolated browser contexts; assert IDs/totals. Record browser/render metrics separately from Node preparation.
- [ ] Measure encrypted open/read/ledger load and available migration/startup evidence on a dedicated synthetic emulator using existing Android security flow. Restrict native runner to emulator and verify fixture isolation; no real-device reset or auth/crypto bypass. If infrastructure cannot measure a quantity, mark it unmeasured and retain strongest reproducible alternative.
- [ ] Collect repeated supported-environment baseline runs before selecting thresholds. Save compact baseline metadata/medians/spread and measured warning/hard policies; do not update baselines in the comparison gate.
- [ ] Validate measured budgets and document approximate heap/latency-window and native-startup limits.

## Task 7: Gate, final verification and delivery

**Files:** Modify `package.json`, `.github/workflows/android-build.yml`, relevant WP32 benchmark orchestration if required, and `ROADMAP.md`; add `tests/wp33-gate.test.ts`.

**Interfaces:** `npm run test:wp33` executes focused privacy/backend/correctness/equivalence/budget tests and benchmark completeness/budget comparison for required sizes. Dedicated commands expose benchmark collection and browser/native performance evidence.

- [ ] Test gate composition, retained suites and placement after WP32-related checks/before sync/build; observe failure then wire scripts/CI. Upload safe compact benchmark artifacts with bounded retention.
- [ ] Run supported Node 22 full existing Node suite, signing-verifier regressions, WP33, all WP32 components/browser/accessibility/visual, TypeScript/Vite and audits (production moderate; all high).
- [ ] Run Capacitor sync and JDK21 debug APK build. Run deployed installation-authenticated Gemini smoke without printing credentials. Obtain appropriate final-head native encrypted/backup/Undo evidence with preserved WP32 harness.
- [ ] Inspect localized failures/artifacts and rerun closest affected checkpoint. Run the full gate only after focused areas stabilize; do not weaken assertions.
- [ ] Update ROADMAP with actual privacy contract, aggregates, environment/datasets/per-size operation medians/spread/budgets, bottlenecks/optimizations, exact validation receipts and remaining WP34 list. No physical-device or production-certification claim.
- [ ] Commit and push only explicit WP33 paths. Run normal CI on the exact final WP33 head and verify source SHA/check conclusions. Preserve the branch; do not merge or release.
- [ ] Audit every acceptance 1-16 and report branch/SHA, changed areas, diagnostics/privacy/backend, all-size timings/budgets, bottlenecks/fixes, full test/CI results, concerns, exact WP34 remainder and merge YES/NO.

## Execution checkpoint

The plan covers all user objective parts and all 16 acceptance requirements.
No application/test implementation is committed at this checkpoint. Native
execution is recommended because the tasks share diagnostics, fixture and
benchmark contracts; one final independent review can check the whole branch.
