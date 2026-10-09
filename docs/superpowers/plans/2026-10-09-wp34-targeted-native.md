# WP34 targeted native checks implementation plan

> Execute inline using superpowers:executing-plans. The owner's current request supplies the design and execution authorization.

**Goal:** Reach the repaired WP34 flow quickly, then run every remaining native phase; reserve the complete native sequence for main.

**Architecture:** Keep the existing guarded full runner as the default. Add an explicit `wp34-tail` phase that installs the current APK, onboards and restores the existing synthetic encrypted nine-photo fixture, runs the unchanged WP34 assertions, then falls through to the existing backup/compatibility/benchmark/lock/upgrade phases. Select this phase only for the freeze PR or explicit dispatch. Main dispatch defaults to full.

**Tech stack:** Bash, Maestro, GitHub Actions, Node test runner.

**Spec:** Owner request in this chat, 2026-10-09: cancel redundant branch full suite, run repaired failure and all remaining phases, merge on green phase coverage, full final main check.

## Constraints and review focus

- Preserve emulator-only guards and every existing assertion; invalid phase fails before ADB mutation.
- Fixture restore is a prerequisite, not new gallery/picker acceptance. Earlier real-gallery flow success remains source-pinned evidence.
- A failure in the WP34 flow or any later phase must propagate. No early success exit after UI.
- Default/main runs execute the original full sequence, including splash/gallery/continuity.
- Targeted receipts must explicitly identify their scope and never claim full-native coverage.

## Task 1: Guarded targeted phase and dispatch

- [x] Add executable regression tests for invalid phase rejection, encrypted bootstrap then WP34 failure propagation, and continuation into export after successful WP34. Run them red.
- [x] Modify `scripts/run-wp32-android-e2e.sh` to validate `WP32_NATIVE_PHASE=full|wp34-tail` before device access, preserve full prefix, bootstrap targeted state, and share the unchanged tail.
- [x] Modify `.github/workflows/wp32-e2e.yml` with an explicit choice input default full and freeze-PR phase selection. Do not change full default on main or bypass checks.
- [x] Update `docs/WP34_FINAL_GATE.md` to describe targeted branch phase coverage and final full main coverage.
- [x] Run focused runner/UI tests, Bash syntax, actionlint and diff whitespace; inspect the complete patch. Results:23/23 passed; fresh read-only review found no concrete defect. Commit/push only scoped files next.
- [ ] Retain evidence for prior green phases, dispatch/recheck targeted tail and current isolated gates; update heartbeat/checkpoint. On green, proceed with authorized merges and final full main suite.
