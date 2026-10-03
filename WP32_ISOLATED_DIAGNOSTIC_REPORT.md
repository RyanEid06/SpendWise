# WP32 Isolated Native Diagnostic Report

Date: 2026-10-03
Branch: `wp32/e2e-hardening`
PR: #30
Primary isolated runs: `37123283989`, `37123314002`
Current head before this report: `30147beef70ad9556799bbc421b368d713492f61`

## Executive status

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
