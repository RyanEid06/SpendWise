# WP35.3 review checkpoint

Branch: `wp35-03/ai-progress-safe-area`. Base: live-verified main `7d00b2dafadf829f63d2b6074b08d08c00ca352d`, including WP34 PR41 at `cfc9c954fe51242fbc22f62da9f5b3bfaae8ce49`. Implementation/verification is in progress; final commit and CI receipt will be recorded at the checkpoint.

Read-only references: WP35.1 `c19a960ff49a18ebfc2f2eab1ccba45c16476402` (draft PR45), WP35.2 `97055ed8a219d598c16eb7c731f09324029fb80d`, its complete review/integration notes, and the entire approved WP35 plan from the immutable WP35.1 ref. Neither branch was merged or cherry-picked. This main-based branch deliberately does not deploy the auth/runtime work from those lanes.

## Result and observable stage mapping

One shared panel and indeterminate horizontal bar serves Smart Capture, Receipt Scanner, Spending Analysis/Smart Flags and Statistics Trend Insights. It remains inside each existing card/modal. English/French/Arabic RTL, dark/light themes and reduced motion are covered. There is no percentage, predicted duration, artificial stage timer, polling, streaming, keep-alive or claimed model retry.

| Stage | Evidence that permits it |
|---|---|
| Preparing photo | Actual local photo load/compression, or FileReader conversion of a prepared image |
| Preparing request | Explicit operation begins, before local summary/request construction |
| Checking backend readiness | Adapter accepts only a real WP35.1 `readiness/start` event; this main-based client has no readiness implementation and never fabricates one |
| Connecting securely | Actual session acquisition starts when no usable token is cached; adapter also accepts WP35.1 register/challenge/verify starts |
| Waiting for AI service | Actual authenticated AI dispatch starts; this does not assert that Gemini has accepted/started inference |
| Checking result | Response body has arrived, immediately before JSON parsing; feature validators still must succeed |
| Ready to review | Feature parsing/validation succeeds and the generation remains current |
| Local analysis ready | Existing deterministic spending/trend fallback was computed locally; visibly labeled Local Statistical rather than Gemini |
| Cancelled / failed | Explicit Cancel or observed stable failure; daily quota is distinct from temporary rate limiting and has no brief-Retry CTA or invented reset time |

Cancellation invalidates existing feature generations and the shared operation generation before aborting. Existing transports receive the signal through response body receipt. Existing request timeout values (30s text / 45s photo, auth subrequests unchanged) are not increased. WP35.2 must replace these legacy call-site values and own the combined processing/overall bounds during integration. No server budget, routing, thinking, provider attempts, rate guard, signing, storage schema or version is changed here.

Cancel, Reset, context change and unmount reject stale results. Tabs and collapsed tools retain valid work. Manual fields and prepared photos survive AI Cancel/Retry. Existing explicit Apply and Save remain required; no AI result saves an expense. Protected draft/encryption/backup code is unchanged. Shared authentication may finish for another subscriber after one caller cancels, but the cancelled caller cannot dispatch AI; WP35.1 owns cancellable single-flight auth/readiness.

## Add/Edit safe areas

Installed/locked Capacitor Android is 8.5.2, compile/target SDK36. Its built-in SystemBars listener propagates systemBars/displayCutout insets as `--safe-area-inset-*`, clears consumed native insets to zero, and clears bottom inset during IME. Existing viewport-fit=cover is present. Add/Edit now uses the injected value **or** `env(safe-area-inset-*)` fallback plus 14 CSS px on each side; it never adds both or hardcodes system-bar dimensions. No new native listener or shared UI-wrapper correction was needed.

The existing visualViewport height/offset, focused-input scrolling, fixed header/footer, scrollable fields, focus trap, Back/close and nested photo tools are retained. Synthetic browser checks cover nonzero and native-consumed zero values, small landscape and French text, plus a resized/offset keyboard viewport. Actual Android validation is a separate CI job using SDK36, API36, real IME, gesture/three-button modes and a read-only geometry probe. The probe refuses non-synthetic emulators and records only rectangles/insets, not entered values.

Primary platform guidance: [Android WebView insets](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets). The installed Capacitor SystemBars source was inspected as implementation authority; native consumption must yield zero web insets to prevent double padding.

## Verification evidence

- Focused controller, transport, response-validation and geometry tests: `npm run test:wp35:progress`. Red/green checks cover generation invalidation, duplicate submission, cancellation during authentication and body download, late output, request deadline, local identity, malformed results and unsafe geometry.
- Full Node22 regression run: **437 passed**, `artifacts/wp35-3-final-node22.log`, including existing security/encrypted storage/backups/reliability/diagnostics and Android-runner failure-injection tests. Initial Node24 run had two explicit Node22 benchmark precondition failures; those were rerun successfully under Node22 without changing assertions.
- Existing components: **39 passed**, `artifacts/wp35-3-components.log`.
- Browser/visual/accessibility final receipt pending. Initial continuity failures were old loading-label expectations plus a reset test awaiting a response instead of asserting abort. The latter matches WP35.2's already-proven test repair; no financial/security assertions were removed. An overlapping local browser run caused trace-folder collisions; final verification runs serially.
- TypeScript/build passed locally in normal Windows context; sandbox Vite realpath access failed before implementation as well. Existing Vite chunk-size warning remains.
- Screenshots: local ignored `artifacts/wp35-3/screenshots/` contains all four features × three languages × two themes, plus keyboard simulation. CI uploads the same synthetic evidence. Sample files: `smart-ar-dark.png`, `analysis-fr-light.png`, `trend-en-dark.png`, `receipt-fr-light.png`, `keyboard-simulated.png`. These are browser simulations, not phone images.
- CI workflow: `WP35 Progress and Safe Areas`, branch push/manual only. No Gemini credential or production backend endpoint is supplied; native build uses unreachable loopback HTTPS. It builds an unsigned-for-production debug app exclusively for an isolated emulator and uploads evidence, **not an APK**.
- No new live Gemini calls, actual Render verification, production change, deployment, signed candidate, real-device install or physical acceptance is claimed.

## Required combined integration/release gate

After explicit approval, combine WP35.1 durable identities/revocations/readiness, WP35.2 runtime and this UI. In `AuthenticatedApiClient`, keep WP35.1's single-flight transaction and exact unknown-installation recovery, keep WP35.2's processing/overall deadline/body/cancellation implementation, and forward actual events to the operation's `AiRequestInit.onPhase`. Subscribe each caller to relevant shared readiness/auth work without delivering another caller's unrelated dispatch. `stageFromRecoveryPhase` is structural and accepts WP35.1 phase/outcome; it does not implement recovery. Remove this branch's minimal baseline transport bridge in favor of the combined implementation, not a second deadline or auth layer.

Keep WP35.2's 90s server shared budget, bounded attempts, 115s processing and 270s overall bounds, rate guards and disabled candidate routing. Reuse one correlation ID across readiness/auth/dispatch/provider/cancel; verify this with combined fault injection. Preserve distinct cancelled/network/provider-outage/timeout/temporary-429/daily-quota errors, including diagnostics allowlists. The ten completed synthetic live calls remain the only Google evidence: Flash health was not established; Lite failed the strict trend numeric gate. No fresh calls are authorized here.

Then perform real Render idle-to-request verification, accounting for health probes that may keep it warm; validate all four features, system bars, gesture/three-button navigation, keyboard, retained data and drafts on the real phone; complete combined security/browser/diagnostics/Android/Maestro QA; prepare backend deployment and permanent-keystore signed candidate for review. Merge/deploy/settings/resources/version/tag/APK publication/device update remain separately authorized actions. CI/emulator success cannot certify the combined release or physical acceptance.

## Remaining checkpoint work

Finish current browser evidence, run independent immutable-range review, obtain dedicated CI/debug Android/isolated Maestro receipts, and record exact implementation/review commits and the complete changed-file manifest. Stop at this checkpoint without merging or releasing.
