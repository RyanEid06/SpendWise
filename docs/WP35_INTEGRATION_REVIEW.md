# WP35 combined integration execution and review

Subsequent user-authorized packaging: a private phone-test APK on Desktop before
any main merge/public release, version2.1.1/code11. See
`docs/superpowers/plans/2026-10-11-wp35-test-apk.md`. Only version metadata,
current-version assertions, build-only CI and runbook change; application/backend
implementation remains the green checkpoint below. The signed APK does not deploy
WP35's backend: current Render still follows main, and durable database/history
cutover remains pending. No production mutation is authorized by asking for
deployment instructions.

**Integration checkpoint GREEN — stop here.** All three lanes are combined on `codex/wp35-integration`; tested checkpoint `8f4b087864676478d743bd05520dfca76fa06c80`. Main remains `7d00b2dafadf829f63d2b6074b08d08c00ca352d`. Final documentation commit changes only this report. Main merge, deployment, signed APK and further features are deferred by the latest user instruction.

Plan: `docs/superpowers/plans/2026-10-11-wp35-integration.md`. Specification: `docs/SpendWise_WP35_Implementation_Plan.md`, read in full. Latest user instruction supersedes the earlier main/APK request: combine all three lanes on `codex/wp35-integration`, debug until combined verification and independent review are green, then stop and report for a possible additional WP. Main merge, deployment and signed APK are deferred until fresh authorization. Gemini key unchanged; no live generation, production changes, version bump or device installation has occurred.

Base main `7d00b2dafadf829f63d2b6074b08d08c00ca352d`; WP35.1 `c19a960ff49a18ebfc2f2eab1ccba45c16476402`; WP35.2 `97055ed8a219d598c16eb7c731f09324029fb80d`; WP35.3 receipt `6616c09` with tested code `59e4a805d0a5b92271530d2afa567bf8a350747c`. WP35.3 exact-code run38121734881 passed both jobs before any lane merge. Exact web/native evidence is in `artifacts/wp35-3-ci-passed-*`.

## Execution ledger

- [x] Task 1: combine backend/durable-auth configuration and regression proof.
- [x] Task 2: combine recovery, shared processing/overall budgets, correlation and per-caller observers.
- [x] Task 3: exercise actual combined progress/client and preserve all feature/layout/draft checks.
- [x] Task 4: combined CI, real isolated PostgreSQL, Android/Maestro and independent immutable review.
- [ ] Task 5: DEFERRED by latest user instruction; no main merge, deployment or signed APK at this checkpoint.

Preflight interfaces: Task1 backend consumes WP35.1 auth-store enforcement plus WP35.2 runtime fields; retain both with one host-profile field. Task2 consumes WP35.1 shared recovery and WP35.2 budgets; Task3 consumes its real start/success/failure signals and existing structural adapter. Task4 consumes all previous changes and must disable automatic live-generation smoke. Task5 consumes green exact-source CI/review plus actual durable-store cutover prerequisites, not an inferred DB state.

Ruling: use the clean existing checkout for `codex/wp35-integration` from verified main — it is suitable and avoids disturbing another lane. Cost if wrong: another clean checkout would be needed; feature branches are preserved.

Ruling: native PowerShell commands and this tracked ledger replace POSIX skill helper wrappers because bash is unavailable on PATH — keep identical brief/base/test/ruling evidence in the repository. Cost if wrong: less automated bookkeeping; no test or review gate is skipped.

Ruling: collect all three lanes before completing the full regression contract — client and feature tests consume the combined interfaces, so intermediate merge commits are local and unpushed until combined behavior is verified. Cost if wrong: intermediate history has a known incomplete client; main remains untouched. WP35.3 passed before the first merge.

Task1 RED: both host-profile cases failed against WP35.1 alone because the shared Gemini operation budget was absent. GREEN after combining configuration:2/2, `artifacts/wp35-combined-config-{red,green}.log`. Preserve parameterized durable store, sanitized503 and revocation tests from WP35.1. Provider routes retain validated incoming request ID and WP35.2 ingress signal/deadline; privacy allowlists retain both storage and runtime codes.

Task2 RED: five new real-signing/auth-service client tests failed on missing per-caller phases, changed correlation, reset processing allowance and deadline mislabeled AbortError. GREEN5/5 after composition; full combined client/auth/runtime/progress transport subset45/45, `artifacts/wp35-integration-client-suite.log`. Shared subscribers receive the actual shared flight's correlation; each dispatch retains its own operation ID. Late join replays only a currently active phase. Aborted callers unsubscribe synchronously and never dispatch; other subscribers continue. One270s overall bound lives in the client; one processing allowance covers both dispatch bodies. No duplicate API-wrapper deadline remains.

Task3 initial browser RED: held health and challenge correctly displayed connection/authentication but the WP35.3 short-token fixture was rejected before dispatch. Use WP35.1 healthy-auth fixture rather than weaken the minimum32-character token validation. Processing timeout advances116s instead of46s to exercise the already-approved115s bound. Unit fixture adaptations add real readiness responses, valid token lengths and actual phase expectations; two old deadline expectations now require TimeoutError, with explicit cancellation assertions unchanged. No financial/security/draft assertions removed. The new held-challenge/verify UI checks pass. A new test's Cancel locator was corrected to the existing accessible name “Cancel AI request”. The quota assertion now checks WP35.2's existing “daily AI quota is exhausted” wording, retaining no-Retry/manual-amount checks.

Pre-review full Node22: **504 passed, zero failed, one isolated-Postgres test skipped locally**, `artifacts/wp35-integration-node22-final.log`; actual signed loopback HTTP/client/auth/provider/disconnect test passes and rejects sensitive telemetry. Production build passed. Local components39/39 passed with CI's two-worker limit. Browser70/73 passed initially, with the quota assertion above and two Google Fonts navigation failures; all three passed in the focused retry without extending any timeout. Trace network records show the two navigations had incomplete fonts.googleapis.com/fonts.gstatic.com requests before UI assertions. Original traces are retained under `artifacts/wp35-integration-browser-failures/`. Subsequent complete CI passed all73 browser cases, as recorded below.

Ruling: retry the two exact external-font navigation failures once with unchanged30s limits — the trace established unfinished font requests, rather than expense loss or Arabic UI failure. Cost if wrong: a transient product problem could be missed locally; full exact-source CI and native gates remain mandatory. The earlier default eight-worker component overload was likewise rerun at the existing CI two-worker setting, without changing product code or assertions.

Ruling: move the single overall bound from the API wrapper into the authenticated client — direct callers and shared recovery are now bounded too, and the wrapper retains metadata-only operation telemetry. Cost if wrong: a direct non-AI authenticated call also receives a270s upper bound; its existing shorter auth/request bounds still apply.

Ruling: the user's screenshot plus “so continue normally” authorizes the known main auto-deployment side effect — preserve the Gemini key, and still prove WP35.1 database/history cutover prerequisites before main push. Cost if wrong: an unwanted deployment; the conditional green and durable-history gates remain mandatory. This does not invent external resources or waive revocation preservation.

## Checkpoint and deferred gates

Ruling: the user's latest explicit stop boundary overrides every earlier conditional main/APK instruction in this ledger and the saved plan — finish Task4 and report with all work on the integration branch. Cost if wrong: release waits for clarification; main and production remain untouched. Production DB/history cutover is documented future work, not a prerequisite for the synthetic integration checkpoint.

First pushed integration source: `9e7cecfbbd1ef94ddf642fa39fbbe610f93c767a`. Combined CI38123923615 has successful web/real PostgreSQL, API36 both-navigation/IME geometry and encrypted-draft recovery jobs. API34 full acceptance was cancelled at the job's45-minute limit during the upgrade tail; exact logs/artifacts establish the cause below. The independent whole-branch review resumed successfully after an initial usage-limit interruption and has completed.

Full API34 acceptance subsequently passed in the targeted retry below. The other combined CI jobs and independent review passed; the sole Minor template finding is corrected. No synthetic integration gate remains open. Render durable database configuration and complete identity/revocation migration remain unverified future rollout gates. Actual Render idle/restart/provider and physical-phone acceptance remain separate.

### Combined CI and independent review receipts

CI38123923615 at `9e7cecf` proved **505 Node22 tests, zero failures/skips**, including real PostgreSQL17; runner19/19, failure11/11, components39/39, browser73/73, accessibility3/3, visual8/8, WP33 browser10/10 and diagnostics173/173. TypeScript/build passed. API36 real keyboard and both navigation modes passed; encrypted-draft recovery passed.

The full API34 acceptance job's annotation explicitly states `The job has exceeded the maximum execution time of 45m0s`. All25 completed Maestro flows passed, including persistence/delete/cancellation, actual gallery/media boundaries, encrypted backup export/restore/corruption, old backup formats, App Lock and v1.4 seed. Its retained final-flow log shows migrated ledger/amount/photo assertions passed, followed by cold-restart system-PIN authentication and ledger visibility; cancellation arrived during the final History navigation, before the final photo assertion. No failing assertion or product stall is established. Prior main full acceptance log `artifacts/wp34-release-monitor/main-full-d6838dc-success.log` completed the same broad sequence in approximately36minutes after preparation; this run took longer, notably9m17s for its passing media flow.

Ruling: give only the full acceptance CI job a60-minute ceiling and add a manual `acceptance_only` selector, defaultfalse — rerunning the old immutable job would retain the insufficient45-minute cap. All flow assertions, app/provider budgets and fixture sequence remain unchanged. Cost if wrong: extra hosted CI time; per-flow failure/timeout checks still apply. Skip automatic CI for this workflow/template/docs-only repair commit, then dispatch only acceptance; retain the three successful original job receipts and prove unchanged application source. Do not claim one all-green exact-head run from these complementary receipts.

Fresh immutable whole-branch review by `wp35_integration_review` of `7d00b2da..9e7cecf`: **no Critical or Important findings**; fresh independent synthetic subset52/52 and diff check passed. Minor sample-environment defect reproduced RED (`Missing auth database configuration`), corrected by commenting the explicit `render_free` override, then GREEN3/3 including Render durable-store enforcement. No runtime/security policy changed. Full Node22 after repair: **505 passed, zero failed, one DB-only local skip** (`artifacts/wp35-integration-node22-review-fix-normal.log`); the real DB already passed original CI. An initial sandbox attempt blocked loopback HTTP/bash execution and was stopped; normal Windows verification passed. No second review round required for this narrow repair.

Reviewer declined actual Render idle/restart and Google quality, production database credentials/roles/TLS/history migration/backup restore, physical HONOR/OEM keyboard/navigation/TalkBack/upgrade, final remote API34 completion, signed APK/rollout provenance, and optional model/thinking-route qualification. These require unavailable live/private/physical evidence or are explicitly deferred. Synthetic/emulator proof cannot certify them; routing remains disabled.

Ruling: future delegated work uses the user's requested GPT-6 Luna at high reasoning — overrides the skill's most-capable-reviewer preference. The existing review was allowed to finish and is complete; no further subagent work is currently needed. Cost if wrong: review depth may differ, while concrete tests and review gates remain mandatory.

Local completion receipt for Tasks1–3: **504 Node22 passed, one DB-only skip; 39 components; 70 browser plus the three focused corrected/retried cases; 3 accessibility; 8 visual; runner19/19 and failure11/11; TypeScript/build passed.** Latest screenshot `receipt-ar-dark.png` inspected: real waiting status, one reduced-motion bar, readable RTL actions and reachable footer. No UI or timeout changes were made for font-network failures. Task4's dedicated workflow uses real isolated PostgreSQL17 and must establish one complete exact-source web/native run before main integration. Both new workflow YAML and the main workflow manual live-smoke input parsed successfully using a temporary pinned js-yaml4.1.0 parser; no dependency was added.

## Final checkpoint evidence — 2026-10-11

| Gate | Source and evidence | Result |
| --- | --- | --- |
| Combined build, security/runtime/auth/durability | [Original CI38123923615](https://github.com/RyanEid06/SpendWise/actions/runs/38123923615), source9e7cecf, web job114424194009 | Build passed;505 Node22 tests, zero failures/skips; real isolated PostgreSQL17 |
| Browser/accessibility/visual/diagnostics | Same original web job | 39 components,73 browser,3 accessibility,8 visual; WP33 browser10 and diagnostics173; runner19/failure11 |
| API36 actual keyboard and navigation | Original job114424194022 | Gesture and three-button Add/Edit continuity and strict geometry passed |
| Encrypted draft recovery | Original job114424193838 | 33 JUnit flows, zero failures/errors; process/activity interruption, lock/unlock, protected photos, saved-once and terminal cleanup |
| Full API34 acceptance | [Targeted CI38137855471](https://github.com/RyanEid06/SpendWise/actions/runs/38137855471), source8f4b087, job114465330952 | SUCCESS;26 JUnit flows, zero failures/errors, including full gallery/backup/App Lock/v1.4 in-place upgrade and final History/photo assertion |
| Independent whole-branch review | Immutable7d00b2da..9e7cecf; fresh52-test subset | No Critical/Important; sole Minor template defect fixed with RED/GREEN proof |
| Post-review template regression | Source8f4b087, local normal Windows Node22 | 505 passed, zero failed, one DB-only local skip; three focused config tests passed |

These are complementary receipts, not a claim that the original cancelled run turned green or that every job reran at8f4b087. The exact9e7cecf..8f4b087 diff contains only `.env.example`, its regression test, CI retry settings and two documentation files. Application, backend, Android and dependency source is unchanged. The manual retry intentionally skipped the three previously successful jobs. No provider/application timeout or financial/security assertion was weakened.

Native evidence downloaded and inspected:

- `artifacts/wp35-integration-android-acceptance-passed/`: all26 JUnit reports passed; `hardened-upgrade` Maestro log completes the final `View photos` assertion after cold restart/system authentication and History navigation. Full sequence completed12:43:45 UTC (15:43:45 Beirut).
- `artifacts/wp35-integration-api36-passed/wp35-{gesture,threebutton}/`: allfour Add/Edit real-IME geometry receipts checked. Consumed native insets are0 and overlay padding14px on each side; header/footer/focused field stay inside the available viewport. Viewed gesture Add and three-button Edit screenshots: readable header, focused Description and Save/Update/Cancel above the actual keyboard, with visible breathing room. Existing injected-inset tests cover the nonzero path without double application.
- `artifacts/wp35-integration-recovery-passed/`:33 reports passed; terminal at-rest receipt has one encrypted database, zero plaintext draft sentinels and zero plaintext photo files.
- `artifacts/wp35-integration-final-native-summary.json`: local report-count summary. Original logs and failure traces remain available for audit.

Actual stage mapping remains local photo preparation → actual readiness flight → actual register/challenge/verify flight → caller's dispatch/wait → checking only after response body → Ready only after validation. Shared flight observations retain their actual initiator correlation; dispatch uses each caller's own correlation. Cancellation invalidates the generation before transport abort and unsubscribes that caller; no fabricated model stages, percentages or automatic expense save.

Deferred items: main merge/automatic Render rollout/signed APK/additional WP are stopped by the latest human boundary. Production durable-identity/revocation-history cutover, real Render idle/restart/live provider qualification and physical HONOR/TalkBack/upgrade acceptance require their separate evidence and authorization. Gemini key and version remain unchanged, optional routing remains disabled, and no live Google request or physical installation was performed. No known source review finding remains deferred.

The decision rulings above are retained for review: existing isolated checkout, PowerShell ledger helpers, complete three-lane composition before shared push, bounded retries only for diagnosed local font failures, one client overall budget, superseded deployment authorization, final integration-only stop boundary,60-minute CI job ceiling with targeted retry, and future user-selected GPT-6 Luna/high subagents. No additional agent was started after that preference.

## Complete changed-file manifest

Relative to main7d00b2dafadf829f63d2b6074b08d08c00ca352d;91 paths including this report. Status and path are generated from the verified integration diff:

```text
M	.env.example
M	.github/workflows/android-build.yml
A	.github/workflows/wp35-auth.yml
A	.github/workflows/wp35-gemini-runtime.yml
A	.github/workflows/wp35-integration.yml
A	.github/workflows/wp35-progress-safe-area.yml
M	.maestro/current/offline-ai.yaml
M	.maestro/current/wp33-5-04-save-and-ai.yaml
M	.maestro/current/wp33-5-04-save-and-edit.yaml
A	docs/SpendWise_WP35_Implementation_Plan.md
A	docs/WP35_1_OPERATIONS.md
A	docs/WP35_2_LIVE_RESULTS.json
A	docs/WP35_2_REVIEW.md
A	docs/WP35_3_IMPLEMENTATION.md
A	docs/WP35_3_REVIEW.md
A	docs/WP35_INTEGRATION_REVIEW.md
A	docs/superpowers/plans/2026-10-11-wp35-integration.md
M	package-lock.json
M	package.json
M	scripts/wp33-5-04-native-continuity.sh
A	scripts/wp35-gemini-live.ts
A	scripts/wp35-synthetic-images.ps1
A	scripts/wp35/editorLayout.ts
M	server/app.ts
M	server/config.ts
M	server/geminiReliability.ts
M	server/logging/aiLogging.ts
A	server/logging/providerUsage.ts
A	server/middleware/aiOperationContext.ts
M	server/middleware/authentication.ts
M	server/middleware/cors.ts
M	server/middleware/errors.ts
M	server/observability/aggregates.ts
M	server/observability/requestObservability.ts
M	server/observability/safeLogging.ts
M	server/routes/analysis.ts
M	server/routes/auth.ts
M	server/routes/health.ts
M	server/routes/receiptScan.ts
M	server/routes/smartCapture.ts
M	server/routes/trends.ts
M	server/security/installationAuth.ts
A	server/security/postgresInstallationRegistry.ts
M	server/security/runtime.ts
A	server/security/sql/001-installations.sql
M	server/services/GeminiService.ts
A	server/taskRouting.ts
A	server/validation/geminiSchema.ts
M	src/app/AppShell.tsx
A	src/app/hooks/aiOperation.ts
M	src/app/hooks/useAiAnalysis.ts
A	src/app/hooks/useAiOperation.ts
M	src/components/AddEditExpenseModal.tsx
A	src/components/AiProgressPanel.tsx
M	src/components/ReceiptScanCard.tsx
M	src/components/SmartCaptureCard.tsx
M	src/index.css
M	src/screens/AiInsightsScreen.tsx
M	src/screens/StatisticsScreen.tsx
M	src/security/AuthenticatedApiClient.ts
M	src/security/InstallationIdentityService.ts
A	src/security/RecoveryTransaction.ts
A	src/security/aiOperationBudget.ts
M	src/services/diagnostics/contract.ts
A	src/utils/aiResultValidation.ts
M	src/utils/api.ts
M	src/utils/apiErrors.ts
M	src/utils/translations.ts
M	tests/e2e/browser/core-flow.spec.ts
M	tests/e2e/browser/helpers.ts
M	tests/e2e/browser/wp33-5-04-continuity.spec.ts
M	tests/e2e/browser/wp33-5-05-recovery.spec.ts
A	tests/e2e/browser/wp35-progress.spec.ts
M	tests/reliability.test.ts
M	tests/wp27-service-boundaries.test.ts
M	tests/wp31-backend-security.test.ts
M	tests/wp33-backend-integration.test.ts
M	tests/wp33-backend-observability.test.ts
A	tests/wp35-auth-recovery.test.ts
A	tests/wp35-client-runtime.test.ts
A	tests/wp35-combined-client.test.ts
A	tests/wp35-combined-config.test.ts
A	tests/wp35-combined-correlation.test.ts
A	tests/wp35-correlation.test.ts
A	tests/wp35-durable-auth.test.ts
A	tests/wp35-editor-layout.test.ts
A	tests/wp35-gemini-runtime.test.ts
A	tests/wp35-progress-transport.test.ts
A	tests/wp35-progress.test.ts
A	tests/wp35-result-validation.test.ts
A	tests/wp35-runtime-observability.test.ts
```
