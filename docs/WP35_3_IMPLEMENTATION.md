# WP35.3 execution notes

Authority: approved WP35 plan at `c19a960ff49a18ebfc2f2eab1ccba45c16476402:docs/SpendWise_WP35_Implementation_Plan.md`, read in full, and supplied WP35.3 objective. Execution is inline using the clean existing checkout and requested branch. No WP35.1/2 merge or cherry-pick.

Base: verified remote main `7d00b2dafadf829f63d2b6074b08d08c00ca352d`; WP34 integrated at `cfc9c954fe51242fbc22f62da9f5b3bfaae8ce49`. Read WP35.2 review and integration contract at `97055ed8a219d598c16eb7c731f09324029fb80d` and WP35.1 observable RecoveryPhase contract at `c19a960`.

## Tasks

- [ ] Add tested operation-generation/cancellation controller, client signal adapter, and one localized accessible progress panel. No progress timers or percentages; extended wait changes explanation only.
- [ ] Wire Smart Capture, Receipt Scanner, Spending Analysis and Trend Insights. Preserve explicit Apply, encrypted draft handling, retained screens and local fallback identity. Keep existing timeouts in this main-based branch; WP35.2 owns coordinated deadline replacement.
- [ ] Scope Add/Edit padding to Capacitor's native `--safe-area-inset-*` with CSS env fallback, plus 14px breathing room. Retain visualViewport/focused input handling; test keyboard, orientations, long text, native-consumed zero insets.
- [ ] Run focused/security/reliability/diagnostics, build, browser/component/accessibility/visual checks, available Android validation, independent review, and record checkpoint evidence/integration gates.

## Review focus

Cancelled authentication must never dispatch AI. A late result must never populate a newer operation. Retry must preserve manually entered fields. Daily quota must not invite a brief retry or invent a reset. Insets consumed by native must be applied zero additional times, and keyboard height must not be subtracted twice.

No backend/model/budget/signing/storage schema changes, live Gemini calls, deployment, release/version/tag, merge or physical-device installation. Combined readiness/auth/runtime/provider correlation and real Render/phone acceptance remain explicit later gates.
