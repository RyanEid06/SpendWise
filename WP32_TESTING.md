# WP32 executable test architecture

WP32 replaces source-shape confidence with executable tests while retaining useful invariant tests.

## Selected tooling

- **Rendered components:** Playwright + a Vite component harness. This uses the real React components,
  DOM, CSS and browser accessibility tree without migrating the existing Node/tsx suite to another runner.
- **Browser integration:** Playwright Chromium against the built Vite application.
- **Android black-box:** Maestro CLI against a real Android emulator and the built debug APK.
  Maestro was selected because it drives the application through accessibility/text/system selectors,
  can interact with Android system UI, and does not require a test-only authentication bypass.

No production security bypass is added. Fixed test passphrases protect only synthetic test data.

## Layers

1. Existing Node/tsx unit and regression tests remain mandatory.
2. `tests/e2e/components/` renders real Settings, History, dialogs, Backup v3 controls and Undo.
3. `tests/e2e/browser/` runs real first-run, persistence, Settings, delete/Undo and Backup v3 flows.
4. `tests/e2e/visual/` checks meaningful overflow/layout invariants at phone widths.
5. `tests/e2e/accessibility/` verifies semantic names, keyboard access and modal behavior.
6. `tests/wp32-failure-injection.test.ts` injects storage, restore, media and key failures.
7. `.maestro/` contains Android emulator black-box flows.

## Android gate and regression safeguards

`run-wp32-android-e2e.sh` runs the entire native suite, including the v1.4 upgrade
fixture. The targeted backup runner is a debugging aid and does not satisfy WP32.
CI checks both shell entrypoints before emulator work and tests their shared backup
extraction and encrypted-media fault injection against a fake adb boundary.
Maestro owns app launch and readiness after each reset and upgrade. The host
prepares Android and installs/clears the app, without launching its WebView or
probing its accessibility tree before Maestro attaches.

Portable v1/v2 fixtures use the current emulator month so History verifies the
restored rows without a stale-date mismatch. `WP32_FIXTURE_MONTH=YYYY-MM` allows
reproducible fixture checks. The full v2 fixture includes a valid 1024px JPEG.
Backup v3 recovery checks amounts, budget, and photos again after restart.

The empty-navigation flow verifies that returning from Settings exposes all four
tabs and the Home floating Add Expense action to native accessibility. Viewport
controls use the same body portal as dialogs and Undo: fixed descendants of the
scrolling app container can be painted but absent from Android WebView's native
accessibility tree after remount. DOM-order changes alone did not fix that case.

## Failure artifacts

CI keeps Playwright traces/screenshots/report and sanitized Android screenshots/logs only on failure.
Fixtures are synthetic; production data and secrets must never be archived.

## Manual Android TalkBack smoke checklist

Automated tests do **not** claim TalkBack coverage. Before release, manually enable TalkBack and verify:

- primary navigation announces Home, History, AI Insights, Statistics and Settings with current state;
- Add Expense fields, category controls, optional tools and Save/Cancel have meaningful names;
- History expense cards can be opened, the accessible Delete alternative is reachable, and Undo is announced;
- Settings rows announce their purpose/value and subpage Back returns predictably;
- Backup v3 creation/restore announces passphrase fields, warnings, Merge/Replace and errors without exposing the passphrase;
- App Lock announces its state and authentication action; cancellation leaves the app protected.

## Reliability rules

No arbitrary sleeps, mutable external accounts, real Gemini calls in normal E2E, production secrets,
or security bypasses. Prefer accessibility/text/resource-id selectors and explicit assertions. A failing
deterministic test is fixed rather than hidden behind retries.
