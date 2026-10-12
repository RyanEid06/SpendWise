# WP37 review checkpoint

Date: 2026-10-12. Approved scope: [original prompt](WP37_ORIGINAL_PROMPT.md) plus [refinements1–7](WP37_SPEC.md). This report is being finalized; pending gates below must not be read as passed.

## Identity and boundaries

Baseline: clean `codex/wp35-integration` at `269ddfaa7c9707c2d95739be5e3ddfc6fb726fc1`, containing approved WP36 merge `13b4a93`. Implementation branch: `fix/wp37-localization-native-auth-ux`. Initial tested application commit: **`4547b7e63814e9350f37c094a3aafec82ce9f962`**. Foreground-auth correction: **`d837c35bf0f9edeb89eee163df27c369b2aa81b3`**; documentation follows separately. [PR47](https://github.com/RyanEid06/SpendWise/pull/47) targets integration. Required overall CI/private APK receipts remain pending. Owner-selected WP37 version is **2.1.3 / Android code13**, package `com.spendwise.app`.

Original scope stopped at review. The owner subsequently authorized merging through integration to main and restoring Render auto-deploy from main, explicitly stating "Automated checks are enough". The latest instruction **"build the apk after you merge to main"** supersedes the earlier APK-before-merge gate: review and required CI gate the merge, followed by private signed APK verification from the exact main commit. Those conditional actions have not yet been performed. Physical acceptance remains unverified. Public release/tag, additional version/signing identity change, branch deletion, data reset and unrelated configuration changes remain unauthorized.

## Original Part60 findings and resulting behavior

| Items | Evidence-backed result |
| --- | --- |
| 1–2 Baseline/branch | Exact identity above; clean baseline verified before edits. Approved-scope commit `bf33063`, focused application commit `4547b7e`; separate evidence commit follows. |
| 3–5 Native duplicate/copy/locales | Unlock passed equivalent English title/reason through multiple layers. Typed semantic actions now map to intentionally distinct title and reason in EN/FR/AR at the adapter boundary. Internal IDs never become displayed reasons. OEM-owned strings remain platform controlled. |
| 6–8 Biometric/recovery/cancellation | Biometric-first where strong biometrics are available; ordinary scan mismatch is nonterminal. Explicit supported recovery uses Android's credential UI and still verifies protected Keystore access. Cancel stays locked without an automatic credential launch. Temporary/permanent lockout is distinct. |
| 9 OEM/API limits | API24–29 credential confirmation uses an external system activity; immediate App Lock cannot safely exempt its stopped interval. That combination fails closed with localized limitation, while supported positive-timeout paths retain elapsed checks. API30+ uses supported in-app credential prompt. Physical/OEM results pending. See [device checklist](WP37_DEVICE_ACCEPTANCE.md). |
| 10 Lifecycle | Serialized native attempts and generation/revision guards reject duplicate/stale success. One continuous lifecycle observer spans bootstrap, protected-storage opening and AppShell; event timestamps are captured before async classification. Startup checks session validity before/after storage and waits for foreground. Sensitive scopes are included. Auth focused107/107, runner19/19 and pure-JVM gate4/4 passed; Android CI/device proof remains separate. |
| 11 React LockScreen | Existing automatic one-shot guard retained. No invented duplicate React screen removal. Retry/credential actions remain explicit after attempts, with supported capability checks. |
| 12 Key/migration errors | Localized safe error states distinguish migration/repair/key unavailable/invalidated/unrecoverable/cancelled. Established missing keys cannot silently become new keys; protected data is preserved. |
| 13 Startup | Standalone `StorageFailureScreen` localizes fatal recovery without requiring database access. Existing restricted TechnicalDiagnostics boundary remains. |
| 14–17 Accessibility/RTL/user text | Localized Statistics Time Period label, proper Arabic legal Back arrow, content-based direction/isolation on History/Home/detail/form/Statistics/media/extracted merchant/description surfaces. Amount/date direction remains intentional. Exact truncated substring is font dependent; browser asserts real overflow plus logical content direction. [Surface audit](WP37_TEXT_SURFACE_AUDIT.md). |
| 18–19 Progress/reliability | One shared panel now forms an active state of the parent feature: indigo Insights/Statistics, cyan Smart Capture, purple Receipt. Thin indeterminate line, status/live semantics, quiet terminal states, restrained Cancel/Retry, reduced motion and one error presentation. Provider model routing, retries, deadlines, readiness/auth, request correlation and cancellation machinery are unchanged. |
| 20–22 Backup | Replace previously applied serialized language/theme automatically. Default now preserves current SpendWise language and exact theme mode including SYSTEM. Replace has OFF-by-default opt-in; Merge ignores it. Currency policy and V1/V2/V3 schemas/crypto/security allowlists retained. Financial commit precedes optional prefs; compensation/readback verifies recovery and reports incomplete recovery explicitly. [Backup report](WP37_BACKUP_REPORT.md). |
| 23 AI Insights | Existing compact analysis content and cap retained. Shared progress/error presentation improved; normal empty-ledger/month errors now use EN/FR/AR copy and localized month names. Incomplete financial recovery invalidates old analysis before AppShell cache reconciliation. |
| 24–26 Statistics/facts | Baseline summary repeated totals/count/average, favored isolated months, omitted category rendering and added generic advice. New shared deterministic localized catalog compares equal non-overlapping complete recorded windows, labels exact ranges, excludes partial/missing months, handles zero/tiny baselines/ties, and ranks category drivers by absolute deltas. Gemini selects verified IDs only; it cannot author financial prose. [Statistics report](WP37_STATISTICS_REPORT.md). |
| 27–28 Highlights/takeaway | Category highlights rendered. At most3 selected facts globally plus summary and at most1 supported takeaway. No generic recommendation filler or causal claims. Legacy category-specific facts now explicitly name their category in all3 languages. |
| 29 All-Time | Detail cards start with latest6, show all/collapse and reset on period change. Full totals, categories, rankings, chart and AI input remain intact; 36-month browser fixture verifies this. Oversized server histories fail explicitly rather than silently truncating; accepted histories retained whole up to600 months/40categories. |
| 30 Duplicate Statistics UI | Baseline already had one page heading and one monthly section icon. No duplicate deletion necessary. |
| 31 Translation parity | Main dictionaries have279keys each after adding the missing empty-ledger analysis message. Eleven main/feature dictionaries have executable EN/FR/AR key and interpolation parity; startup SSR works in3locales when localStorage access throws. |
| 32 Files | Changes are limited to native/security/lifecycle, backup policy and modals/Settings, Statistics deterministic facts/validation/UI, bidi/progress/startup surfaces, corresponding tests/docs and precise private-APK branch/packet validation plumbing. The owner-selected2.1.3/code13 metadata changes package/root lock versions only; dependency entries, routing/executor/network/auth middleware and database schemas remain unchanged. Final Git diff is authoritative. |
| 33 Tests | New WP37 auth/startup lifecycle, backup persistence/reopen/faults, Statistics period/fact/compatibility, localization/startup SSR, locale/RTL/progress/backup/Statistics browser regressions. Existing source-shape assertions updated at moved boundaries without relaxing intended security/behavior. |
| 34–35 Local/CI | Final full Node646pass/0fail/1DBskip and TypeScript/production build passed. Browser86/86 passed after lifecycle integration; final copy/cache paths have component coverage. Components75passed/3navigation failures, unchanged exact retry3/3passed. Immutable review/native CI pending. |
| 36 Device acceptance | WP36 owner sign-off remains historical. WP37 physical phones, OEM native prompts/Keystore flows, TalkBack and manual visual/backup/Statistics acceptance are **NOT YET VERIFIED**. |
| 37 Risks | Legacy immediate credential limitation, old backend behavior before separately approved deployment, missing real-world spending data, cross-domain process-kill atomicity not certified, browser performance warning thresholds, and unexecuted physical scenarios remain explicit. If disposable-cache deletion itself fails during incomplete financial recovery, old claims are suppressed for the current process; that suppression is not durable across restart. |

## Verification evidence

Supported local runtime: Node22.23.3. Scratch logs/screenshots are preserved under ignored `.superpowers/wp37/`.

| Check | Executed result |
| --- | --- |
| Statistics + retained WP36 focused gates |74/74 passed after independent legacy-category fix |
| Backup focused persistence/security |111/111 initial;94/94 final affected cache/persistence checks passed. UI9/9 passed after3/3 recovery RED; six cache Node RED and real-hook stale-claim browser RED reproduced before fix |
| Auth focused security/lifecycle + native runner |107/107 and19/19 passed |
| Main/feature parity + startup safe SSR |14/14 passed in final Node suite; main keys279/279/279 |
| Full final component suite |78cases:75passed,3navigation failures; unchanged exact failed-case retry3/3passed in33s. No assertion/timeout change. Logs `components-stable.log`, `components-exact-retry.log` |
| WP37 content/progress/empty analysis components |19/19 passed within full component run, including stored photo/preview, bilingual detail and6real-hook empty analysis cases. FR/AR4meaningful RED, EN2retained passes before copy fix |
| Full browser/accessibility/visual |86/86 passed in4.9min after continuous lifecycle integration; last copy/cache changes separately exercised in final components |
| WP33 core performance |5ledger sizes ×25correctness-validated operations; gate passed, measured timing warnings retained |
| WP33 browser performance |10/10 datasets and report gate passed; warning thresholds retained |
| TypeScript / production build |Stable `npm run verify` passed, exit0; existing bundle-size warning retained |
| Full final Node |647tests:646passed,0failed,1PostgreSQL integration skipped locally, exit0 (`node-reviewed.log`) |
| Local native |Pure Java gate4/4 per auth author; Gradle local loopback/SDK unavailable. CI compilation/unit/lint/build required |
| Independent review |Fresh GPT6.1 Sol High reviewer rechecked immutable `4547b7e` against baseline: **no remaining required actionable findings**. Two original P2 defects and related cache/copy gaps resolved; final workflow guards and unchanged application tree verified. Baseline-to-source diff check passed |
| Required CI / private signed artifact |Pending |

CI update2026-10-12T12:47Z, exact head `185ccc8f0aeada0d3933b448fcb239ac261bd18a`: Android Build38249976083 and combined web job passed (647/647 Node including PostgreSQL,78components,75browser,3accessibility,8visual,10performance datasets). Native reports verify4gate+2acquisition JUnit tests,0failures/errors. Encrypted recovery failed at background unlock: React remains `Unlocking…` but native credential input is absent. Auth author is reproducing background auto-prompt timing and native launch readiness before accepting a fix. API36 isolated/API34 full acceptance remain running and preserved. This source has **not** passed the overall automated gate; private APK/main merge/Render changes must wait.

Sandbox-only Git Bash/Chromium/localhost failures were rerun in normal Windows context with the existing keyring; credentials were not changed. Local database integration is skipped unless a test PostgreSQL URL is available; required CI supplies isolated PostgreSQL.

Foreground-auth follow-up `d837c35`: the real background-mounted LockScreen sequence produced3/3 meaningful browser failures before the fix. Native modes now wait for classified foreground and reject changed revisions/disposed presentations; the native bridge refuses unsafe Activity/FragmentManager launch state with a settled cancellation. Root independently verified75/75 affected Node checks, TypeScript/production build and3/3 actual-component browser checks under the unchanged standard configuration. Author pure-JVM gate5/5 passed. Independent GPT6.1 Sol High review of immutable `d837c35` found **no required actionable findings**; corrected-source native CI remains pending. API36 isolated passed on the old source; API34 acceptance remains running. See [auth follow-up report](WP37_AUTH_REPORT.md) for the absent native launch-log limitation. No corrected Android recovery success is claimed.

## Compatibility and future deployment

Old clients/new backend retain optional metadata and original response fields/fact IDs. New clients/old backend accept and compact the existing shape, but the old backend's raw-total wording and120-month truncation remain until deployment. Preferred future order is backend, then client. No deployment was performed. Backups retain V1/V2/V3 formats; runtime restore options are not serialized and never include security fields.

## Verdicts

Owner-selected version correction **`89c4ca32ffbf8dbbb39af8ff32c10c106f726668`**
advances only candidate metadata, exact private APK version checks/filenames and
matching existing assertions to **2.1.3/code13**; root lockfile versions change
without dependency changes. Independent GPT6 Luna High immutable review found no
actionable findings. Local Node649:648 passed,0 failed,1 PostgreSQL skip;
TypeScript/production build passed. Final exact-head CI is still required and
previous green2.1.2 application receipts are not relabeled as2.1.3 success.

**CODE: LOCAL CHECKS / INDEPENDENT REVIEW PASSED.** Final immutable application commit is recorded above; the component navigation failures and exact retries remain explicit.

**APPLICATION / CI: GREEN at `5d1842a31756b46a9850cc6f036ea339fe2ec625`.** Combined38252958940 and Android Build38253054001 passed, including full API34 background-cancel/retry, API36 navigation and encrypted draft recovery. Corrected native JUnit5gate+2acquisition passed; web649Node/81components plus retained browser/accessibility/visual/performance gates passed.

**OVERALL AUTOMATED CHECKPOINT: PENDING — required CI on final workflow plumbing, main integration, then private artifact/deployment verification.** Direct standalone signing dispatch returned404 because the workflow is not registered on main. Historical WP36 private run used registered combined workflow; its parent guard omitted WP37 despite the child allowlist. Reviewed plumbing-only `7ced663` added that exact branch. The owner's latest instruction authorizes private APK only after merging to main, so final entry plumbing adds exact `refs/heads/main` to both manual guards and labels its private packet WP37. Permanent signing and immutable source/version/package/API/certificate assertions remain intact. Current repeat acceptance failed before emulator execution while the historical v1.4 fixture packager exhausted Java heap; bounded2GiB/two-worker Gradle settings used by existing native validation are being applied to that fixture invocation. Application/native source remains unchanged. Required final-head CI gates merging; private main APK follows the merge.

**DEVICE / AUTH / RTL / VISUAL / BACKUP / STATISTICS: NOT YET VERIFIED.** Automated browser checks are evidence for tested synthetic scenarios, not physical-device certification.
