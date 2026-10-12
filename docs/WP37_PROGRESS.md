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
