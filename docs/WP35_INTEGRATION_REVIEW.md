# WP35 combined integration execution and review

Plan: `docs/superpowers/plans/2026-10-11-wp35-integration.md`. Specification: `docs/SpendWise_WP35_Implementation_Plan.md`, read in full. Inline execution under the user's conditional combine/main/APK instruction. Gemini key unchanged; no live generation, production changes, version bump or device installation has occurred.

Base main `7d00b2dafadf829f63d2b6074b08d08c00ca352d`; WP35.1 `c19a960ff49a18ebfc2f2eab1ccba45c16476402`; WP35.2 `97055ed8a219d598c16eb7c731f09324029fb80d`; WP35.3 receipt `6616c09` with tested code `59e4a805d0a5b92271530d2afa567bf8a350747c`. WP35.3 exact-code run38121734881 passed both jobs before any lane merge. Exact web/native evidence is in `artifacts/wp35-3-ci-passed-*`.

## Execution ledger

- [x] Task 1: combine backend/durable-auth configuration and regression proof.
- [x] Task 2: combine recovery, shared processing/overall budgets, correlation and per-caller observers.
- [x] Task 3: exercise actual combined progress/client and preserve all feature/layout/draft checks.
- [ ] Task 4: combined CI, real isolated PostgreSQL, Android/Maestro and independent immutable review.
- [ ] Task 5: conditional main/deployment and exact-source permanent-keystore APK handoff.

Preflight interfaces: Task1 backend consumes WP35.1 auth-store enforcement plus WP35.2 runtime fields; retain both with one host-profile field. Task2 consumes WP35.1 shared recovery and WP35.2 budgets; Task3 consumes its real start/success/failure signals and existing structural adapter. Task4 consumes all previous changes and must disable automatic live-generation smoke. Task5 consumes green exact-source CI/review plus actual durable-store cutover prerequisites, not an inferred DB state.

Ruling: use the clean existing checkout for `codex/wp35-integration` from verified main — it is suitable and avoids disturbing another lane. Cost if wrong: another clean checkout would be needed; feature branches are preserved.

Ruling: native PowerShell commands and this tracked ledger replace POSIX skill helper wrappers because bash is unavailable on PATH — keep identical brief/base/test/ruling evidence in the repository. Cost if wrong: less automated bookkeeping; no test or review gate is skipped.

Ruling: collect all three lanes before completing the full regression contract — client and feature tests consume the combined interfaces, so intermediate merge commits are local and unpushed until combined behavior is verified. Cost if wrong: intermediate history has a known incomplete client; main remains untouched. WP35.3 passed before the first merge.

Task1 RED: both host-profile cases failed against WP35.1 alone because the shared Gemini operation budget was absent. GREEN after combining configuration:2/2, `artifacts/wp35-combined-config-{red,green}.log`. Preserve parameterized durable store, sanitized503 and revocation tests from WP35.1. Provider routes retain validated incoming request ID and WP35.2 ingress signal/deadline; privacy allowlists retain both storage and runtime codes.

Task2 RED: five new real-signing/auth-service client tests failed on missing per-caller phases, changed correlation, reset processing allowance and deadline mislabeled AbortError. GREEN5/5 after composition; full combined client/auth/runtime/progress transport subset45/45, `artifacts/wp35-integration-client-suite.log`. Shared subscribers receive the actual shared flight's correlation; each dispatch retains its own operation ID. Late join replays only a currently active phase. Aborted callers unsubscribe synchronously and never dispatch; other subscribers continue. One270s overall bound lives in the client; one processing allowance covers both dispatch bodies. No duplicate API-wrapper deadline remains.

Task3 initial browser RED: held health and challenge correctly displayed connection/authentication but the WP35.3 short-token fixture was rejected before dispatch. Use WP35.1 healthy-auth fixture rather than weaken the minimum32-character token validation. Processing timeout advances116s instead of46s to exercise the already-approved115s bound. Unit fixture adaptations add real readiness responses, valid token lengths and actual phase expectations; two old deadline expectations now require TimeoutError, with explicit cancellation assertions unchanged. No financial/security/draft assertions removed. The new held-challenge/verify UI checks pass. A new test's Cancel locator was corrected to the existing accessible name “Cancel AI request”. The quota assertion now checks WP35.2's existing “daily AI quota is exhausted” wording, retaining no-Retry/manual-amount checks.

Latest full Node22: **504 passed, zero failed, one isolated-Postgres test skipped locally**, `artifacts/wp35-integration-node22-final.log`; actual signed loopback HTTP/client/auth/provider/disconnect test passes and rejects sensitive telemetry. Production build passed. Local components39/39 passed with CI's two-worker limit. Browser70/73 passed initially, with the quota assertion above and two Google Fonts navigation failures; all three passed in the focused retry without extending any timeout. Trace network records show the two navigations had incomplete fonts.googleapis.com/fonts.gstatic.com requests before UI assertions. Original traces are retained under `artifacts/wp35-integration-browser-failures/`. CI must still prove a complete combined run.

Ruling: retry the two exact external-font navigation failures once with unchanged30s limits — the trace established unfinished font requests, rather than expense loss or Arabic UI failure. Cost if wrong: a transient product problem could be missed locally; full exact-source CI and native gates remain mandatory. The earlier default eight-worker component overload was likewise rerun at the existing CI two-worker setting, without changing product code or assertions.

Ruling: move the single overall bound from the API wrapper into the authenticated client — direct callers and shared recovery are now bounded too, and the wrapper retains metadata-only operation telemetry. Cost if wrong: a direct non-AI authenticated call also receives a270s upper bound; its existing shorter auth/request bounds still apply.

Ruling: the user's screenshot plus “so continue normally” authorizes the known main auto-deployment side effect — preserve the Gemini key, and still prove WP35.1 database/history cutover prerequisites before main push. Cost if wrong: an unwanted deployment; the conditional green and durable-history gates remain mandatory. This does not invent external resources or waive revocation preservation.

## Pending gates

Full combined Node22/WP32/CI/DB/native verification and final independent review are pending. Render durable database configuration and complete identity/revocation migration are unverified; production rollout must not restart an ephemeral sole registry before preserving that history. Actual Render idle/restart/provider and physical-phone acceptance remain separate. No deferred minor findings yet.

Local completion receipt for Tasks1–3: **504 Node22 passed, one DB-only skip; 39 components; 70 browser plus the three focused corrected/retried cases; 3 accessibility; 8 visual; runner19/19 and failure11/11; TypeScript/build passed.** Latest screenshot `receipt-ar-dark.png` inspected: real waiting status, one reduced-motion bar, readable RTL actions and reachable footer. No UI or timeout changes were made for font-network failures. Task4's dedicated workflow uses real isolated PostgreSQL17 and must establish one complete exact-source web/native run before main integration. Both new workflow YAML and the main workflow manual live-smoke input parsed successfully using a temporary pinned js-yaml4.1.0 parser; no dependency was added.
