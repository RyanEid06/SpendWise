# WP36 reliability and expense-entry review

Baseline: `622c2dafc100c6cfcc3fff8ed8f3d053c2647f14` (`codex/wp35-integration`). Branch: `fix/wp36-gemini-reliability-expense-ux`. Reviewed initial candidate: `37d8753c1a9be825445d5560cc135d359294e3ff`; regression-verified fix commit: `c3507b449b6f6c34fe6381412cf0cb976dbc0fda`. No merge, deployment, release, signing change or dependency change is authorized by this review.

## Verdict and approval boundaries

**Gate A — CODE / CI: RED LIGHT pending final independent review and actual PR checks.** Local Node22: 547 passed, 0 failed, one PostgreSQL test skipped without its isolated database. TypeScript/production build passed. UI/performance and Android/real-PostgreSQL CI receipts will be recorded below when completed. A pending/unexecuted check is not a pass.

**Gate B — PRODUCTION / DEVICE: NOT YET VERIFIED.** The public backend did not expose a commit in the inspected response. No physical HONOR/device acceptance or WP36 production deployment has been performed. CI and direct synthetic Google calls cannot establish Gate B.

## Confirmed defects and remaining hypotheses

- The old default sequence was Flash 3.8, Flash 3.7, Lite 3.5 with only two attempts. Its third model was unreachable. Google documents 3.7 as a deprecated alias routed to 3.8; the apparent fallback offered no underlying model diversity.
- Trend validation previously checked JSON shape only. Correctly shaped but invented totals, percentages, rankings and explanations could be displayed. WP36 rejects provider-authored financial prose and renders a validated fact catalog instead.
- Manual description validation rejected a blank field although the selected category already supplied a useful localized description.
- Health lacked deployment visibility, and auth/backend failures could share a generic provider-oriented error. WP36 adds a sanitized version and separate backend/auth messages.
- Bounded direct synthetic calls reproduced Flash overload (503 at 3641ms) and a Smart Capture attempt timeout (50020ms). This proves those particular provider stages failed; it does **not** identify the stage of the owner's earlier phone failures.
- Public health responded after 43802ms. Render waking/cold start is plausible, not established from a single timing. Stale deployment, Render environment overrides, network path and Neon availability remain hypotheses until production diagnostics are captured.

## Request paths and deadlines

This APK uses React/Capacitor WebView `fetch`, not Kotlin ViewModel/repository/OkHttp/coroutine inference wrappers. The four callers are `useAiAnalysis`, `StatisticsScreen`, `SmartCaptureCard` and `ReceiptScanCard`. Each calls `utils/api` → `AuthenticatedApiClient` → readiness → installation-signature auth → AI POST. Render's Express app applies ingress/cancellation/auth/quota/body validation → task route → `GeminiService` → the shared retry executor → JSON/schema/domain validation → response → UI validation/review. Image preparation precedes dispatch. No new timeout was introduced to conceal failures.

| Layer (applies to all four features) | Effective default / bound | Earliest termination and evidence |
| --- | --- | --- |
| Whole client operation | 270000ms | Includes readiness/auth/AI; caller abort can terminate earlier |
| Readiness, shared transaction | 90000ms total; 65000ms per GET; at most 24 tries | Offline/nonretryable response stops immediately; waking HTML is not readiness |
| Authentication, shared transaction | 30000ms total; 15,000 ms per HTTP call | Includes bounded registration/challenge/verify recovery; Neon failures are distinguishable |
| AI POST processing + response body | 115,000 ms shared across one explicit stale-token refresh | No ambiguous network POST replay; ignored abort/late body rejected |
| Server whole ingress/AI request | 90000ms; env clamp 15000–100000ms | Begins before JSON/body receipt; stalled partial upload and disconnect propagate cancellation |
| Provider attempt | 50,000 ms; clamp 5000–60000ms, also capped by remaining request budget | Watchdog/SDK abort ends an attempt; no SDK hidden retries |
| Retry executor | Two attempts; clamp 1–3; minimum 5000ms for another attempt | Refuses a doomed attempt; ingress, backoff and attempts share the total budget |
| Backoff | Base1000ms, clamp250–4000; exponential capped8000 before 0–50% jitter | Retry-After honored; daily quota stops, never shortened to fit a deadline |
| Neon pool | connect/query/statement5000ms; idle10000ms | Auth can fail before inference; no credentials exposed |
| Photos/media | Existing size/format/preparation guards and caller cancellation | Runs before API operation; no fixed inference timeout is imposed on photo preparation |
| Render/proxy/network | Operator/provider controlled | Current proxy limits and private runtime settings not observable; no invented values |

The active **30-second** value is authentication, not inference. The **50-second** provider watchdog remains intentional. No legacy 30/45-second inference ceiling was found in these four current paths. Old main and the integration branch differed; neither an observed45–50 seconds nor the source alone proves the phone's terminating stage. A warm request may fail immediately for invalid input/auth/configuration or at the provider watchdog, ingress deadline, network failure or explicit cancellation. Readiness time is measured separately from dispatch/provider time.

## Routing, correctness and retries

With no nonempty model/route overrides, all four tasks use `gemini-3.5-flash-lite` with LOW thinking, then distinct `gemini-3.8-flash` with LOW thinking. The second model is reachable within the same two-attempt budget; it is not guaranteed to have50 seconds remaining. There is no third-model chain or deadline increase. Explicit `GEMINI_MODEL`, fallback-model or task-route settings take precedence. In particular an existing Render `GEMINI_MODEL=gemini-3.8-flash` retains global Flash routing until an authorized configuration change. Deprecated global aliases canonicalize; explicit task aliases/duplicate routes and unreachable route lengths fail configuration. Distinct operator-specified fallbacks require the existing verified-model and quality-approval attestation.

The selected Lite model is accessible with the configured credential: actual model listing and generations succeeded. Google documents [Lite extraction/structured output support](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) and [3.7's alias behavior](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash). Current billing tier is not independently observable; historical owner Free-tier attestation is retained explicitly. No new paid service or uncontrolled traffic was introduced.

Transient408/429/500/502/503/504, supported transport failures and attempt timeouts may use one fallback. Retry-After and remaining budget govern eligibility. Daily quota, auth/configuration/unsupported-model errors, nontransient4xx, input/JSON/schema/domain-quality failures and cancellation do not retry. No provider retries create ledger records: extraction still requires user review/application and final manual save, with the existing duplicate-save guard.

**Statistics:** Gemini selects up to three existing observation IDs and three category IDs; unknown, duplicated, wrong-section, oversized or extra-field output fails closed. The server computes localized totals/count/average, category shares and tied ranks. Changes use the two latest supplied complete months; absent/zero-base data produces no percentage-change claim. Inbound numeric prose and supplied ranking/percentage claims are not copied from Gemini. The API response shape stays compatible. A successful response means AI selected verified facts; it does not mean Gemini authored financial reasoning. Invalid/provider failures continue the existing explicitly labeled deterministic local fallback. Local category totals/rankings remain independent of AI.

**Spending Analysis:** independent review demonstrated that numeric membership accepted invented transactions/totals/trends. The corrected route now uses the same verified-fact principle: provider selects at most three unique existing insight IDs; extra prose, unknown/wrong-section IDs and duplicates fail closed. Localized overview/history/category/comparison/recurrence/unusual-purchase facts derive only from the application summary. Comparisons state recorded amounts and warn of incomplete months rather than inventing a trend. Public response groups and existing labeled local fallback remain. Three additional bounded Lite LOW calls passed the corrected EN/FR/AR contract (842/851/817ms); the old free-prose gates are historical evidence only.

**Images:** existing structured schemas and domain sanitizers retain unknown/unsafe amounts and dates as uncertain/null and preserve currency safeguards. The editor keeps review/confirmation and encrypted recovery. Synthetic image success is not proof of arbitrary real-receipt OCR accuracy.

## Live evidence (opt-in, synthetic only)

Two initial batches of eight generation attempts, plus three corrected Spending Analysis fact-selection attempts: 19 total. Single attempt per probe,50,000 ms cap; metadata listing15,000 ms. Evidence contains only model/task, booleans, token counts, classifications and timing, never prompts/images/raw response/user financial data. Files: `WP36_LIVE_RESULTS.json`, `WP36_LIVE_LOCALES.json`, `WP36_LIVE_SPENDING_FACTS.json`. These are direct Google probes, not Render/end-to-end/device calls. EN tests preceded the final complete-month catalog enhancement; FR/AR used the enhanced catalog. Final routing defaults use the same qualified model/thinking setting; these are not exact deployed-commit receipts.

| Task | Flash EN | Lite LOW EN | Lite LOW FR | Lite LOW AR |
| --- | --- | --- | --- | --- |
| Analysis | 503,3641ms | pass1267ms | pass1313ms | pass981ms |
| Trends | pass7197ms | pass841ms | pass1329ms | pass932ms |
| Smart Capture | timeout50020ms | pass1549ms | pass1501ms | pass1387ms |
| Receipt | pass36538ms | pass1840ms | pass1805ms | pass1697ms |

All 12 initial Lite probes passed their then-defined gates; independent review found the old Spending gate inadequate, now replaced and revalidated by3 additional fact-selection passes. Flash-default passed 2/4. Flash probes omitted thinking while the fallback usesLOW: live Flash-LOW quality/performance is unverified; deterministic tests establish dispatch mechanics only. This is a small repeated synthetic fixture across languages, not a diverse real-photo corpus, production reliability percentile or an assurance of future free-tier availability. Deterministic tests establish fallback mechanics; these probes do not establish live failover reliability under all overload conditions.

## Deployment compatibility and Gate B runbook

The existing private2.1.1 / code 11 receipt (`artifacts/wp35-private-apk-38141990211/build-receipt.json`) records Android source `066d55166a6a6b96aa0d3a7fc4e3d2759ffd0ba8`, API URL `https://spendwise-api-v9sv.onrender.com`, APK SHA256 `dd4696f0a49cd613fb7d1df0282952f4f13fa37b34f2a8a91442d9e731610db7`, signer `e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965`. The repository's nonsecret API URL variable matches. This proves receipt metadata, not which APK is currently installed. Prior WP35 deployment notes said Render followed main and durable-auth cutover was pending. Current Render branch/env/Neon configuration is inaccessible in this session. GitHub deployment records and commit statuses did not establish a Render SHA. The observed health contract had no version.

After explicit integration/deployment authorization:

1. Inspect Render's deployed branch and immutable commit, and verify it contains WP35 durable auth/readiness/budgets plus WP36. Review private environment locally without printing secrets. Preserve required durable PostgreSQL store on Render, signing and HTTPS. Confirm effective model overrides deliberately rather than assuming code defaults are active.
2. Request `https://spendwise-api-v9sv.onrender.com/api/health` with a bounded120second client timeout. Expect existing fields plus `version` equal to the first12hex of Render's deployed commit. `RENDER_GIT_COMMIT` must be40hex; malformed values return `unknown`; missing local development returns `local`, missing Render revision returns `unknown`. `X-Backend-Version` also appears on API responses and is CORS exposed. See [Render runtime variables](https://render.com/docs/environment-variables).
3. Check that the installed APK/build receipt points to the intended HTTPS API URL and retains the established signing certificate/update compatibility. Android and backend source SHAs need not equal; confirm required functions and compatible request/response contracts instead.
4. On a physical device test all four features warm and after Render idle, EN/FR/AR, transient failure/retry, cancellation, draft/restart recovery and final save. Verify optional descriptions blank/custom/final category; History/search/category statistics and encrypted backup/restore. Use synthetic data; do not export private receipts to diagnostics.
5. Correlate client requestId/feature/stage/backendVersion with API duration and provider attempt model/attempt/fallbackUsed/retry/classification/timeoutStage/remaining budget. Distinguish readiness, auth/Neon, dispatch, overload/quota, malformed/quality failure and cancellation. Existing logs remain bounded (server10/tag/minute and bounded diagnostic retention); space single-device probes to avoid suppression and record suppressed counts. Network failures before response may lack a confirmed version.
6. Record actual deployed commit, APK receipt, device/OS, test outcomes and diagnostics. Gate B stays NOT YET VERIFIED until these pass. No staging or hosting dependency was created.

## Expense behavior and regression coverage

Only the manual save boundary resolves `descriptionText.trim() || getLocalizedCategoryName(selectedCategory, language)`. Raw blank draft remains blank, final selected category/current language decide fallback, stable categoryFood displays Food & Beverage. Custom/edit values survive, language changes do not rewrite stored records. Amount/category, encryption, storage schema, backup and save guards remain. EN/FR/AR label/helper indicate optional input; themes/layout retained.

Added tests: `wp36-deployment-diagnostics`, `wp36-routing-matrix`, `wp36-statistics-quality`, component/browser `wp36-description`. Updated existing health/default-route/native-console/accessibility expectations while preserving security assertions. Four-task executor/service tests cover immediate/transient success,408/429/500/502/503/504/network, malformed/auth/configuration, cancellation and insufficient budget. Existing WP35 tests supply hung-attempt/overall deadline, readiness/shared auth, partial body ingress, offline/body-read/cancellation, Retry-After/quota and local fallback/recovery evidence. Added actual receipt/capture route tests supply missing/unreadable/ambiguous/currency/invalid-structured result checks; they do not pretend mocks prove physical OCR. Component tests exercise EN/FR/AR/finalcategory/custom/edit/Food/doubleclick. Browser test exercises failedAI/retry/blankdraft/restart/single save/History/search/statistics/encryptedbackup roundtrip. Existing encrypted local storage, native recovery and tab continuity gates remain required.

## Validation receipts and changed files

Local Node22v22.23.3: `node --import tsx --test tests/*.test.ts` →547 passed,0 failed,1 isolated DB skip; `npm run verify` →passed (existing Vite large-chunk warning). `git diff --check` →passed. Local UI before review fixes:44 components,74 browser,3 accessibility,8 visual passed. WP33 browser:10 datasets passed; diagnostic/benchmark gate passed all 5 sizes / 25 operations each. Final UI rerun after fixes:44 components,75 browser,3 accessibility and8 visual passed. RealPostgreSQL/Android unit/lint/debug/release-compilation/emulator CI: pending receipts. No local Java/Android SDK was available, so no local native build is claimed. Existing workflows are reused; the combined workflow gains the integration-target PR trigger, exact head checkout, and unit/lint/release-source compilation alongside debug build. Private signed artifact branch gate, signing, certificate and release workflow are unchanged. Release source compilation is not a signed release APK.

Changed implementation groups: `server/{deploymentVersion,config,taskRouting,geminiReliability,prompts}`, health/analysis/trends routes, GeminiService, request/schema helpers, existing CORS/logging/observability; client authenticated transport/API/errors/diagnostic allowlists/translations; AddEditExpenseModal; existing live probe; focused tests and existing integration workflow. Exact file manifest: `git diff --name-only 622c2dafc100c6cfcc3fff8ed8f3d053c2647f14..HEAD`. No dependency/DB migration/native signing files change.

## Remaining risks and required decisions

| Severity | Issue | Impact / action |
| --- | --- | --- |
| High, release gate | Actual Render revision/env and physical acceptance unverified | Old backend may retain failures; complete Gate B after authorized deployment |
| Medium | Narrow model qualification and provider availability/free quotas | Cannot promise consistent production latency; preserve deadlines/fallback and validate device cases |
| Medium | Flash-LOW exact fallback has no live qualification in this run | Flash-default samples are historical evidence only; bounded retry mechanics and financial fact selection are deterministic, broad availability/OCR still needs device evidence |
| Medium | Real image ambiguity/incorrect confident OCR remains possible | Explicit review/confirmation required; test realistic photos on device |
| Low | Bounded server logs may suppress bursts; version can be unavailable before response | Space diagnostic probes and inspect suppression; never infer a deployment SHA from absent metadata |
| Low | Existing large web bundle | Build succeeds; unrelated optimization deferred |

Final merge approval is required only after Gate A's actual checks and independent review are recorded. No production/device green claim is permitted from this document alone.

## Independent review and fix evidence

Fresh reviewer examined immutable622c2da..37d8753. Critical:none. Important1: numeric-membership Spending qualification could accept fabricated claims. Important2: malformed HTTP 200 diagnostics lost correlation and recorded premature success. Both reproduced RED, corrected and GREEN: `wp36-spending-quality` and browser `malformed HTTP200 keeps one correlated final failure instead of reporting operation success`. Completion metadata now survives JSON parsing, records one final failure and preserves request/version/feature/stage/duration. No second review substitutes for these regression proofs.

Minor deferred: Flash-default probe does not qualify exact LOW fallback. Documentation distinguishes this; no extra provider calls were made for that minor. Reviewer declined CI/native/runtime/device/external-doc verification; these remain actual evidence gates here, and do not block read-only code review from evaluating contracts. Final source retains deterministic facts and explicit extraction review regardless of provider model.

| Feature | Backend task and result boundary | Earliest configured AI-stage deadline |
| --- | --- | --- |
| Spending Analysis | `analyze`; verified spending fact IDs → existing insight groups | Provider attempt 50 seconds, reduced by ingress budget |
| Statistics | `explain-trends`; verified catalog IDs → deterministic localized facts | Same shared watchdog/budget |
| Smart Capture | `smart-capture`; schema + visible-price/currency sanitizer → editable draft | Same shared watchdog/budget |
| Receipt Scanner | `scan-receipt`; schema + final-total/currency/date guards → editable draft | Same shared watchdog/budget |

These are AI-stage limits after readiness/authentication. Invalid input/auth, offline transport or cancellation may terminate any feature earlier.
