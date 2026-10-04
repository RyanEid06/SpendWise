# WP32 Android acceptance and repair evidence

Updated 2026-10-04. This replaces the earlier diagnostic snapshots. The user
authorized merging appropriate green PRs to main, deleting proven merged
branches, and delivering a signed v2.0 APK to Downloads. No WP33/WP34 work.

## Acceptance

- Native source: `253639e561c9ed822ea9ab892b32125d4d81eb4e`.
- Isolated evidence: all **22/22** flows individually confirmed. The final
  isolated import-v3-data run `37219280680`, attempt 2, job `111508850698`
  passed after the artifact-backed native-tree observation adjustment.
- Full sequential acceptance: **GREEN: 22/22 passed together**, run `37227530296`,
  native job `111510178359`. All gates remain required; this is distinct from
  the earlier isolated count.
- Android Build: run `37219280661`, verify-debug job `111486131378`, GREEN;
  dependency audits, **226 Node checks**, web verification, Capacitor sync,
  debug APK build/upload. The PR's deployed-backend smoke skip is intentional;
  the main push must execute that smoke check before branch cleanup.
- WP32 web: run `37219280649`, job `111486131284`, GREEN, **54 checks**:
  11 runner, 11 failure injection, 11 component, 10 browser, 3 accessibility,
  and 8 layout. Final-suite web job `111510178323`: GREEN, 54 checks.

## Seven original targets

| Target | Root cause and repair | Isolated proof |
| --- | --- | --- |
| corrupt-encrypted-media | Harness stalled during nested adb enumeration/writes; enumerate first, bound operations and verify injected bytes. Once reached, a real product defect was reproduced: completed media startup verification blocked unrelated finances on corrupt attachments. Catch only known integrity failures after successful key unwrap; on-demand reads still reject corruption, keys/unfinished migration remain fail closed, and files/metadata/finances are preserved. | `37161873538` attempt 2, job `111465950153` |
| import-v1 | Test expected `Import Backup`; native title is `Import Backup Preview`. Correct selector; no import implementation change. | `37159757487`, job `111310579131` |
| app-lock-setup-auth | SystemUI helper expected literal PIN/digit nodes absent from this emulator. Use actual `lockPassword` field and require successful authentication. | `37159757487`, job `111310579043` |
| app-lock-timeout | Target was blocked by that shared authentication helper; product timeout was not shown broken. | `37159757487`, job `111310579080` |
| app-lock-cancel-retry | Android has credential entry plus an underlying cancel prompt. Cancel both stages, require app cancellation feedback, then successful retry. | `37161873538` attempt 2, job `111465950055` |
| v14-seed | Legacy budget selector differed; keyboard/physical viewport obscured PIN/photo controls. Correct semantic selector and reuse required keyboard-dismissal/scroll gestures. Frozen APK source unchanged. | `37161873538` attempt 2, job `111465950316` |
| hardened-upgrade | Device PIN was configured before legacy onboarding; later failures were an omitted placeholder, offscreen photo control and expectation of the manual app lock screen during a correct direct SystemUI cold-start challenge. Order OS setup after seed, enter already-focused legacy PIN, scroll to photos, and require native authentication with ledger hidden. No migration implementation change. | `37215799249`, job `111475927746`; combined dependency candidate `37216763948`, job `111478733902` |

The narrow completed-media corruption repair is the actual product defect in
the seven-target repair stage. The remaining target repairs are selectors,
gestures, shared SystemUI automation or device/bootstrap ordering. Earlier WP32
also repaired independently reproduced modal-focus/navigation accessibility
and pending-delete restoration behavior; those changes received code review.

## Full-run failure and renewed acceptance

First final attempt `37217373384` on integrated source
`83337edb60e3278a5057094be8c3ec086f7200c4` passed 12 flows, then failed
the import-v3-data success-message observation. Artifact `11308949601` shows
the exact correct receipt painted; original WebView AX contains it, while
Android's original native tree omits the banner and Dismiss button. A focus-main
probe exposes both. The subsequent animation probe does not isolate animation
from that focus change and is not claimed as separate root-cause proof.

The test-only repair waits for the preview to close, uses ordinary Back/reopen
navigation without repeating the restore, then requires the exact receipt,
budget, both ledger entries and no attached photos. A real two-expense browser
restore/reentry check passed. This observes success after navigation; it does
not claim to repair immediate native announcements or prove TalkBack behavior.
The isolated target passed before renewed full acceptance was launched.

Two inspected `packageDebug`/fixture-packaging failures occurred before native
tests; narrow retries passed. Billing failures had zero runner steps: the
account exhausted its shared included private-repository Actions minutes with
a $0 stopping budget. After the user made SpendWise public, jobs executed.
This was the account's private Actions allowance, not a per-repository quota.

## Source and changed files

Starting repair commit: `43e87e33bb45cadf4caa39570add4ffbf270b252`.
Repair milestones: `7399b6d6ec473d93b1c90456f1ae89809b47a4b9`,
`4bd98fbc7d5eacfa342d233c79439f67ec1dfe05`,
`1f255cae810a7191e913e80e5d87e071ab7db35d`, and
`253639e561c9ed822ea9ab892b32125d4d81eb4e`.
Intermediate truncated-source commit `8977777` is not acceptance evidence.

Repair files: both WP32 workflows; current App Lock cancel/retry, corruption,
v1 import and v3-data import flows; Android PIN helper; v1.4 seed and hardened
verify flows; full/isolated runners and shared Android helpers;
`src/utils/attachmentStorage.ts`; runner/failure-injection regression tests;
this report and `WP32_HANDOFF.md`.

Dependency PR #31 commit `15637b28cd8c257a1a258ec674c87a5a098d9024` is retained
as the second parent of integration commit `83337ed`. Only Share 8.0.2 and
Lucide 0.577.0 are updated; WP32 scripts and Playwright pin remain unchanged.
Combined Build/web/hardened checks passed before the full run. Merge must
retain ancestry so the dependency PR's work is included.

Version 2.0 packaging changes only current release metadata, six existing
version expectations, README/runbook, and the signing-artifact workflow.
Version is `2.0.0`, Android code `6`; the frozen v1.4 migration fixture remains
at its original source. The signed artifact checks `com.spendwise.app`, version,
signature and the previous official certificate, and contains SHA256SUMS plus
the exact checkout source/run receipt. Public publishing remains tag-only.
No public release/tag is created by the local trial-APK request.

## Remaining validation and preserved work

- Physical-device installation/use and manual TalkBack checklist in
  `WP32_TESTING.md` remain separate. Automated results are not process-kill,
  OEM-device or TalkBack proof.
- The pre-existing unpublished `tests/e2e/browser/backup.spec.ts` edit and
  untracked `SpendWise-v1.3.0-release/` are preserved. Its additional light-theme
  contrast check was observed failing locally; it is outside the published
  WP32 repair/test count and is not claimed green. Dark-theme check passed.
- No WP33/WP34 work. APK delivery and main CI/branch/PR receipts identify the
  final packaging and merge SHAs without treating older diagnostics as current.
