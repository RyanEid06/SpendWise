# WP38-C — Gemini reliability implementation evidence

Current integrated outcome: all required exact-source CI and independent private2.1.4/code14 APK checks passed at `732065e5455ca4de734d4982a662c2819fdd01af`; [final report](WP38_REPORT.md), [artifact receipt](WP38_PRIVATE_APK.md). Historical local/pending statements below describe their recorded checkpoint. The owner reported the tested 2.1.4 build all working on 2026-10-14 and authorized public publication; [public receipt](WP38_PUBLIC_RELEASE.md). Exhaustive device coverage and Render/live-provider verification remain separate and unverified.

Date: 2026-10-14. Branch: `codex/wp38-auth-gemini-reliability`. This packet covers the local Gemini work only; the parent WP38 report owns full-suite/CI, signing, Android and release acceptance evidence.

## Scope and routing status

The owner explicitly deferred **all Render/live checks**. No live Gemini calls, Render inspection, environment changes, model changes, production deployment or publication were performed. Effective production routing, availability, quotas and the owner's original intermittent response remain **UNVERIFIED**. The code defects below do not establish the cause of an earlier physical-phone/provider failure.

`parseServerConfig({})` was exercised with an empty synthetic environment. Its source defaults for **each** of `smart-capture`, `scan-receipt`, `analyze`, and `explain-trends` are:

| Setting | Locally verified source default |
| --- | --- |
| Primary | `gemini-3.5-flash-lite` |
| Distinct fallback | `gemini-3.8-flash` |
| Thinking | `low` |
| Backend operation budget | 90,000 ms |
| Attempt timeout | 50,000 ms |
| Total attempt limit | 2 |
| Client AI processing timeout | 115,000 ms, unchanged |

Existing explicit-route parsing requires quality approval and verified-model membership, rejects deprecated aliases/duplicates and unreachable model chains. Existing global distinct-model overrides also require verification. Those checks, cold-start/readiness behavior, rate/admission limits and budgets are unchanged. Production overrides may differ from these defaults.

## Confirmed root causes and changes

1. `AI_INVALID_RESPONSE` was non-retryable even when a qualified distinct route existed. `GeminiService` now opts its configuration-qualified routes into one invalid-output recovery attempt. `geminiReliability.ts` permits that attempt only after the first request, on a different configured model, within existing attempt/deadline limits. After this recovery no further chain is possible, even when the separate transient cap is configured as three. Ordinary/generic executors retain their existing non-retryable invalid-output behavior. Content blocking, permanent authentication/configuration errors, daily quota, cancellation and expired budgets never recover. JSON parsing, strict schema and task-specific financial validation are unchanged.
2. Quota exhaustion previously disabled only progress-panel Retry; primary buttons and handlers could dispatch again. `useAiRetryPolicy` now provides a shared context-local latch, synchronous handler guard, visible enabled state and provider `Retry-After` expiry. No provider reset timezone is invented. Existing valid context resets (month/expenses/currency/language/period or new photo/reset selection, as applicable) release a latch without retry guidance. Cancelling alone does not clear known quota. EN/FR/AR reasons continue through `getAiErrorMessage` and existing translation keys.
3. Spending Analysis summary/fallback and Statistics fallback preparation ran before `try`; a thrown calculation left operation/loading/in-flight state active. Preparation now executes inside the protected operation scope. Failure before a complete fallback sets recoverable error progress and always releases the request/loading gate. Spending Analysis also protects fallback cache writes; a throwing write cannot leave active progress or publish an incomplete result. Existing cancellation/current-generation checks still run before any fallback/cache publication.
4. Smart Capture and Receipt Scanner cleared a previously valid extraction at each request start. They now retain that result and its photo through a failed/quota request. Context/new-photo/reset actions retain their existing invalidation behavior, and applying a result remains disabled while analysis is active.

Existing sanitized attempt telemetry now reports invalid-output `willRetry`, exact alternate model and final outcome correctly; existing request correlation and provider usage logs remain intact. No prompts, finance/image data or secrets were added to logs.

## Changed files owned by this work

- `server/geminiReliability.ts`
- `server/services/GeminiService.ts`
- `src/app/hooks/useAiRetryPolicy.ts`
- `src/app/hooks/useAiAnalysis.ts`
- `src/screens/StatisticsScreen.tsx`
- `src/screens/AiInsightsScreen.tsx`
- `src/components/SmartCaptureCard.tsx`
- `src/components/ReceiptScanCard.tsx`
- `tests/wp38-gemini-reliability.test.ts`
- `tests/wp35-runtime-observability.test.ts`
- `tests/e2e/components/wp38-gemini.html`
- `tests/e2e/components/wp38-gemini-harness.tsx`
- `tests/e2e/components/wp38-gemini.spec.ts`
- `docs/WP38_GEMINI_REPORT.md`

No versions, workflows, translations, authentication/security implementation or shared progress ledger were edited by this work.

## Fail-first evidence and assertion compatibility

- New provider suite initially: **7 cases, 4 passed / 3 failed**. Malformed JSON and strict rejected output immediately raised `AI_INVALID_RESPONSE`; the intended distinct alternate was never called. The bounded executor fix turned those cases green.
- The corrected browser reproduction demonstrated **eight quota-action failures** (all four surfaces, context reset/provider retry guidance) and **three hanging local-preparation failures** before the UI fixes. The same initial run also had unrelated trace-output collisions and a cancellation fixture timing problem; those are not claimed as product defects. The cancellation fixture now holds its synthetic response until explicitly released, and later runs use a unique output directory.
- Two additional prior-result retention cases: **2 failed / 0 passed** before removing the two request-start result clears; both passed afterwards.
- Broad regression first run: **162 cases, 160 passed / 1 failed / 1 skipped**. The sole failure was the old actual-service test's assertion that rejected schema output must cause exactly one provider request. WP38 explicitly adds qualified invalid-output recovery, so that service contract is superseded. Its updated assertion requires the **exact two qualified distinct model names** and **zero task validators invoked** for invalid schema. It still requires final `AI_INVALID_RESPONSE`; strict schema acceptance was not relaxed. Existing generic-executor single-attempt invalid-response assertions were retained unchanged.

## Completed local verification

Commands use the repository's installed binaries, equivalent to its existing `tsx --test` / Playwright scripts; there is no generic `npm test` script.

| Command | Observed result |
| --- | --- |
| `node_modules/.bin/tsx.cmd --test tests/wp38-gemini-reliability.test.ts tests/wp35-gemini-runtime.test.ts tests/reliability.test.ts` | Initial provider implementation: **24 passed**, 0 failed |
| `node_modules/.bin/tsx.cmd --test tests/wp35-*.test.ts tests/wp36-*.test.ts tests/wp37-statistics*.test.ts tests/reliability.test.ts tests/wp38-gemini-reliability.test.ts` | Final expanded run: **166 cases, 165 passed, 0 failed, 1 skipped** |
| `node_modules/.bin/playwright.cmd test --config=playwright.component.config.ts tests/e2e/components/wp38-gemini.spec.ts --workers=2 --output=test-results/wp38-gemini-final` | **20 passed**, 0 failed (51.2 s) |
| `node_modules/.bin/tsc.cmd --noEmit` | Exit 0 after final implementation |
| `git diff --check` | Exit 0; an existing shared Java-file LF/CRLF notice is not a whitespace error |

The one Node skip is the existing real-Postgres concurrent registration/restart/proof/revocation/deny test, requiring its external test database. No provider/route/financial assertion was skipped.

The expanded Node suite includes actual `GeminiService` execution on all four qualified routes with an invalid primary then valid alternate, strict repeated-invalid rejection, exact telemetry, deadline/attempt limits, content refusal, permanent errors, quota and cancellation, plus existing cold readiness, auth, transient 429/503/network, deterministic statistics and result-validation gates. Browser fixtures replace only the external HTTP boundary and use real components, hooks, local calculation, validation and storage. They cover all four primary controls, progress Retry parity, provider retry guidance, context resets, EN/FR/AR reason copy, retained photo/results, local summary/fallback/cache exceptions, cancellation, stale context, duplicate requests and genuine transient retry.

Local artifacts: `test-results/wp38-gemini-node.log`, `test-results/wp38-gemini-final/`, and expected red retention artifacts under `test-results/wp38-gemini-retention-red/` (generated, not staged). Vite/esbuild initially could not read configuration under the filesystem sandbox; the authorized local test rerun outside that sandbox succeeded. No production access was involved.

## Remaining verification

Full integrated WP38 verification, CI on the eventual immutable commit, private APK/upgrade and physical-device acceptance are owned by the parent work package and are not certified here. Render effective routes and cold/warm live-provider checks remain deliberately deferred/unverified. A successful 45–50 second provider response is not classified as a bug by these changes. Local WP38-C synthetic gates are green; this packet alone is not release approval.

When quota has **no** `Retry-After`, an unchanged mounted context remains latched because the actual provider reset cannot be observed without a request. Existing visible recovery paths are changing the Spending Analysis month (and back if desired), selecting a Statistics period, or selecting/clearing and reselecting a Smart Capture/Receipt photo; relevant ledger/currency/language changes also reset their contexts. Statistics/photo-card remounts reset their local latch. Spending Analysis additionally exposes its existing `reloadCached`/`reset` integration methods. Same-context timed recovery is verified when provider retry guidance is present. Automatic discovery of a daily provider reset with no retry guidance is not claimed.
