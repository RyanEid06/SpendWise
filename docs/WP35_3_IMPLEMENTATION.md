# WP35.3 execution notes

Authority: approved WP35 plan at `c19a960ff49a18ebfc2f2eab1ccba45c16476402:docs/SpendWise_WP35_Implementation_Plan.md`, read in full, and supplied WP35.3 objective. Execution is inline using the clean existing checkout and requested branch. No WP35.1/2 merge or cherry-pick.

Base: verified remote main `7d00b2dafadf829f63d2b6074b08d08c00ca352d`; WP34 integrated at `cfc9c954fe51242fbc22f62da9f5b3bfaae8ce49`. Read WP35.2 review and integration contract at `97055ed8a219d598c16eb7c731f09324029fb80d` and WP35.1 observable RecoveryPhase contract at `c19a960`.

## Tasks

- [x] Add tested operation-generation/cancellation controller, client signal adapter, and one localized accessible progress panel. No progress timers or percentages; extended wait changes explanation only.
- [x] Wire Smart Capture, Receipt Scanner, Spending Analysis and Trend Insights. Preserve explicit Apply, encrypted draft handling, retained screens and local fallback identity. Keep existing timeouts in this main-based branch; WP35.2 owns coordinated deadline replacement.
- [x] Scope Add/Edit padding to Capacitor's native `--safe-area-inset-*` with CSS env fallback, plus 14px breathing room. Retain visualViewport/focused input handling; test keyboard, orientations, long text, native-consumed zero insets.
- [x] Run focused/security/reliability/diagnostics, build, browser/component/accessibility/visual checks, available Android validation, independent review, and record checkpoint evidence/integration gates.

## Review focus

Cancelled authentication must never dispatch AI. A late result must never populate a newer operation. Retry must preserve manually entered fields. Daily quota must not invite a brief retry or invent a reset. Insets consumed by native must be applied zero additional times, and keyboard height must not be subtracted twice.

No backend/model/budget/signing/storage schema changes, live Gemini calls, deployment, release/version/tag, merge or physical-device installation. Combined readiness/auth/runtime/provider correlation and real Render/phone acceptance remain explicit later gates.

## Execution ledger

Tasks 1–3: implementation commit `425887b0677fc6bb2d6d50cfe9ab438f1837c012`; latest focused regressions 16/16, full Node22 regression run 437/437 before the last two added contract tests (both also passed focused), components 39/39, browser/accessibility/visual 80/80 plus daily-quota and timeout UI 2/2; TypeScript/build passed. Screenshots inspected. Independent review and CI/API36 isolated validation remain in progress.

Ruling: reuse the clean existing checkout on the exact requested branch, rather than creating a second checkout — the objective and app instructions prefer suitable existing workspaces; wrong choice would require moving a clean commit, not risk another lane's changes.

Ruling: do not import the other WP35 lanes; retain baseline timeout values and add only the minimum cancellation/phase bridge needed to make this branch testable — the objective forbids merging/cherry-picking and duplicating recovery/deadline implementations. This branch must not be deployed alone as combined WP35; the integration report specifies which implementation wins.

Ruling: expose no fabricated durable-draft claim in progress copy — the panel has no verified persistence receipt. Existing protected-draft status remains authoritative; the cost is less reassurance, not a false promise.

Verification recovery: Node24 benchmark preconditions were honored by rerunning under Node22. Browser label/abort tests were adapted to the intended UX without removing safety assertions; overlapping browser trace output was corrected by serial verification. Automatic approval initially rejected combined commit/push because the destination was unverified; read-only checks proved the existing public origin is RyanEid06/SpendWise, then separate local commit and narrow feature-branch push were approved. No approval was bypassed.

Independent review of immutable `7d00b2d..425887b` requested two P2 corrections: accept the existing server's 240-character insight-title boundary, and verify propagated native insets exactly once plus 14px in the geometry receipt. Both were reproduced with failing tests and corrected in one repair pass; focused tests now pass 18/18. No second review round is required by the execution workflow. The reviewer otherwise confirmed cancellation ordering, cancelled-auth dispatch prevention, late-result guards, manual-field preservation, local labels, daily-quota copy and CSS inset selection.

Review rulings: the reviewer declined to judge combined WP35.1/2 behavior, real Render/Gemini behavior, physical-phone/signing acceptance and CI execution. The first three remain explicit later gates because the objective separates those lanes and prohibits live calls/device updates; guessing would risk false security, provider or physical acceptance. CI remains a checkpoint requirement and is being measured directly, not inferred from workflow inspection. Initial CI web failure is an existing high-entropy eight-photo recovery test's 30s total timeout; its trace is being inspected before any retry or change. Android continues independently.

Trace resolution: the eight-photo fixture spent 17s serializing its JPEG into millions of JSON number entries. All encrypted-size, recovery and Save assertions passed before the final reload timed out. Transfer now uses compact base64 for the same JPEG, with all assertions and the 30s test budget retained. Focused recovery test passes (14.1s test; 30.7s including build). Full post-review Node22 run passes 441 tests; production build passes.

Scope extension from the user on 2026-10-11: after WP35.3 passes, merge all three WP35 branches together; if combined checks stay green, merge into main and make the APK. This is conditional authorization for integration/main merge/APK build. No new live Gemini calls, deployment, production configuration, publication/tag or device installation is authorized. Prepare integration on a separate `codex/` branch, preserve the exact lane contracts and collect combined QA before the main merge. Real Render and physical-phone acceptance stay explicitly pending.

Native failure classification from run 38120164414: Add/Edit, real IME and geometry passed in gesture and three-button modes. The three-button continuity tail failed because Maestro's `Home` selector selected `com.google.android.apps.nexuslauncher:id/home`, the Android system Home button (commands/maestro.log, 07:16:32 UTC); the failure screenshot shows the launcher. No crash or inset defect is established by that failure. Scope the existing English-only flow's Home taps to the Home tab left of History, using documented relational selectors; retain all continuity/financial/fallback assertions. Fresh native execution must validate this repair. Current strict probe is from fb9f775; the old run's geometry receipts predate that verification fix.

Run38121061468 at732387c: web job passed441 full Node22,39components,71browser,3accessibility,8visual checks. Strict native geometry passed Add/Edit in gesture and Add in three-button; the corrected AI-flow Home selector passed in gesture. The separate Save/Edit flow still had one unscoped Home tap and selected the exact same system Home resource at07:29:05UTC; the missing Dining row was on the launcher. Apply the same proven relational selector there, without product edits or changed assertions. The failed-job rerun API checks the old immutable commit, so a code/flow repair requires a fresh push run; do not rerun old bytes and call it verification of the fix.

Ruling: the user's Render screenshot confirms main auto-deployment, and their subsequent “so continue normally” authorizes the known deployment side effect of the conditional main merge — do not ask for redundant merge/deploy permission. Preserve the Gemini key and verify WP35.1 durable-store/history cutover prerequisites before main push. Cost if wrong: an unwanted deployment; the conditional green gate and prerequisite check remain in force. External database provisioning and private-history migration are not inferred from this instruction.

Task 4: complete. Exact code `59e4a805d0a5b92271530d2afa567bf8a350747c`, run38121734881 passed web job114417676536 and native114417676744. Web441 Node22/39component/71browser/3accessibility/8visual plus19/11 runner suites; SDK36 build and API36 gesture/three-button Add/Edit/AI continuity passed. Four actual-IME geometry receipts confirm consumed-zero native insets plus14px and contained header/footer/focus; exact-run three-button Edit screenshot inspected. Complete32-file manifest and stage/inset decisions are in WP35_3_REVIEW.md. No deferred minor finding. Integration/live/backend/phone gates remain separate; proceed with authorized combination.
