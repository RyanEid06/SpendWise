# WP32 active repair checkpoint

Updated 2026-10-04. This is an unfinished repair checkpoint, not a
passing release candidate. Resume WP32; do not start WP33/WP34 or merge/release.

## Latest checkpoint

- Read `WP32_ISOLATED_DIAGNOSTIC_REPORT.md` first; its latest checkpoint and
  second repair batch supersede the older failure descriptions below.
- Published source head `4bd98fbc7d5eacfa342d233c79439f67ec1dfe05`; local and
  tracking/live branch match with 0/0 ahead/behind. Every changed remote blob
  matches the locally verified bytes.
- First repaired matrix run `37159757487` proved import-v1, App Lock setup/auth,
  and timeout green. Restored-runner attempt 2 of `37161873538` additionally
  proves corruption, cancellation/retry, and v1.4 seed. Coverage is **21/22**.
- Only hardened upgrade remains in the matrix. Its latest failure is legacy
  seed's `Confirm PIN` covered by the keyboard, before upgrade verification.
  Artifact `11306668428` justifies keyboard dismissal and required scrolling
  in the seed flow. One narrow completed-media corruption product repair was
  validated; remaining repairs are test/bootstrap. Seed repair passes in run
  `37213179650`; the target then fails at the `Enter PIN` placeholder omitted
  from native accessibility. Artifact `11307397681` shows the credential field
  already focused. The target now enters the legacy PIN directly; all migration,
  authentication, ledger, budget, and photo assertions remain required.
  Run `37213890908` then passes legacy/device authentication and ledger/budget
  checks; artifact `11307169556` shows the photo control below the editor's
  viewport. The target now scrolls using the protected media flow's gestures.
  One pre-test fixture packaging failure cleared on a narrow retry. Latest
  photo-control repair is pending native proof; Build/web on `00f1d37` pass.
- Earlier attempts of corrected-head isolated run `37161873538`, Build
  `37161873533`, and web `37161873506` failed before steps because the account
  exhausted 3,000 included private Actions minutes with a $0 stopping budget.
  The user authorized and performed the CLI visibility change; the connector
  verified SpendWise is public. Failed-job retries now execute runner steps.
  The billing barrier is resolved. Android Build attempt 2 passes 226 Node
  checks and uploads APK artifact `11306633130`; web attempt 3 passes 54 checks.
  Build `37213179638` and web `37213179641` also pass on seed repair head
  `7e4507aa589a69cab9c0b3eb13fa903a023a12b4`.
- Local **237 Node checks**, **11 component checks**, and **21 published browser/
  accessibility/layout checks** pass, plus build/shell checks. CI acceptance on
  this source head is pending. Existing uncommitted light-theme contrast test
  fails; it remains preserved and unpublished, outside this repair.
- Only after all remaining isolated targets pass, add `wp32-final-native` to
  PR #30 for the ONE final full sequential native 22/22 gate. Do not launch it
  while any isolated target lacks proof. Android Build/web must then pass too.
- Final native suite not launched. Real-device/TalkBack remains separate.
- Preserve `tests/e2e/browser/backup.spec.ts` local edit and
  `SpendWise-v1.3.0-release/`. No merge, release, WP33, or WP34.

## Repository and access

- Repository: RyanEid06/SpendWise. Active branch: wp32/e2e-hardening, PR #30.
- Use the GitHub plugin for remote access. Local Git is safe; remote Git's
  git-remote-https.exe crashed on this Windows machine. No shell fetch/push/gh.
- Keep local and remote WP32 commits synchronized after each meaningful change.
- Preserve the user's untracked SpendWise-v1.3.0-release directory.
- Main's live commit is 58ca3c453ed780b442c209cc3d692fd5dc02f613. WP29–31 are
  merged there. PR #31 is separate dependency maintenance; no review comments
  were present on either open PR at inspection. PR #2 is old WP13–16 integration.

## Confirmed fixes and evidence

- Fixed fixed-control native accessibility after Settings → empty Home by using
  the existing body ViewportPortal for Navigation and Home Add Expense. Static
  DOM-order changes alone failed; CDP/native probes reproduced the issue.
- Rebuilt the corrupted full Android runner and restored the entire CI suite,
  including construction of the frozen v1.4 fixture APK.
- Shared adb helpers select exact data/full SWB3 exports, strip CRLF paths,
  validate envelope mode, and corrupt every encrypted fixture file safely.
- v1/v2 portable fixtures now use consistent current-month dates/budgets. Full
  v2 media uses a valid 1024px JPEG. Recovery asserts amounts/budget/photos.
- Maestro owns launch/readiness after each reset and upgrade, avoiding host
  uiautomator probing an already-running WebView before the driver attaches.
  The launch-boundary regression failed before this fix and passes after it.
- Commit 2686596f9ee3464d402aa5b27ec3c6c6b2716dd4: Android Build run
  37117984440 passed 221 Node tests and built/uploaded the debug APK. WP32 web
  run 37117984436 passed 44 checks: 6 runner, 6 failure injection, 11 component,
  10 browser, 3 accessibility, 8 layout.
- Native job 111188397920 passed empty navigation/all tabs/Home FAB, onboarding,
  fresh persistence, delete/Undo, background restoration, offline AI, 1/8 photo
  media/restart, both exports and clear-financial-data.

## Current blocker and pending test

Run 37117984436 failed during full v3 import waiting for `Backup restored`.
The screenshot shows `Backup restored: 2 expenses, 9 photos`; restore completed.
Maestro and uiautomator omit the whole Settings content after dialog closure.
The Android 34 google_apis image has WebView 113.0.5672.136.

There are two distinct issues:

1. Maestro text selectors match the entire label. All five restore success
   selectors were incorrect. This checkpoint corrects exact expense/photo
   counts; legacy v1 correctly expects `Merge & Import: 2`. A real two-expense
   browser restore reproduced the old selector failure and passed after the
   corrected v3 data selector. See tests/e2e/browser/backup.spec.ts.
2. Backup modal transitions lose focus. The browser regression now explicitly
   requires focus in the restore preview and return to the Import Data trigger.
   The regression failed before repair and now passes. Shared useModalFocus
   gives the passphrase field/preview safe initial focus, traps Tab, and restores
   the connected trigger or main landmark on closure. React autoFocus is removed
   so it cannot overwrite the saved trigger before capture. v1 preview shares
   this lifecycle. Wrong-passphrase cancellation and preview Tab wrap also pass.

## Completed diagnostic evidence

Diagnostic commit 525a690ceea3e4a7042559ce7e9c133bbf710220 completed WP32 E2E:
https://github.com/RyanEid06/SpendWise/actions/runs/37119658098
Native job: 111193147940. Web job: 111193148026 (passed).

The original pre-probe native tree already contains both Back and the complete
`Backup restored: 2 expenses, 9 photos` result. CDP AX/layout also show visible
content, no aria-hidden/inert and opacity 1. All three probe native trees contain
the result. This run proves the incorrect exact text selector caused its failure;
it does NOT establish that focus or animation caused run 68's missing subtree.
Review run69/failure/window.xml and failure/webview/original-*, focus-main-*,
no-animation-* and version.json. Modal focus is a separately reproduced defect.
The diagnostic only runs after a failed flow on the disposable synthetic test
emulator. It does not change release code or mask the failing exit status.

Commit 85cca18 used [skip ci] only to preserve that then-active diagnostic run
while saving the failing regression. The current implementation commit runs
normal CI and the complete Android suite. The skipped checkpoint is not green
acceptance evidence. Local Chrome passed 21 browser/accessibility/layout checks
and 11 component checks after repair; native acceptance is still pending.

## Isolated downstream diagnostic matrix

The branch now contains `.github/workflows/wp32-isolated-gates.yml` and
`scripts/run-wp32-isolated-gate.sh`. It fans the 13 native gates that were not
yet independently proven into separate clean-emulator jobs with fail-fast off.
Each job stops after its named target and uses only the minimum bootstrap state
required by that target. Portable v1/v2/v3 fixtures are generated directly from
the backup implementation, so v3 restore diagnostics do not need to replay the
earlier media/export chain. This matrix is diagnostic evidence only; the full
sequential WP32 Android suite remains the final acceptance gate.

## Next work

1. Publish/synchronize the selector/focus repair; run the complete native gate through v3 recovery,
   corruption, v1/v2 imports, App Lock, and v1.4 migration. Fix each actual failure
   from artifacts; do not hide/skip unexecuted gates.
2. Update PR validation and this checkpoint. Keep PR draft until CI passes.

## Local environment and artifacts

- Windows/PowerShell; Node 24.18 locally, Node 22 in CI. Git Bash is installed.
- Chrome: C:/Program Files/Google/Chrome/Application/chrome.exe.
- No local Android SDK/emulator. Native proof comes from CI.
- Local Playwright configs under artifacts/investigation use installed Chrome
  with video disabled because bundled Playwright browser/ffmpeg is unavailable.
  CI uses pinned Playwright Chromium normally.
- Artifacts: artifacts/investigation/run63, run64, run65, run67, run68, run69.
  WP32-repair-evidence.md records reproductions/results. These are ignored local
  artifacts; GitHub failure artifacts remain downloadable for seven days.
- Debug APK from 2686596: artifacts/investigation/apk-2686596/app-debug.apk.
  SHA256: 2B226D40D2CC3DA0C9E544C445E77F893FEB76EF3AE1DD4915474517A8FFBDFE.
- Local Git objects have been reconstructed from plugin-fetched trees/commits,
  verifying every object SHA before updating refs/index. Helper and data live in
  artifacts/investigation/sync-plugin-git.cjs and git-plugin-sync-data-*.json.

Manual TalkBack smoke is not performed. Version remains 1.4.0; the user's
possible 2.0 release decision has not been implemented. WP33 observability/
performance and WP34 security/release validation remain separate later work.
