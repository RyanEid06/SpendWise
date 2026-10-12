# WP37 recovery ledger

Spec: `docs/WP37_SPEC.md`; original full prompt: `docs/WP37_ORIGINAL_PROMPT.md`; plan: `docs/superpowers/plans/2026-10-12-wp37.md`.

## Baseline and authorization

- 2026-10-12: owner authorized executing original WP37 with review refinements1-7, saving durable context and using GPT6.1 Sol High or GPT6 Luna High subagents. No merge/deploy/public release/version bump authorization.
- Clean baseline `269ddfaa7c9707c2d95739be5e3ddfc6fb726fc1` on `codex/wp35-integration`; WP36 integration present. New branch `fix/wp37-localization-native-auth-ux` created.
- Versions retain2.1.2/code12. Repo has dependencies. Default PATH Node24 must be replaced with Node22 for supported validation.

## Plan preflight / ownership

| Task | Shared boundary | Resolution |
|---|---|---|
| Auth / coordinator | startup App.tsx + main translations | auth uses feature-local copy; coordinator owns App.tsx; coordinate lifecycle integrations |
| Backup / coordinator | Settings and translations | backup owns Settings/modals and feature-local copy; coordinator avoids them until agent complete |
| Statistics / coordinator | AiProgressPanel props + main translations | coordinator owns progress component and integrates Statistics tone after agent complete |
| All tasks | scripts, package.json, harnesses, git commits | coordinator owns common integration and commits; agents use unique focused test files |
| Each domain | Original prompt vs refinements | refinements take precedence, no speculative fixes or provider prose |

Ruling: Owner explicitly approved starting the supplied detailed prompt and seven refinements; save them and execute without repeating approval gates. Work in dedicated branch in the current clean checkout; do not create another worktree or touch main.

## Status

- [x] Task1 native authentication (physical/OEM acceptance remains separate)
- [x] Task2 backup restore policy (runtime recovery/cache regressions passed)
- [x] Task3 Statistics facts and disclosure (independent compatibility finding fixed)
- [x] Task4 localization/bidi/progress
- [ ] Task5 combined validation/review/PR/CI/private artifact

## Evidence and next actions

Task agents will save `docs/WP37_AUTH_REPORT.md`, `docs/WP37_BACKUP_REPORT.md`, and `docs/WP37_STATISTICS_REPORT.md`. Read this ledger and those reports after context compaction; never restart completed work or active builds blindly.

### Initial integration evidence

- Node22 executable: `C:\Users\Administrator\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe` v22.23.3. Prefix PATH for npm/Playwright children.
- Normal Windows/keyring `gh auth status` and `git ls-remote` verified integration remote at baseline. Restricted sandbox falsely reports invalid auth and prevents local listener/Git Bash/browser operation; rerun affected verification in normal context, never change credentials.
- UI RED `.superpowers/wp37/ui-red.log`: 7 failures (content direction, input, Arabic Back, contextual tone) +4 preserved quiet-state passes. After implementation10/11 green; AR reduced-motion precedence reproduced, fixed by matching RTL selector specificity.
- Startup RED missing new safe screen then GREEN3/3, main/feature parity3/3 initial. New copy exports added to parity suite.
- Statistics UI RED confirmed original missing detail markers/localized period labels (`statistics-ui-red.log`). Agent core RED before implementation and subsequent financial edge-case RED recorded in its report.
- Backup agent completed111 focused passes,33 new WP37 tests; report saved.
- Initial normal-context full Node run634pass/6fail/1DBskip while agents still authoring. Five failures were old source-shape assertions after moving startup copy/forwarding auth method/restore options; retained their intended checks at updated boundaries. One newly authored tiny-baseline RED captured concurrently; Statistics agent fixed it before final handoff. Final full suite pending after files stable.
- Initial complete component run60pass/1navigation abort at90s in existing exhaustive Arabic all-currencies loop, while concurrent suites loaded machine. Exact unchanged retry50174 passed1/1; no assertion or timeout weakened.
- Browser/accessibility/visual full51500 completed86/86 in3.8min (`browser-full.log`). Expanded localization browser suite38662 passed13/13, including real stored Media Library photo/preview and expense detail bilingual fields (`ui-expanded.log`).
- Existing WP33 browser performance15858 passed10/10 datasets in3.1min and summary gate; numeric performance13337 passed with measured warning thresholds retained. Logs `performance-browser.log`, `performance-core.log`.
- EN/FR/AR parity11 objects plus startup SSR3 passed14/14 after adding recovery/API-limit copy. Representative screenshots inspected under ignored `.superpowers/wp37/screens/`; temporary visual server88105 stopped.
- Scratch evidence lives under ignored `.superpowers/wp37/`; do not rely on sandbox TEMP, which changes by invocation.
- Ruling: adapt existing private APK workflow's exact branch whitelist to permit only the authorized WP37 branch alongside integration, preserve immutable source/endpoint/metadata/certificate checks and all signing steps. Dynamically label packet/artifact WP37. This is required validation plumbing, not a signing-policy change; original signing guards remain.

### Independent review / integration follow-up

- Reviewer `wp37_review` (fresh GPT6.1 Sol High) found two P2 issues in stable domains. Legacy period-less category comparisons omitted the category name; Statistics author reproduced three RED EN/FR/AR cases and fixed with dedicated localized template. Focused suite now74/74, tsc/diff clean. Reviewer independently revalidated the fix.
- Incomplete backup recovery could leave AppShell React ledger/preferences stale despite persisted partial state. Backup author is adding reconciliation callback and media refresh while preserving error-only focused alert; isolated browser regression uses port4188. Do not edit its Settings/unique harness files concurrently.
- Auth author owns `main.tsx` and `useAppLockLifecycle.ts` too: closing startup listener/handoff gap and capturing event timestamps before async queues. `SecurityLifecycleCoordinator.ts` and `wp37-auth-startup.test.ts` are new.
- Auth ruling: no unsupported legacy immediate-lock external credential exception. API24–29 system credential activity necessarily stops app; timeout0 must fail closed with localized limitation, and credential-only devices cannot newly choose unusable immediate lock. API30+ in-app credential prompt must not be classified as external activity. Supplemental Home broadcast is not sole timeout enforcement. Settings owner maps `CREDENTIAL_IMMEDIATE_LOCK_UNSUPPORTED` to localized `AUTHENTICATION_LIMIT_COPY`.
- Next: wait stable auth/backup files, rerun full Node22 and production build, immutable commit and final whole-branch reviewer pass, push/PR/CI/private signed APK, final evidence report. No merge/deploy/version change.

### Stable-tree validation checkpoint

- Auth author finished107/107 focused security/lifecycle checks,19/19 Android runner checks and4/4 pure-JVM gate tests. Established-key policy rotation received a final regression; source is stable. Native Gradle compile/emulator/physical proof still requires CI/device execution.
- Normal-context stable full Node suite: **641 tests,640 passed,0 failed,1 PostgreSQL integration skipped**, exit0 (`node-stable.log`, session63491). CI provides the isolated database.
- Stable `npm run verify`: TypeScript and production web build passed, exit0 (`build-stable.log`, session26055). Existing bundle-size warning remains.
- Final browser/accessibility/visual suite after continuous lifecycle integration: **86/86 passed in4.9min**, exit0 (`browser-final.log`, session7808).
- Backup incomplete-recovery regression: meaningful3/3 RED, then9/9 GREEN, including V1/V2/V3 persisted/reopened-state reconciliation, refresh failure retaining the focused warning and EN/FR/AR native limitation copy. Author identified one related stale-analysis-cache edge case; final focused fix/check in progress before immutable commit.
- User asked why work paused: explained that the wait was for active validation, resumed result collection and remaining review. No goal pause or new approval gate was introduced.
- Next: close cache edge case, final component suite, commit reviewed application tree, immutable reviewer recheck, documentation checkpoint, push/PR and native CI. Activate sparse ten-minute heartbeat only when long CI is actually running; preserve active runs.

### Immutable application checkpoint

- Application commit **`4547b7e63814e9350f37c094a3aafec82ce9f962`** includes final backup-cache and empty-analysis localization fixes. No version/dependency/schema/signing identity changes.
- Incomplete financial recovery now suppresses old cached analysis before AppShell reconciles. Six focused Node cases and actual-hook browser reproduction were RED, then94/94 affected Node and9/9 recovery browser checks passed. If cache deletion itself fails, suppression is process-local; restart durability is not claimed.
- Independent reviewer found baseline English empty-ledger/month Analyze guards. Root reproduced4FR/AR failures with2EN passes, then used localized copy/month interpolation. All6real-hook/screen browser cases pass without provider calls. Main dictionaries now279keys each; final parity/startup checks pass.
- Exact final application Node suite: **647tests /646pass /0fail /1DBskip**, exit0 (`node-reviewed.log`, session52103). Final `npm run verify` exit0 (`build-reviewed.log`, session67158).
- Full final component suite: **75pass /3navigation failures** out of78. Only unchanged failed cases retried, single worker: **3/3pass in33s** (`components-exact-retry.log`, session9252). Initial failure logs retained. No timeout/assertion weakening; mandatory CI will rerun the standard suite.
- Final browser86/86 and performance gates above predate only the last focused cache/copy follow-up, covered in final component run. Do not relabel them as a rerun of the immutable commit.
- Reviewer now rechecks immutable application SHA. Next: docs evidence commit, push authorized branch, open integration PR, native CI and signed private validation build only after CODE/CI green. No merge/deploy.
- Final independent GPT6.1 Sol High review of `4547b7e63814e9350f37c094a3aafec82ce9f962` against baseline completed: **no remaining required actionable findings**. Reviewer verified last copy/cache fixes, backup reconciliation, original finding resolutions and private-workflow source/signature/version/API guards; only documentation differs from that immutable source. No broad suites repeated.
- Documentation link check:16files /47local links /0missing. Full patch whitespace check passed. Next checkpoint commits documentation separately, pushes feature branch and starts PR/Android CI; required CI/private artifact remain pending and physical acceptance stays unverified.

### Active CI / automatic continuation

- Pushed head **`185ccc8f0aeada0d3933b448fcb239ac261bd18a`**; normal-keyring remote SHA matches. Documentation-only child of reviewed application `4547b7e`.
- Open and attached [PR47](https://github.com/RyanEid06/SpendWise/pull/47), target `codex/wp35-integration`. No merge/deploy.
- [Combined CI38249951357](https://github.com/RyanEid06/SpendWise/actions/runs/38249951357) running: web/PostgreSQL, API36 isolated native, API34 full acceptance and encrypted draft recovery. Signed job skipped as expected for PR; separate private build follows only after required CI green.
- [Android Build38249976083](https://github.com/RyanEid06/SpendWise/actions/runs/38249976083) dispatched on exact WP37 head with `run_live_backend_smoke=false`.
- Owner-requested ten-minute heartbeat **`spendwise-wp37-ci-and-private-apk-checkpoint`** is ACTIVE on this chat. Stay quiet while unchanged; notify meaningful changes/failure/completion/required action. Disable at final review/private-artifact checkpoint. Do not create duplicate monitors.
- Machine-readable run/source/automation handoff: ignored `.superpowers/wp37/ci-checkpoint.json`. This ledger's CI handoff is intentionally uncommitted while builds run; do not push documentation just to restart healthy CI.
- Next wake: inspect exact-head existing runs with normal `gh`, preserve active/green jobs. Fix genuine failures before rerunning only affected checks. Once required CI green, dispatch `wp35-test-apk.yml --ref fix/wp37-localization-native-auth-ux -f expected_source=185ccc8f0aeada0d3933b448fcb239ac261bd18a` only if that remains the reviewed/pushed head. Verify private APK receipt/source/hash/certificate/identity/endpoint and finish report. No physical/OEM acceptance is implied.

### Latest owner authorization — supersedes original no-merge/no-deploy stop

- Owner: **"when we all green you can merge to main ... we update render to be auto update again from main"**. Clarification answered explicitly: **"Automated checks are enough"**.
- Required gate is automated independent review + required CI + signed private APK/provenance verification. WP37 phone sign-off is not required for merging; DEVICE/OEM/TalkBack remains unverified.
- Once gates pass, merge PR47 through integration, prepare/attach integration-to-main PR, satisfy its required checks and merge to main; then restore the existing SpendWise Render service's main branch and auto-deployment and verify exact deployed main commit/health/readiness. No new confirmation required for these authorized actions. Do not bypass protections or delete branches.
- Preserve existing service secrets/database/authentication and unrelated settings. No version bump/tag/public release/data reset/new WP is authorized by "might be last version".
- Update the existing heartbeat to include this expanded finish; do not disable at the earlier private-artifact-only checkpoint or create a duplicate. Spec/plan/report/machine-readable handoff updated locally; keep active CI unchanged.
- Separate Android Build38249976083 is now **GREEN** (completed2026-10-12T12:40:15Z); native build/lint/unit and dependency checks ran. Live provider smoke and signed public release jobs were skipped as intended. Combined emulator/web CI still running; no merge/deploy yet.

### CI checkpoint2026-10-12T12:47Z — encrypted recovery failure under investigation

- Same exact pushed head `185ccc8f0aeada0d3933b448fcb239ac261bd18a`. Combined web job114813352600 **GREEN**:647/647 Node tests including PostgreSQL,78/78components,75browser+3accessibility+8visual,10performance datasets,173retained focused checks and benchmark gate. Green log saved `.superpowers/wp37/web-ci-green.log`.
- Recovery job114813352446 **FAILED** at `background-unlock` waiting for native SystemUI `lockPassword`. Prior setup credential challenge, Add draft field probe and encrypted-at-rest probe passed. Locked DOM is redacted but shows `Unlocking…` with no visible native credential input. This is not yet classified as product or infrastructure; no assertion/timeout is being weakened and no blind rerun started.
- Downloaded failed artifact11747503857 to `artifacts/wp37/ci-38249951357-recovery`; direct completed-job log saved `.superpowers/wp37/recovery-ci-failed.log` because `gh run view --log` is unavailable while sibling jobs run. Failure screenshot is black under secure-window protection; hierarchy and DOM carry evidence.
- Existing `wp37_auth` agent resumed (GPT6.1 Sol High) to trace native/lifecycle auto-prompt/settlement and add a meaningful regression if a defect is confirmed. Its ownership is auth source/tests only; root retains reports/commits/CI.
- API36 isolated and API34 full acceptance jobs remain active and preserved. No private APK/merge/deploy yet. Keep monitoring the existing runs and author handoff; do not restart completed web gates merely for an unchanged polling result.
- Native validation artifact11746838114 downloaded to `artifacts/wp37/ci-38249951357-native`: actual Android JUnit4/4NativeAuthenticationGate+2/2Acquisition,0failures/errors. Compile/lint/build step passed; this does not override failing recovery.
- Auth investigation narrows a reproducible source path: immediate background lock mounts an auto-unlock screen while stopped; request can reach AndroidX while Activity state is saved. Author will verify real-component RED/GREEN and add foreground/session-revision/disposal gating plus a native readiness/settlement guard if confirmed. Unique auth harness/spec and ignored port4190 scratch config authorized; existing shared configs remain unchanged. Missing launch-time logcat limits causal certainty; `run_flow` itself does not explicitly clear logcat.
- Root goes idle between meaningful handoffs; existing ten-minute heartbeat continues. Read active agent status and saved report before duplicating work. Collect stable source/test evidence, independently review and run affected verification before commit/push. Do not dispatch the private APK for the now-known failing source.

### Foreground authentication correction — immutable source

- Corrected application commit **`d837c35bf0f9edeb89eee163df27c369b2aa81b3`**, parent `185ccc8`. Immediate background lock could mount automatic native authentication while the Activity was stopped. Three real LockScreen browser cases reproduced the defect before the fix; foreground/revision/disposal gating and native resumed/saved-state readiness checks now prevent that launch and settle unsafe native requests as cancelled. No security assertion, Maestro selector or timeout was weakened.
- Author focused checks:75/75 Node,3/3 actual-component browser following3/3 RED, TypeScript and5/5 pure-JVM gate tests. Root independently reran affected Node75/75, `npm run verify` and the same3browser cases using the unchanged standard component CI configuration: all passed. Logs `.superpowers/wp37/auth-root-node.log`, `auth-root-build.log`, `auth-root-browser.log`.
- Independent GPT6.1 Sol High reviewer rechecked immutable `d837c35` against parent `185ccc8`: **no required actionable findings**, source/test diff check passed. Report preserves absent launch-interval native logs and does not claim patched Android prompt/recovery proof.
- Old-source API36 isolated CI is now GREEN; API34 full acceptance is still running and preserved. Old-source encrypted recovery remains failed. New exact-head CI/native build is required before private APK, integration/main merge or Render settings changes.
- Documentation receipts and updated owner authorization follow separately before the next push, so the next CI source has a single clear head. Existing ten-minute heartbeat remains active; no duplicate monitor.

### Corrected-source remote checkpoint

- Reviewed application `d837c35` plus documentation-only child **`5d1842a31756b46a9850cc6f036ea339fe2ec625`** pushed; remote ref matches. [Combined CI38252958940](https://github.com/RyanEid06/SpendWise/actions/runs/38252958940) and [Android Build38253054001](https://github.com/RyanEid06/SpendWise/actions/runs/38253054001) validate that exact head. Android live-provider smoke remains disabled.
- Existing heartbeat updated with corrected source/run handoff and expanded main/Render authorization. Current exact receipts are in `.superpowers/wp37/ci-checkpoint.json`; this ledger addendum remains uncommitted to avoid restarting healthy CI solely for documentation.
- Next: inspect these runs sparsely, preserve old-source receipts and healthy jobs. Do not dispatch private APK until corrected-source required checks pass. Then complete signed private APK/provenance, authorized integration/main checks/merge and existing Render main auto-deploy verification. Physical acceptance remains unverified.

### CI checkpoint2026-10-12T13:16Z

- Corrected exact head `5d1842a`: Android Build38253054001 **GREEN**; combined web job114823640914 **GREEN** with649/649 Node including PostgreSQL,81/81components,75browser+3accessibility+8visual,10performance datasets and173retained checks. Log `.superpowers/wp37/web-corrected-green.log`. Android live smoke/public signing skipped as intended.
- Corrected native report artifact11749322452 retained at `artifacts/wp37/ci-38252958940-native`: **5/5NativeAuthenticationGate+2/2Acquisition JUnit**,0failures/errors. This proves native compilation/unit execution, not prompt/recovery acceptance. Corrected API36 isolated, API34 acceptance and encrypted recovery jobs remain active; preserve them.
- Initial-source run38249951357 completed **FAILED**. Its previously healthy API34 job114813356331 reached `app-lock-configure-timeout` successfully, then `app-lock-background-cancel-retry` failed waiting for SystemUI `lockPassword`. Log `.superpowers/wp37/acceptance-initial-failed.log`; failure artifact11748599925 retained at `artifacts/wp37/ci-38249951357-acceptance`. This is another old-source background-lock prompt failure; no corrected-source failure or confirmed identical native causal trace is asserted.
- Continue the existing heartbeat, with no rerun or APK/merge/deploy while corrected native gates remain pending.

### CI checkpoint2026-10-12T13:26Z

- Corrected exact head `5d1842a`: API36 isolated job114823641245 and encrypted recovery job114823641432 are **GREEN**. Recovery log verifies native PIN challenges, background/redacted lock probes, process-death Add/Edit/photo recovery and final `WP05_ENCRYPTED_AT_REST_PASSED` / `WP05_NATIVE_RECOVERY_PASSED`; no runner assertion or timeout was relaxed. This supplies corrected-source emulator evidence for the previously failing recovery route, not physical/OEM certification.
- Logs `.superpowers/wp37/recovery-corrected-green.log`, `isolated-corrected-green.log`; recovery artifact11750166585 saved under `artifacts/wp37/ci-38252958940-recovery`; API36 artifact11750105252 remains available. Existing web/Android build/native unit successes retain their separate receipts above.
- Full API34 acceptance job114823641403 remains active. Do not dispatch private APK or merge before this remaining required CI gate passes. Existing heartbeat continues; no reruns or source changes.

### All application CI green / private APK entry correction

- Exact reviewed head `5d1842a31756b46a9850cc6f036ea339fe2ec625`: combined38252958940 **SUCCESS**, all four required jobs passed; full API34 acceptance completed2026-10-12T13:47:44Z, including the formerly failing `app-lock-background-cancel-retry` and final `hardened-verify`. Android Build38253054001 also passed. Acceptance log `.superpowers/wp37/acceptance-corrected-green.log`.
- Direct `gh workflow run wp35-test-apk.yml` returned404 because that workflow is not registered on the default branch. Historical successful WP36 private run38168712767 confirms dispatch through registered `wp35-integration.yml`, which calls the unchanged permanent-signing workflow.
- Found a missed entry guard: the reusable child allowed WP37, but the combined parent's signed job still allowed integration only. Correct only that parent branch condition to integration OR this exact WP37 branch, retaining explicit manual dispatch/input, immutable source/metadata/endpoint/certificate guards and all signing steps. Independent review and new exact-head CI follow; application source is unchanged. Do not merge while private provenance or new required checks are pending.
- Dispatch private APK via registered `wp35-integration.yml --ref fix/wp37-localization-native-auth-ux -f signed_test_apk=true -f expected_source=EXACT_PUSHED_HEAD` after required exact-head gates pass. Do not repeat the unavailable standalone endpoint.
- Immutable plumbing commit **`7ced66346962211ad7ea0a6afcb6ce60f95d36bc`** changes exactly one branch condition; independent GPT6.1 Sol High review found **no required actionable findings**, diff check passed. Application source/tests and child permanent-signing workflow are unchanged from green `5d1842a`. Documentation follows separately; exact new-head required checks precede signed build.
- Pushed documentation-only child **`2f55f47cfa8d362a538b6f49013f7adb9759dff2`**, remote matches. New required [combined38259775046](https://github.com/RyanEid06/SpendWise/actions/runs/38259775046) is active. Application/native code remains exactly the previously green source; Android Build38253054001 receipt stays labeled `5d1842a`. Do not cancel this new run or dispatch the private APK on the old head.
- Render preflight: no API key/service ID found in Process/User environment. Available in-app browser reached Render sign-in; an authorized GitHub sign-in click timed out and reset browser session. Reinspect fresh browser state later before declaring access unavailable. No Render settings/deployment changed. Browser/API access remains to be established after automated gates; do not expose credentials.

### Latest owner order — main merge before private APK

- Owner explicitly said **"build the apk after you merge to main"**. This supersedes all earlier private-APK-before-merge instructions in this ledger/heartbeat. Review and required CI now gate the integration/main merges; only afterward build the private2.1.2/code12 APK from the exact main SHA. Physical/OEM/TalkBack stays unverified. Existing no-public-release/no-tag/no-version/no-branch-deletion/data-preservation boundaries remain.
- Add exact main branch to both wrapper and child manual signing entry guards and classify its private packet WP37. Explicit signed-build input in wrapper and immutable source/package/version/HTTPS endpoint/permanent-certificate checks remain unchanged. Dispatch registered combined workflow on `main`, expected_source equal to exact merged main SHA. Do not build the feature-branch APK first.
- Repeat run38259775046 at2f55f47 failed full acceptance job114847007210 **before emulator execution**, packaging historical fixture `c0d7522`: `:app:packageDebug`, `IncrementalSplitterRunnable`, `OutOfMemoryError: Java heap space` in Zipflinger compression. Current WP37 APK build succeeded immediately before it. Log `.superpowers/wp37/acceptance-wrapper-failed.log`. This establishes fixture build-resource failure, not an application regression. Prior WP36 report records the same historical packager failure and explains the minimal wrapper ignores GRADLE_OPTS.
- Apply existing explicit `-Dorg.gradle.jvmargs=-Xmx2g --max-workers=2` only to that full-acceptance historical fixture Gradle invocation, retaining stacktrace/fixture commit/assertions and all native/security behavior. Independent review owns final workflow delta before commit/push. Preserve healthy sibling jobs; no cancellation or blind retry.
- Immutable workflow correction **`512d950bd1bcd7d5f55feca45cde79be144f1bae`** rechecked independently by **GPT6 Luna High** after Sol's immutable recheck hit model capacity: **no required actionable findings**, source guard/signing/fixture diagnosis verified and diff check passed. Earlier Sol provisional review also found no required defect. No application/native/tests changed; final exact-head CI must establish the fixture build succeeds.
- Updated this existing heartbeat and PR47 body to the latest owner order. Older automated prompts stating APK-before-merge are stale and superseded. Final checkpoint remains review/required CI -> integration/main -> private APK from exact main -> Render verification and consistent release/status documentation. No physical acceptance is implied.
