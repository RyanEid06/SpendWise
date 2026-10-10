# SpendWise WP35 — Gemini Reliability, Honest AI Progress UX & Safe-Area Fix

**Status:** Implementation plan only; no code changes.  
**Baseline:** Uploaded `SpendWise-main (1)(2).zip`, version 2.1.0, Oct 9 snapshot; reconcile with current `main` after WP34 is merged before creating branches.  
**Deployment:** Render Free web service, `https://spendwise-api-v9sv.onrender.com`; Google AI Studio Gemini API; GitHub Actions.  
**Scope:** All four AI features: Smart Capture, Receipt Scanner, Spending Analysis / Smart Flags, Statistics AI Trend Insights. Also Add/Edit Expense modal safe areas.  
**Non-goals:** No changes to encryption, expense storage, backup schemas, identity signing algorithms, release signing, or the security threat model without explicit review. No fake progress percentages, no periodic keep-alive workaround, no new paid subscription.

## Verified evidence and architecture facts

- Render Free sleeps after 15 minutes without inbound traffic and generally takes about a minute to restart. Render Free service files disappear on restarts, redeploys, and spin-down.
- Backend `server/config.ts` defaults Gemini timeouts to 22,000ms and clamps to 40,000ms. Models default to `gemini-3.8-flash`, then `gemini-3.7-flash` / `gemini-3.5-flash-lite`.
- `server/geminiReliability.ts` flags `AI_TIMEOUT` as non-retryable, while 503 temporary unavailability is retried; sequential model attempts can outlive Android's deadlines.
- `src/security/AuthenticatedApiClient.ts` sends registration/challenge/verification requests with independent 15-second deadlines. Sessions expire after 10 minutes. An `UNKNOWN_INSTALLATION` server event occurred in supplied logs.
- Android client timeouts: 30s `src/app/hooks/useAiAnalysis.ts` and `src/screens/StatisticsScreen.tsx`; 45s `src/components/SmartCaptureCard.tsx` and `src/components/ReceiptScanCard.tsx`.
- Render logs: `AI_TIMEOUT` occurred 10:32:16 and 10:32:52, `AI_TEMPORARILY_UNAVAILABLE` occurred 11:13–11:15. Aggregate window showed 10 Gemini provider attempts, 2 successes, 8 failures; one unknown installation; two aborted API requests. Search hits like `AI_TIMEOUT: 0` may be counters rather than errors. Detailed upstream status still requires structured telemetry.
- Observed frequent `/api/health` requests in aggregate logs. Thus Render sleep is a first-request risk, NOT demonstrated to be the sole cause of failures in the captured warm period.
- Backend auth registry defaults to local `.spendwise-security/installations.json`; it must not be the only durable source of public-key identities and revocations on Render Free.
- Add/Edit modal is in `src/components/AddEditExpenseModal.tsx`; outer positioning uses visual viewport `height` and `top`, without modal-specific native status/navigation safe-area padding.

## Sequential delivery policy

Treat these as **three sequential PRs**, all based on the real current `main` after confirming WP34 merge/freeze: `wp35-01/render-auth-recovery`, `wp35-02/gemini-runtime`, `wp35-03/ai-progress-safe-area`. Merge each only when its dedicated tests and existing regression gates are green. Do NOT release an official APK between PRs. WP35.3 final integration builds one signed candidate with existing keystore, deploys updated backend, then tests on the real phone. If existing WP34 is not complete, do not overwrite it or create conflicting final-release branches.

## WP35.1 — Render readiness, security recovery, durable identities (P0)

**Goal:** Recover after a cold start or restart without weakened authentication or lost revocation state.

**Changes**

1. Implement an on-demand, **single-flight readiness check** for explicitly user-initiated AI operations, with a bounded cold-start deadline (initial tuning target 75–90s), short retries with exponential backoff/jitter, and a clear abort path. An `/api/health` 2xx confirms server readiness only; do not claim Gemini itself is available yet. No global background keep-alive pings.
2. Distinguish secure session acquisition from AI processing in the client. Bound the **entire authentication transaction**, not just each 15-second subrequest. Retry network/timeout/5xx failures carefully. Re-register only after explicit `UNKNOWN_INSTALLATION`/equivalent server response, not after any temporary network failure. Never skip signing or verification.
3. Make installation public-key identities, fingerprint mapping, and revocation state durable **outside Render's ephemeral filesystem**. Evaluate a small secure external Postgres store (Neon Free is one candidate; verify current limits, provider fit, connection/pool security, and backups). Do not use Render Free Postgres with automatic expiry or an ephemeral KV as the only durable auth store. Implement an interface/adapter to avoid leaking database code into auth logic. Data migration/re-registration must preserve deny/revocation semantics. Database connection URL remains Render backend secret only.
4. Add privacy-safe phase/error telemetry with request correlation IDs: readiness, register, challenge, verify, AI dispatch, and client disconnect; no images, expense contents, API keys, bearer tokens, full installation identifiers or signatures.
5. Add fault-injection tests for 60s slow first response, rapid auth after readiness, expired tokens, Render restart with prior IDs, unknown installations, concurrent requests (single flight), DB unavailable, cancellation, and revoked installation denial.

**Acceptance gate:** Security tests green; cold-start recovery eventually reaches authorized AI dispatch; re-registration does not loop; identities and revocations survive backend restart; the app never bypasses auth; documented minimal safe credential setup and rollback. External database setup by the user is a deployment prerequisite, not something Codex can silently invent.

## WP35.2 — Coordinated Gemini processing budgets / free-host profile (P0)

**Goal:** No mobile AI request abandons a backend that is still legitimately processing, and temporary upstream failures are handled with limited safe retries.

**Changes**

1. Replace unrelated request deadlines with named, measurable stages: backend readiness, auth, and AI operation. Start by benchmarking an **AI wall-clock budget near 90s**, **per-model max around 45–60s** (raise server max clamp), and **client processing deadline modestly longer than server budget** (~105–120s). Define a separate upper end-to-end bound including Render cold start and auth; do not make users wait forever. Log actual milliseconds and compare client/server abort correlation. **These are initial test values, not an SLA.**
2. Add a monotonic shared deadline across all Gemini attempts and fallback models. Enforce max model attempts, rate guards, and remaining-time checks. `AI_TIMEOUT` may allow one alternative model or retry if budget remains, but avoid repeated slow requests that blow free API quotas. Honor Google recommended exponential backoff and jitter for transient 408/429/5xx; differentiate temporary per-minute 429 vs exhausted daily quota where discernible. Do not retry invalid keys, 400/schema errors, or content policy blocks.
3. Examine actual `AI_TEMPORARILY_UNAVAILABLE` upstream status/net-error class via sanitized telemetry. Avoid mislabeling a network fault as user quota failure. Keep verified local spending/trend fallback.
4. Add **server-side model routing and thinking levels by task**, guarded by config: evaluate low thinking for text analysis/trends on Flash, and benchmark Flash-Lite for simple work. Keep accuracy-first validation for receipt extraction and Smart Capture. Compare live JSON validity, financial values, OCR precision, latency, provider attempt count, and token usage with representative test fixtures. Do not assume a smaller model is automatically better for images. Do not expose key or raw prompts in logs.
5. Maintain idempotency/re-entrancy protections across client Retry, Cancel and navigation changes; do not auto-save AI findings. Ensure cancellation releases resources when technically supported and late server responses cannot overwrite newer results.
6. Make host and provider modes **configuration-based**, e.g. `BACKEND_HOST_PROFILE=render_free|always_on` and `GEMINI_RUNTIME_PROFILE=free|standard`, with bounded documented settings. Upgrading hosting and upgrading Gemini quotas are independent decisions. No source rollback or APK reinstall is required just to change backend config. Do not remove security or durable storage when upgrading.

**Acceptance gate:** backend enforced time budget < Android processing timeout; test timeout, 503, 429, network drop, schema-invalid, stale token, late response, explicit cancel; low-thinking/multimodal candidates pass quality gates; instrument actual first-attempt latency and fallback. Run a SMALL set of live requests to avoid free quota exhaustion.

## WP35.3 — Honest progress UX + Add Expense safe areas + integrated release QA (P1)

**Goal:** User always knows the real current operation and can safely exit, retry, or use a local result. UI never overlaps OS bars.

**Recommended UX pattern: ONE stage-aware panel and ONE subtle indeterminate bar**

- Examples of stage text *only when verified*: `Preparing photo…` (client local), `Connecting securely…` (readiness/auth), `Sending to AI service…` (request dispatch), `Gemini is analyzing…` (after confirmed backend handling), `Checking the result…` (after response), `Ready to review` (after parsed validation). For analysis without a photo, skip photo stage. When backend can emit real coarse progress events (e.g. model retry), display `Trying an alternative model…`; do not invent this status based on elapsed time.
- When the server does not provide exact task completion data, **never fabricate a 0–100% bar** or a predicted completion time. Use an animated indeterminate horizontal bar plus stage heading, elapsed seconds if valuable, and a calm explanation after an extended wait (e.g. `The AI service is taking longer than usual. Your draft is safe.` when draft safety is confirmed).
- Keep panel within existing card/modal (not a full-screen blocker), primary SpendWise emerald accent with feature-specific cyan/purple details and existing dark/light token colors. Text remains readable in French, English and Arabic RTL. Accessible live status announcements without excessive repetition; respect reduced-motion preference.
- Provide sensible Cancel and Retry affordances, with no duplicate submissions and no discarded protected expense draft. Preserve local-analysis fallback distinction from generated Gemini output; don't make local insights look like a live Gemini success.
- If progress events require backend streaming, only adopt after confirming they behave on Render Free/Capacitor; keep existing JSON response behavior or compatible fallback, and do not implement unnecessary polling that amplifies free-tier costs. Client-observable transitions are a sound minimal first version.

**Add/Edit Expense layout**

- Keep the large modal visually similar to current design, but **inset it below the status-bar/cutout and above three-button/gesture navigation**, with ~12–16 CSS px extra breathing room; do not hardcode actual device system-bar sizes.
- Handle Android SDK 36 edge-to-edge and correct native WebView inset propagation. Inspect installed Capacitor version and existing safe-area CSS; do not double-apply padding if native has already consumed insets. `visualViewport` must also adapt when keyboard opens.
- Header/title, Save/Cancel footer, scrollable form, scroll-to-focused-input, close/back, long translated text and nested photo tools must remain reachable. Change Add/Edit dialog only unless measured test evidence shows shared wrapper needs a targeted correction.

**Testing and delivery gate**

- Unit tests for UI state-machine stages, timeout/abort and result guards, auth/retry/fallback; Playwright for loading/fallback, screen-reader labels, no fake percentages, RTL, dark/light, draft preservation, modal keyboard behavior; Maestro or device checks for Android with 3-button and gesture nav, keyboard, portrait/landscape if supported, status bar/cutout.
- Simulated backend cold start (delay 60+ sec), service restart, token expiry after 10+ minutes, network loss, Gemini 503 and 429; one actual 15+ minute idle-to-request Render Free test, if `/api/health` polling is not currently keeping it alive. Do not assume sleep merely because 15 minutes passes if health probes keep the service warm.
- Real phone: Smart Capture, Receipt Scanner, Spending Analysis and Trend Insights; inspect logs to show routes reached and final result/error; no duplicate expense, no dropped draft. Distinguish simulator tests from actual Google API behavior.
- CI: TypeScript/build, existing security suite, WP32 browser/visual/accessibility, WP33 diagnostics/reliability, Android build, relevant Maestro suites. Deploy backend and smoke test authenticated routes. Test one signed APK with the permanent keystore and an **in-place update** on the user's device. Main and release flows only after sign-off; no silent version bump or tag.

**Release criteria:** All tests green; all four features function when provider is available; cold-start and temporary failures resolve gracefully or yield truthful recoverable errors; strong security unchanged; keyboard and system bars never cover controls; the app makes no false success or progress claims. Logs carry enough sanitized evidence to diagnose any remaining external Gemini outage.

## Free-to-paid migration contract

**Render Free -> Render paid:** Set `BACKEND_HOST_PROFILE=always_on`, remove cold-wake waiting if appropriate after verification, but retain failure handling. Paid Render does not automatically make ephemeral auth storage durable; keep external DB or deliberately add a correctly mounted paid persistent disk with tested migration.

**Google API Free -> Paid Gemini API:** Set `GEMINI_RUNTIME_PROFILE=standard`, choose tested routing/thinking limits; keep global deadlines/retry guards. No need to revert UI progress, security, cancellation or fallback logic. Upgrading the Gemini API account does not eliminate Render Free sleeping if Render remains Free.

## Sources

- Render Free limitations: https://render.com/docs/free
- Gemini retry troubleshooting: https://ai.google.dev/gemini-api/docs/troubleshooting
- Gemini model reasoning configuration: https://ai.google.dev/gemini-api/docs/thinking
- Gemini tier-specific limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Android progress guidance: https://developer.android.com/develop/ui/compose/components/progress
- Android window inset guidance: https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets
- Nielsen response times: https://www.nngroup.com/articles/response-times-3-important-limits/
- Tourangeau, Conrad & Peytchev (2010) empirical progress study: https://academic.oup.com/iwc/article-abstract/22/5/417/688424
- Harrison et al. progress-bar study: https://www.chrisharrison.net/index.php/Research/ProgressBars
