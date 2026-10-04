# WP32 Isolated Native Diagnostic Report

Date: 2026-10-04
Branch: `wp32/e2e-hardening`
PR: #30
Primary isolated runs: `37123283989`, `37123314002`
Original diagnostic head: `30147beef70ad9556799bbc421b368d713492f61`

## Executive status

### Current checkpoint: public-repository CI restored

Completed-media repair head: `4bd98fbc7d5eacfa342d233c79439f67ec1dfe05`.
Latest tested legacy-seed head: `7e4507aa589a69cab9c0b3eb13fa903a023a12b4`.
Local HEAD, origin tracking ref, and live branch match; ahead/behind is **0/0**.
All ten second-batch changed-file blob SHAs were independently matched to local
bytes. Publication initially transferred a truncated source payload in commit
`89777777a81857221c11a18eaa095ab0fdcd4567`; the published head corrects it and
includes the runner regression. That intermediate commit is not acceptance evidence.

Earlier GitHub attempts on the corrected head failed before any job steps:

- isolated native run `37161873538`: all four jobs have zero steps;
- Android Build run `37161873533`: `verify-debug` has zero steps;
- WP32 web run `37161873506`: `web-e2e` has zero steps, including one narrow
  infrastructure retry (job `111317165609`).

The user's GitHub annotations and billing screenshots establish the cause:
the account consumed all **3,000/3,000 included Actions minutes**, with an
Actions budget of **$0** and stop-usage enabled. No application assertion ran
in those attempts. The included allowance showed a reset in 29 days.

The user explicitly authorized changing `RyanEid06/SpendWise` to public and
performed the CLI visibility change. The connector verified `private=false`
and `visibility=public` on 2026-10-04. Retrying only the failed jobs in the
three runs above now starts real runner steps. The private-repository included
usage barrier is resolved; the earlier failures were billing infrastructure,
not product or test failures.

Restored-runner results on the same source head:

- Isolated run `37161873538`, attempt 2: corruption (`111465950153`),
  cancellation/retry (`111465950055`), and v1.4 seed (`111465950316`) pass.
  Hardened upgrade (`111465950165`) fails in its legacy seed bootstrap at
  `Confirm PIN`; upgrade verification is not reached.
- Android Build `37161873533`, attempt 2, job `111465964722`: **GREEN**,
  **226 Node checks**, dependency audits, web verification, sync, APK build,
  and debug APK artifact `11306633130`.
- Web E2E `37161873506`, attempt 3, job `111465980049`: **GREEN**, **54 checks**
  (11 runner, 11 failure injection, 11 component, 10 browser, 3 accessibility,
  8 layout). Full native intentionally skipped.

Confirmed native coverage is **21/22**, comprising the protected 15, three
first-batch targets, and three second-batch targets above. Only hardened upgrade
remains unproven; its isolated matrix is now reduced to that one target. The final
sequential 22-flow suite has **not been launched**; its label is still withheld
until all isolated targets pass. WP32 remains incomplete; no merge or WP33/WP34.

Local corrected-source validation: **237/237 Node checks** (including 11 runner
and 11 failure-injection checks), **11/11 components**, and the published 21
browser/accessibility/layout checks pass in installed Chrome. TypeScript/Vite
and shell syntax pass. These do not replace native or Android APK acceptance.
The pre-existing uncommitted browser test adds two contrast checks: its light
theme check fails (observed ratio 1.0955 versus required 4.5), while dark passes.
That edit is preserved, excluded from publication, and outside this repair scope.
Current-source Android Build and web CI are green as recorded above.

Changed implementation/automation files since the objective's starting commit:
`.github/workflows/wp32-e2e.yml`, `.github/workflows/wp32-isolated-gates.yml`,
`.maestro/current/import-v1.yaml`, `.maestro/helpers/android-device-pin.yaml`,
`.maestro/current/app-lock-background-cancel-retry.yaml`,
`.maestro/current/corrupt-media.yaml`, `.maestro/migration/v14-seed.yaml`,
`.maestro/migration/hardened-verify.yaml`,
`scripts/wp32-android-helpers.sh`, `scripts/run-wp32-isolated-gate.sh`,
`scripts/run-wp32-android-e2e.sh`, `src/utils/attachmentStorage.ts`,
`tests/wp32-android-runner.test.ts`, and `tests/wp32-failure-injection.test.ts`.
This report and `WP32_HANDOFF.md` record the checkpoint. User's browser edit and
untracked release folder are preserved. Real-device/TalkBack checks remain open.

### Final isolated repair, 2026-10-04

Hardened upgrade artifact `11306668428` shows the legacy app alive with the
first PIN entered and Android's keyboard covering the confirmation field.
The native screenshot and WebView accessibility tree establish a **test viewport
defect**, not an app crash or migration defect. The same legacy seed passed in
its independent job, explaining why this timing-sensitive assumption survived.

The shared legacy seed now dismisses the keyboard and scrolls to the required
`Confirm PIN` and agreement controls before tapping. Assertions remain required,
the old APK remains frozen, and no production code changes. The hardened-upgrade
job reruns the entire seed followed by migration verification; previously green
isolated targets are excluded from the matrix. The seed repair is verified
in run `37213179650`: the seed passes in 1m 42s. Upgrade verification
then reaches the correct migration lock screen but fails at `Enter PIN`.
Artifact `11307397681` exposes a focused native password `EditText` with no
placeholder text; WebView layout identifies the same active input and its
HTML `Enter PIN` placeholder. **Stale native selector**, not migration failure.
The flow now enters the old PIN into this already-focused field, as the proven
legacy unlock does. Required migration prompt, real device authentication,
ledger/budget/photo retention, and subsequent native unlock checks are retained.
This target repair is pending native proof. Full sequential acceptance remains
withheld until it passes. Build `37213179638` and web `37213179641` are green
on the seed repair head.

Head `00f1d37ca67a45d3d8f24889999cf89168a0fce7`, run `37213890908`:
attempt 1 stops packaging the immutable v1.4 fixture (`:app:packageDebug`,
underlying Gradle cause unreported), before native tests. One narrow retry
successfully packages it, passes the seed and real legacy/device authentication,
then proves retained ledger and $1,250 budget. The remaining failure is the
editor's `Attach Photos` control: artifact `11307169556` shows
`Attach Photos · 1` below the modal viewport with zero native bounds.
**Test scrolling defect**, not lost media. The target now uses the protected
media flow's two modal scroll gestures and post-expansion scroll; photo preview
and restart/unlock assertions remain required. Native proof is pending.
Build `37213890915` and web `37213890920` pass on this head.

Head `613f422333742ad409905c63f2802c362ee3a91d`, run `37214978728`,
passes migrated-photo inspection, then fails expecting the application's manual
lock screen after cold restart. Artifact `11307968396` shows Android SystemUI
`Unlock SpendWise` and `lockPassword`. `src/main.tsx` deliberately authenticates
migrated native users before opening protected storage; the fallback app screen
appears after cancellation. **Test expectation defect.** The target now requires
the real system challenge and an invisible ledger, uses the existing credential
helper, and retains ledger/photo verification after unlock. Build `37214978744`
and web `37214978700` pass. Final target proof remains pending.

### Second repair batch, 2026-10-04

Native run `37159757487`, commit `7399b6d6ec473d93b1c90456f1ae89809b47a4b9`,
confirmed `import-v1`, `app-lock-setup-auth`, and `app-lock-timeout` green.
Together with the protected baseline, confirmed coverage is **18/22**. Only
the following four red targets remain in the isolated matrix:

| Target | Artifact evidence and classification | Minimal repair |
| --- | --- | --- |
| corrupt-encrypted-media | Injection verified all nine corrupt files in about three seconds; the target then reached the app's local-data safety screen. **Product defect:** completed-media startup verification blocked unrelated finances on an attachment integrity error. | Isolate known media-envelope/authentication failures after successful key unwrap in the completed migration fast path. Authenticated reads still reject corruption; missing/invalidated keys and unfinished migrations still fail closed. Assert all eight thumbnails unavailable, no preview, and retained ledger/budget. |
| v14-seed | Budget selector passed; tapping Attach Photos during keyboard dismissal did not expand the editor. Accessibility state remained `expanded=false`. **Test gesture defect.** | Reuse the protected media gate's keyboard dismissal and modal scroll sequence. Old fixture APK unchanged. |
| hardened-upgrade | Failure before legacy onboarding; SystemUI lockscreen visible and SpendWise process present but stopped with the device sleeping. **Device/bootstrap ordering defect.** | Configure the OS PIN after seeding the legacy app; clear the preceding suite's PIN before legacy seeding in the full runner. Legacy application PIN coverage remains required. |
| app-lock-cancel-retry | Setup/authentication/timeout bootstraps passed. Back left SystemUI's authentication prompt open (`Tap to cancel authentication`). **Test cancellation sequence defect.** | Wait for the credential field, exit it, wait for the underlying prompt, then cancel that prompt. Require the application's cancellation message and successful retry. |

Artifacts: `11287283475` (corruption), `11287232207` (seed), `11287128507`
(upgrade), and `11286899785` (cancel). Corruption behavior follows
`SECURITY_ARCHITECTURE.md`'s per-attachment integrity-failure requirement.
Production changes are confined to completed media migration verification;
there is no migration redesign or unauthenticated-byte fallback.

Local checks: **11/11 runner checks**, **11/11 failure-injection checks**,
**15/15 WP29**, **14/14 WP30**, and TypeScript/Vite verification. Native
acceptance of this second batch remains pending. The native-boundary regression
reproduced the product failure before the repair and checks truncated media,
tampered authentication tags, missing/invalidated keys, unfinished migration,
unchanged finances, and preservation of files.

Broad CI on `7399b6d6ec473d93b1c90456f1ae89809b47a4b9`: Android Build run
`37159757496` passed **225 Node checks** and uploaded debug APK artifact
`11286723850`; WP32 run `37159757480` passed **48 web checks**. Full native
acceptance was intentionally skipped pending isolated greens. No merge,
WP33/WP34 work, or manual real-device/TalkBack acceptance has occurred.

### Repair batch, 2026-10-04

Starting commit: `43e87e33bb45cadf4caa39570add4ffbf270b252`.
The four artifact-backed repairs below change only test automation:

- v1 preview selector uses `Import Backup Preview`.
- v1.4 budget selector uses `Set Monthly Budget`.
- Shared Android credential helper targets SystemUI `lockPassword`, enters the
  synthetic device credential, submits it, and requires the field to disappear.
- Media injection finishes path enumeration before writes, uses a remote
  non-streaming overwrite, bounds each adb operation to 15 seconds with a
  2-second kill grace, and verifies the injected bytes. Enumeration, missing
  media, timeout, or unsuccessful overwrite fail explicitly.

The local regression reproduced nested adb during unfinished enumeration before
the repair. Native verification is pending. No production defect is established
by this batch, and no app code, security behavior, or assertion is weakened.
The isolated matrix now contains only the seven remaining targets, with
fail-fast disabled. Full native acceptance is gated by workflow dispatch or
the PR label `wp32-final-native`, applied only after isolated acceptance.
The pre-existing local browser contrast test edit remains outside this batch.

Local verification: **10/10 Android harness regressions**, **6/6 failure
injection checks**, TypeScript/Vite build, shared/isolated shell syntax, and
`git diff --check` pass. The injected write-hang regression fails explicitly
after approximately 15 seconds instead of hanging until CI's job timeout.
Git Bash/esbuild needed execution outside the Windows sandbox because its
ancestor-directory checks otherwise fail with access denied.

Live starting-commit CI was checked: Android Build run `37125758075`
(`verify-debug`) is green, and WP32 run `37125757939` has green `web-e2e`.
Its native job was canceled; that is not full-suite acceptance.

The user explicitly approved publication of the eight-file repair batch to
`RyanEid06/SpendWise`, branch `wp32/e2e-hardening`, and execution of WP32 CI.
Post-repair native verification is pending. No merge is authorized.

Final full sequential 22/22 acceptance has not been executed after these repairs.
Manual real-device/TalkBack validation remains outstanding.

WP32 is **not blocked by 7 confirmed product bugs**.

The isolated matrix proved **15 of the 22 native Android acceptance flows green**. The remaining 7 are **unproven**, and the available artifacts point primarily to test-harness/emulator problems rather than production SpendWise defects.

Outside the 22 native flows:
- **Android Build / verify-debug: GREEN** on current head before this report.
  - dependency audits
  - web build
  - regression tests through WP32
  - Capacitor Android sync
  - debug APK build + artifact upload
- **WP32 web-e2e: GREEN** on the current full WP32 run.
  - application verification
  - runner/failure-injection checks
  - component/browser/accessibility/visual coverage
- **Full sequential android-e2e:** still running at report time and is not yet a final acceptance result.
- **signed-release:** intentionally not applicable on a PR; runs only for a version tag.
- **deployed Gemini backend smoke:** intentionally not applicable on a PR; runs on main/tag push.
- **manual/device smoke / TalkBack:** still remains a separate final device-validation item if required by the release checklist.

The diagnostic matrix is evidence gathering only. The final WP32 acceptance gate remains one clean full sequential native run after the actionable red/unproven items are repaired.

## Native 22-flow score

### Confirmed green: 15 / 22

Previously proven green in the deep sequential diagnostic:
1. `empty-navigation`
2. `fresh-persistence`
3. `delete-undo`
4. `delete-background-verify`
5. `offline-ai`
6. `media`
7. `export-v3-data`
8. `export-v3-full`
9. `clear-before-v3-full`

Confirmed by the isolated matrix:
10. `import-v3-full` — green in both valid matrix runs.
11. `clear-before-v3-data` — green in both valid matrix runs.
12. `import-v3-data` — green in run `37123283989`; the later identical-code run failed only on a result visibility assertion, so the clean pass is retained as valid functional evidence.
13. `import-v2-data` — green in run `37123283989`; the later identical-code run failed at onboarding/Language with the app process disappearing, so the clean pass is retained as valid functional evidence.
14. `import-v2-full` — green in both valid matrix runs.
15. `app-lock-setup` — green in both valid matrix runs.

### Unproven / actionable: 7 / 22

These are not all production defects. Classification and smallest valid repair follow.

---

## 1. corrupt-encrypted-media

**Classification:** TEST HARNESS HANG — target flow never executed.

Evidence:
- Both isolated runs successfully completed onboarding and the full v3 restore bootstrap.
- Both then stalled after `restore-v3-full-bootstrap`.
- The jobs were canceled by the 35-minute job timeout.
- No target `corrupt-media.yaml` result was produced.
- The stall is inside/around `corrupt_secure_media_files`, not inside the SpendWise corruption UI path.

Likely harness cause:
- The helper performs nested adb/process-substitution work and overwrites files through `adb exec-out run-as ... tee`.
- No explicit timeout bounds the individual adb corruption operation.

Smallest repair:
- Keep production code untouched.
- Make corruption injection deterministic and bounded:
  1. collect the secure-media file list first (do not keep a `find` adb process open while issuing nested adb writes),
  2. overwrite each known secure file with a non-blocking method,
  3. put a short timeout around each adb write,
  4. fail with a direct harness error if corruption cannot be injected.
- Then run only `isolated-corrupt-encrypted-media`.

---

## 2. import-v1

**Classification:** TEST SELECTOR BUG + one emulator/GMS-flake run. Production behavior visibly reached the correct preview.

Evidence from run `37123283989`:
- The screenshot clearly shows the valid legacy backup preview open.
- Visible title: **“Import Backup Preview”**.
- The test asserts **“Import Backup”**.
- The UI shows 2 expenses, 1 monthly budget, USD, merge/replace options, and `Merge & Import`.
- Therefore the v1 file was read and previewed successfully; the assertion is stale.

Evidence from the later run:
- It failed much earlier at `Language`, with the launcher visible and Google Play Services processes restarting.
- That second failure does not prove a SpendWise v1-import defect.

Smallest repair:
- Change the stale v1 preview assertion from `Import Backup` to the actual stable semantic title `Import Backup Preview` (or an intentionally safe exact/anchored equivalent).
- Do not change production import logic unless a later target assertion proves a real defect.
- Run only `isolated-import-v1`.

---

## 3. app-lock-setup-auth

**Classification:** ANDROID SYSTEM-UI TEST HELPER BUG. SpendWise correctly opened the OS credential screen.

Evidence:
- The failure artifact shows the Android SystemUI credential window is active.
- Native tree contains:
  - `Unlock SpendWise`
  - `Enable SpendWise App Lock`
  - resource id `com.android.systemui:id/lockPassword`
- Current helper waits for text matching `.*PIN.*`.
- This SystemUI screen does **not** expose literal `PIN` text.
- The current helper also expects visible digit nodes; the captured tree exposes the credential edit field instead.

Smallest repair:
- Keep SpendWise production auth code untouched.
- Update `.maestro/helpers/android-device-pin.yaml` to synchronize on the actual SystemUI credential UI (for example `Unlock SpendWise` and/or `com.android.systemui:id/lockPassword`).
- Enter `2468` into the credential field and submit, rather than depending on visible keypad digit text that is not present in this emulator tree.
- Run only `isolated-app-lock-setup-auth`.

---

## 4. app-lock-timeout

**Classification:** UNPROVEN TARGET; blocked by the same SystemUI PIN helper and one emulator/bootstrap failure.

Evidence:
- One run passed `app-lock-setup-start`, then failed in `android-device-pin` because `.*PIN.*` was not visible.
- The other run failed earlier at onboarding/Language and did not reach the timeout configuration target.

Smallest repair:
- Do not change production timeout behavior yet.
- Fix the shared Android credential helper first.
- Add only minimal bootstrap resilience for cases where the emulator drops/kills the app before onboarding; do not redesign production UI for CI.
- Run only `isolated-app-lock-timeout`.

---

## 5. app-lock-cancel-retry

**Classification:** UNPROVEN TARGET; bootstrap/emulator failure before the cancellation/retry flow.

Evidence:
- Both valid matrix attempts failed during the prerequisite App Lock setup at the onboarding `Language` gate.
- The actual cancel/retry target never ran.

Smallest repair:
- Reuse the repaired App Lock credential helper.
- Add a narrow one-time relaunch/retry only when the app process is absent during the bootstrap. Do not hide genuine assertion failures and do not add broad retries everywhere.
- Run only `isolated-app-lock-cancel-retry`.

---

## 6. v14-seed

**Classification:** TEST SELECTOR BUG in the old v1.4 fixture flow.

Evidence:
- Both runs fail on `Element not found: Set Budget`.
- Failure screenshot visibly shows the budget card/control.
- Native accessibility tree exposes the clickable control as **`Set Monthly Budget`**.
- `Set Budget` is visual child text, not the semantic Android node Maestro is selecting.

Smallest repair:
- Update `.maestro/migration/v14-seed.yaml` to tap the actual semantic control `Set Monthly Budget` (or a carefully anchored equivalent).
- Do not modify the v1.4 APK or current production UI for this selector mismatch.
- Run only `isolated-v14-seed`.

---

## 7. hardened-upgrade

**Classification:** UNPROVEN TARGET; blocked by the v1.4 seed bootstrap.

Evidence:
- Both isolated attempts fail during `v14-seed` before the current APK is installed over the old app.
- No evidence yet shows a failure in the hardened migration itself.

Smallest repair:
- Fix `v14-seed` first.
- Re-run `isolated-hardened-upgrade`.
- Only modify migration production code if the target flow itself then fails after the seed completes.

---

## Emulator / Google Play Services noise

Several later failures show cold-boot adb instability and/or Google Play Services process churn. At least one artifact lands on the Android launcher with the SpendWise process absent.

SpendWise does not need to be redesigned around Google Play Store requirements for this project. A CI emulator/GMS failure is not a production app defect by itself.

Rule for WP32 repairs:
- if the app feature is actually broken, fix production code;
- if the selector is stale, fix the Maestro flow;
- if Android SystemUI semantics changed, fix the helper;
- if the emulator/app process disappears before the target executes, classify it as infrastructure/bootstrap and use only narrow deterministic recovery;
- do not weaken assertions that are proving real product behavior.

## Maximum-efficiency repair strategy

Do **not** rerun all 22 after each repair.

First repair only the seven unproven gates above, with the smallest possible harness/test changes. Then run the affected isolated gates in parallel:

1. `isolated-corrupt-encrypted-media`
2. `isolated-import-v1`
3. `isolated-app-lock-setup-auth`
4. `isolated-app-lock-timeout`
5. `isolated-app-lock-cancel-retry`
6. `isolated-v14-seed`
7. `isolated-hardened-upgrade`

If some turn green and some remain red, rerun **only the remaining red subset**. Continue shrinking the set.

Do not touch or rerun already-proven green product behavior unless a shared helper change directly requires a small regression check.

Once the isolated set is 7/7 green:
1. run one full sequential WP32 Android 22-flow suite;
2. verify Android Build remains green;
3. verify WP32 web-e2e remains green;
4. perform the appropriate final APK/device/manual checks;
5. only then declare WP32 complete and move to the next WP.

## Codex operating constraints

- Work only on `wp32/e2e-hardening`.
- Do not merge.
- Do not start WP33/WP34.
- Do not rewrite working production architecture to satisfy Maestro.
- Treat existing 15/22 native greens as protected evidence.
- Prefer test/harness fixes when artifacts prove the product UI/function already works.
- Do not add blanket retries or weaken meaningful assertions.
- After each fix batch, run only the affected isolated jobs.
- Save the full sequential suite for final acceptance after the isolated red set reaches zero.
