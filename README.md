# SpendWise

SpendWise **2.1.2**, Android build **12**, is a local-first expense tracker and
monthly budget planner for Android and the web. Package: `com.spendwise.app`.

**Working and green through WP36 (2026-10-11).** Automated checks passed,
the compatible WP36 backend is live, and the owner confirmed successful phone
testing: “all works nice”. WP37 hardening is now in implementation and validation;
its [approved scope](docs/WP37_SPEC.md) and [progress ledger](docs/WP37_PROGRESS.md)
track the separate review checkpoint.
See [current status and evidence](docs/STATUS.md) and [roadmap](docs/ROADMAP.md).

The current 2.1.2 APK is a private signed test build delivered to the owner.
The latest public release remains [2.1.0 and its verification assets](https://github.com/RyanEid06/SpendWise/releases/tag/v2.1.0).
Main stays untouched until after WP37.

Financial records stay on the device. Optional AI analysis, Smart Capture and
receipt scanning send selected data to the backend/Gemini when invoked.

## Features

- Monthly budgets, remaining-money status, category breakdowns and top expenses.
- Manual expense entry and editing, optional description/merchant and notes, and up to eight photos.
  A blank description saves the selected category's localized display name.
- Searchable History, read-only details, grouped delete/Undo and multi-period Statistics.
- Optional AI insights with deterministic local analysis and offline error handling.
- Private media with All/Day/Category filters, integrity checks and safe repair.
- Encrypted data-only or photo-inclusive backups; legacy v1/v2 import and CSV export.
- Android strong-biometric/device-credential App Lock, encrypted database/media,
  protected unfinished drafts and startup/recovery handling.
- English, French and Arabic/RTL; Light, Dark and System themes; eleven currencies.
  Conversion defaults are dated suggestions, not a live exchange-rate feed.

Home, History, AI Insights and Statistics are the four primary destinations.
Settings opens from the top app bar. The owner accepted the current phone build;
automated and owner-reported evidence is recorded in [verification](docs/VERIFICATION.md).
The reusable [manual checklist](docs/MANUAL_ACCEPTANCE.md) remains available for future regressions.

## Development

Use **Node.js 22**, npm, JDK 21 and an Android SDK (compile/target 36, minimum 24).

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env` and set server-only `GEMINI_API_KEY` for optional AI.
Open `http://localhost:3000`. Manual tracking works without a provider key. Never
put provider keys or signing material in `VITE_*` variables.

```bash
npm run verify
npm run android:sync
```

From the `android` directory, build debug Android on Windows with
`.\gradlew.bat assembleDebug`; on Unix use `./gradlew assembleDebug`.
The output is `android/app/build/outputs/apk/debug/app-debug.apk`. Installed official
releases require the permanent-signed release APK for an update that preserves data.
For Android AI, set `VITE_API_BASE_URL` to the deployed HTTPS backend before building.

## Verification

```bash
node --import tsx --test tests/*.test.ts tests/*.test.cjs
npx playwright install chromium
npm run test:wp32
```

CI retains web/component/accessibility tests, native Maestro flows, encrypted
recovery, API36 FileProvider instrumentation and signed populated-upgrade checks.
The `wpNN` names identify active regressions and fixtures.

## Maintainer documentation

- [Development, backend settings and frozen product constraints](docs/DEVELOPMENT.md)
- [Security, storage, backup and recovery boundaries](docs/SECURITY.md)
- [Signing and release runbook](docs/RELEASE.md)
- [Current green checkpoint](docs/STATUS.md)
- [Completed work and next WP](docs/ROADMAP.md)
- [Private 2.1.2 APK receipt](docs/WP36_PRIVATE_APK.md)
- [2.1 automated verification and artifact provenance](docs/VERIFICATION.md)
- [Owner phone acceptance checklist](docs/MANUAL_ACCEPTANCE.md)
- [Synthetic fixture inventory](tests/fixtures/README.md)

Completed plans and superseded work-package reports were archived locally before
removal from Git and remain recoverable in history. Source, tests, fixtures, build
and release tooling remain in the repository. Generated artifacts, runtime state
and signing material stay out of Git.
