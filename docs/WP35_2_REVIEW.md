# WP35.2 review checkpoint

Branch: `wp35-02/gemini-runtime`. Implementation commit: recorded below after verification.
Base: live-verified main `7d00b2dafadf829f63d2b6074b08d08c00ca352d`; WP34 PR41 merged at `cfc9c954fe51242fbc22f62da9f5b3bfaae8ce49`.
WP35.1 inspected read-only at `c19a960ff49a18ebfc2f2eab1ccba45c16476402`, open draft PR45. No WP35.1 merge/cherry-pick; no WP35.3 implementation.
Authority: entire approved `docs/SpendWise_WP35_Implementation_Plan.md` plus the supplied WP35.2 objective.

## Decisions and runtime contract

- Default backend AI operation: **90,000ms**, beginning at AI HTTP ingress, including upload/body parsing and validation. `performance.now()` provides one shared monotonic deadline; provider attempts inherit the remaining time. A watchdog aborts the provider, and expired/late output is rejected before acceptance.
- Default per-provider attempt: **50,000ms**, capped by remaining operation time. Default **two provider attempts globally**, including fallbacks, instead of two attempts per model. A timeout can consume only one further eligible attempt. With the unchanged three-model list and two-attempt default, only the first two models are reachable. Selecting a different verified fallback requires explicit backend configuration; nothing silently routes to Lite.
- Client AI processing: **115,000ms** across both dispatches if an explicit stale-token rejection permits one refresh. The timer includes response-body download. Client overall bound: **270,000ms**, allowing WP35.1 readiness 90s + auth 30s + one refresh 30s + total dispatch 115s + 5s margin. These are bounded tuning values, not an SLA.
- Retry only eligible 408/429/5xx, provider timeout and classified network faults. Exponential delay starts at 1s, adds up to 50% jitter, and is bounded. Honor the larger of backoff and HTTP `Retry-After` / Google structured `RetryInfo`; never shorten provider guidance to fit the deadline. Require at least 5s remaining after the delay. No retries for daily-quota evidence, invalid credentials/requests/schema, content blocks or cancellation.
- Classify upstream 504 as timeout; retain upstream status. Separate network faults (`AI_NETWORK_ERROR`), daily quota (`AI_QUOTA_EXHAUSTED`), transient 429, provider outages, processing deadline and cancellation. A 429 is called daily quota only when provider error evidence names a daily/per-day quota. Unknown detail stays temporary rate limit; no invented reset time.
- Existing rate/auth guards remain ahead of request parsing. No ambiguous failed client AI POST is retried. Only an explicit `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED` or `API_UNAUTHORIZED` 401 permits one authenticated resend; the processing/overall budgets do not reset.
- Cancellation reaches client fetch/body handling, server disconnect context, SDK `abortSignal`, and retry timers. Existing generation checks reject stale results. Protected drafts, explicit Apply, verified local spending/trend fallback and `isAiGenerated` distinction remain in place. Retained-screen work continues across simple tab changes as designed; context invalidation, reset and unmount cancel it.
- JSON Schema validation now precedes the existing route sanitizers, which remain authoritative for financial safety. Only the keywords used by the existing schemas are accepted; unsupported schema keywords fail closed.
- Logs contain allowlisted request correlation, task route/model, attempt/operation durations, remaining time, retry decision/delay, upstream status, network class and numeric usage counts when returned. Existing bounded logging and credential/content guards are retained. No provider error object, raw prompt, image, credential, signature or financial body is logged.

## Backend configuration

| Setting | Default / allowed bounds |
|---|---|
| `BACKEND_HOST_PROFILE` | `render_free` when `RENDER=true`, otherwise `always_on`; only those two values |
| `GEMINI_RUNTIME_PROFILE` | `free`; `standard` also accepted, with the same conservative bounds |
| `GEMINI_OPERATION_BUDGET_MS` | 90,000; clamp 15,000–100,000, always below the 115,000 client limit |
| `GEMINI_TIMEOUT_MS` | 50,000; clamp 5,000–60,000 and operation budget |
| `GEMINI_MAX_ATTEMPTS` | 2; clamp 1–3 globally |
| `GEMINI_RETRY_DELAY_MS` | 1,000; clamp 250–4,000, exponential/jitter thereafter |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODELS` | Existing defaults retained: `gemini-3.8-flash`, then `gemini-3.7-flash,gemini-3.5-flash-lite` |
| `GEMINI_TASK_ROUTES` | Off by default; JSON task -> `{models, thinkingLevel?}` |
| `GEMINI_VERIFIED_MODELS` | Explicit project-verified allowlist required for any task override |
| `GEMINI_ROUTING_QUALITY_APPROVED` | Must be exactly `true` after representative quality gates pass |

The four route keys are `smart-capture`, `scan-receipt`, `analyze`, `explain-trends`. Explicit thinking supports documented `low`/`high` combinations only, with a separate known-model allowlist rather than a model-name-prefix assumption. The operator must verify each model/task/thinking combination and archive its quality evidence before attesting approval. No task override is enabled by this checkpoint.

Host and Gemini quota upgrades are independent. Profiles do not purchase resources or automatically change model routing, quotas, authentication or durable storage. Backend-only settings require a normal later approved backend configuration update/restart, not an APK reinstall or reverting UI/security work. Keep WP35.1 external identity/revocation storage mandatory on Render under both host modes. Do not deploy this branch in isolation as a replacement for WP35.1 durable auth.

## Actual Google verification — 2026-10-10

Windows user and inherited process credentials initially differed. The inherited value received `API_KEY_INVALID`; the user copy was not header-safe and later absent. The user supplied a valid credential through a temporary Git-ignored `.env`. It authenticated successfully, was transferred to Windows **User** `GEMINI_API_KEY`, verified without showing its value, and the temporary file was removed. No credential is committed or included in evidence.

Account-tier evidence: the user explicitly confirmed **Google AI Studio Free tier**. The API model list does not independently prove account billing status or per-project RPM/TPM/RPD limits. No billing/account settings were changed.

Live `models.list` returned all three configured names with `generateContent` support. Google official documentation lists free-tier standard input/output for 3.8 Flash and 3.5 Flash-Lite, and documents low thinking for both. 3.7 Flash was project-listed; its generation quality and explicit thinking parameters were not tested, so no thinking override for it is enabled.

The capped comparison made **10 generation requests, one attempt each**, with a 50s per-request bound, two locally drawn synthetic OCR images and synthetic financial summaries. It captured the actual current route prompts and schemas without contacting Render. No real expenses/photos were transmitted; no production endpoint or environment was changed. Sanitized evidence: [WP35_2_LIVE_RESULTS.json](WP35_2_LIVE_RESULTS.json).

| Task | Flash default | Flash low | Flash-Lite low | Lite usage: input/output/total |
|---|---|---|---|---|
| Spending Analysis / Smart Flags | 503, 884ms | 503, 1,663ms | 1,007ms; JSON/schema/financial smoke gate pass | 738 / 137 / 875 |
| Statistics Trend Insights | 504, 49,728ms | 504, 49,446ms | 1,445ms; JSON/schema pass, strict numeric gate **failed** | 819 / 196 / 1,015 |
| Smart Capture | 504, 49,654ms | Not requested | 2,424ms; visible USD 12.50 extraction gate pass | 1,646 / 86 / 1,732 |
| Receipt Scanner | Client 50s bound, 50,009ms; no upstream status | Not requested | 3,518ms; USD 6 total, merchant/date/item OCR gate pass | 1,783 / 119 / 1,902 |

Thinking-token counts were not returned for the four Lite responses; unavailable is not zero. Flash produced no usable response/usage. The initial probe classified upstream 504 as temporary unavailability and its SDK abort as generic failure; the evidence file retains those original labels. Production classification was then repaired with a failing/passing 504 regression, and the probe now records its timeout signal explicitly. The table interprets the recorded HTTP status/known client watchdog without inventing missing upstream details.

Decision: **do not enable candidate routing**. One fixture per feature is smoke evidence, not a representative OCR accuracy certification; multilingual, ambiguous-currency, poor-photo and rounding cases remain unverified. The strict trend numeric gate failed, and raw model output was intentionally not retained, so it does not establish which value differed or whether formatting/rounding explains it. Do not call it a proven hallucination. No more live calls are needed at this checkpoint. The existing routing is preserved, but Flash generation health/quality could not be established during this window.

Official sources checked live:
- [Models](https://ai.google.dev/gemini-api/docs/models)
- [Thinking and supported levels](https://ai.google.dev/gemini-api/docs/thinking)
- [Standard free-tier pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Retry troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting)
- [Project-specific rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

## Verification and integration

- RED/GREEN evidence in local ignored `artifacts/wp35-*.log`: global attempt cap; shared/ingress deadline; hung provider; 503/429; provider guidance; network drop; invalid schema/auth/policy; cancellation and late results; duplicate gate; body-download timeout; explicit stale-token refresh; unsafe thinking combinations; privacy-safe diagnostics. Existing security logging assertions were retained unchanged. Existing tests were updated only where the approved runtime defaults/retry contract intentionally changed.
- Local focused runtime/security/encryption/backup suite: **130/130 passed** (`npm run test:wp35:runtime`). TypeScript and production Vite build passed; Vite's existing large-chunk warning remains.
- Browser/visual/accessibility: initially blocked by absent pinned Chromium, not product behavior. Dependency installation and remaining verification are in progress; final status will be recorded before checkpoint handoff.
- CI: new `WP35 Gemini Runtime` workflow runs the focused suite, TypeScript/build and existing WP32 browser/visual/accessibility suites, without Gemini credentials/live generation. CI result will be recorded below.
- No production backend smoke, deployment, real idle-to-wake Render test, signed APK, Maestro run or physical Android acceptance is claimed. Full Maestro/device/combined integration QA remains deferred until all WP35 branches are ready.

WP35.1 integration must retain its single-flight readiness/authentication, exact unknown-installation recovery and durable revocation handling. Resolve `server/config.ts` by combining this runtime configuration with WP35.1 auth-store enforcement, retaining one host-profile field. Resolve `AuthenticatedApiClient.ts` by preserving WP35.1 cancellation-aware transport and entire auth transaction: apply this branch's shared processing budget across both sends and body read; reuse the operation's incoming correlation ID instead of generating another ID. Its existing provider-correlation service changes are subsumed by this branch's attempt telemetry. The new AI context reuses `res.locals.requestId`, so do not add another correlation generator. Combined integration tests must confirm one correlation ID across readiness/auth/dispatch/provider/disconnect.

WP35.3 may consume the real operation/attempt signals and stable errors for stage UI. This branch changes no progress UI, safe-area behavior or automatic saving. Keep the existing JSON response contract; explicit Cancel must invalidate the generation before aborting.

Reproduction of the bounded live probe (only with explicit fresh authorization; do not rerun by default): generate fixtures using `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/wp35-synthetic-images.ps1`, reload the Windows user credential into the shell process without printing it, then `npx tsx scripts/wp35-gemini-live.ts --run-synthetic-free-tier`. The process-only PowerShell policy override applies to that reviewed fixture script, not machine policy.

Execution decisions: reuse the clean checkout and requested feature branch; preserve model defaults when evidence is insufficient; cap all attempts globally; add ingress accounting to prevent budget reset after parsing; keep token-usage counts in a dedicated numeric-only logger so existing failure-log security assertions remain intact. If these conservative routing choices are wrong, the cost is missed optimization/continued provider outages, not unverified financial output.

Final independent review, CI receipts and changed-file manifest: pending checkpoint verification.
