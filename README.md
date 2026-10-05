# SpendWise

SpendWise is a local-first expense tracker and monthly budget planner for Android
and the web. Financial records stay on the device. Optional AI analysis, Smart
Capture and receipt scanning send selected data to the SpendWise backend/Gemini
when invoked.

The public release is **2.0.0**, Android build **6** (`com.spendwise.app`):
[release notes](https://github.com/RyanEid06/SpendWise/releases/tag/v2.0.0) ·
[download the signed APK](https://github.com/RyanEid06/SpendWise/releases/download/v2.0.0/SpendWise-v2.0.0.apk).
It was published on 2026-10-04. `main` also contains the completed WP33 diagnostics
and performance work, which is newer than that APK. Keep the existing release
unchanged; any future APK update needs a version code above 6 and the same signing
identity. See [safe feature work](ROADMAP.md#safe-feature-work-after-20) and
[release instructions](ROADMAP.md#release-operations).

## Features

- Monthly budgets, category breakdowns, remaining-money status and top expenses.
- Manual-first expense entry with optional notes and up to eight photos.
- Dashboard editing; searchable History with read-only details and grouped,
  five-second delete/Undo; multi-period Statistics.
- Optional Gemini insights with deterministic local statistical fallback.
- Private Android media, integrity checks, encrypted Backup v3 (data-only or
  data + photos), legacy v1/v2 import, merge/replace restore and CSV export.
- Android device-credential/strong-biometric App Lock and encrypted database/media.
  Browser PIN protection is a UI privacy lock; browser storage has lower assurance.
- English, French and Arabic/RTL; Light, Dark and System themes; 11 currencies.
  Conversion defaults are dated suggestions, not a live exchange-rate feed.

Home, History, AI Insights and Statistics are the four primary destinations.
Settings opens from the top app bar. [Product constraints](ROADMAP.md#product-constraints)
record the navigation, accessibility and scope baseline.

## Run locally

Use **Node.js 22** (the package requires `>=22 <23`) and npm:

```bash
npm ci
```

Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`). Set a
server-only `GEMINI_API_KEY` for AI features, then start:

```bash
npm run dev
```

Open `http://localhost:3000`. The Express server serves the API and Vite middleware
in development. Manual tracking works without a provider key. Never place a
Gemini key or signing secret in a `VITE_*` variable. See
[backend configuration](ROADMAP.md#backend-configuration-and-authentication) for origins, identity and quotas.

To build and preview the frontend:

```bash
npm run verify
npm run preview
```

`preview` serves the frontend only. For a backend that also serves built `dist/`,
set `NODE_ENV=production` before `npm start`. For Android AI, set
`VITE_API_BASE_URL` to the deployed HTTPS backend before building/syncing.

## Android

Use JDK 21 and an Android SDK installation (compile/target SDK 36, minimum SDK 24):

```bash
npm run verify
npm run android:sync
```

Build a debug APK on Windows:

```powershell
cd android
.\gradlew.bat assembleDebug
```

On macOS/Linux use `./gradlew assembleDebug`. Output is
`android/app/build/outputs/apk/debug/app-debug.apk`. Use the permanent signing
identity in [the release runbook](ROADMAP.md#release-operations) for updates to an installed release.

## Tests and CI

The project retains Node/tsx regression tests, Playwright rendered-component,
browser, accessibility and layout checks, plus Maestro native flows. Install
Chromium and run the executable web suite:

```bash
npx playwright install chromium
npm run test:wp32
```

The `wpNN` names identify existing regression suites; these remain active build
inputs. [Testing](ROADMAP.md#tests-and-recorded-acceptance) lists commands, native runners, fixtures,
recorded acceptance and manual checks. CI builds Android, runs regressions and
checks deployed installation-authenticated Gemini access on `main`/release tags.
Full native E2E runs on manual dispatch or the `wp32-final-native` PR label.

WP32 recorded **22/22 native flows together** and **54 web checks**. These are
historical acceptance receipts, not claims about a new local run. Physical-device,
TalkBack and final production validation remain separate. WP33 is complete and
merged: 329 unique Node checks, 37 web checks, ten performance cases and 22/22
native flows passed on its exact final head. WP34 is deferred until the planned
feature additions are ready; the existing public APK is not WP34-certified.

## Project layout and documentation

| Path | Contents |
| --- | --- |
| `src/` | React app, feature services, repositories and security/platform adapters |
| `server/` | Express API, installation authentication and Gemini integration |
| `android/` | Capacitor native app and Gradle project |
| `tests/`, `.maestro/` | Regression fixtures, web tests and Android flows |
| `scripts/`, `.github/` | Test/build/release orchestration |
| `ROADMAP.md` | Completed work, architecture, constraints, acceptance, remaining work and release operations |

- [All delivered changes and remaining work](ROADMAP.md)
- [Architecture](ROADMAP.md#implemented-architecture)
- [Security and recovery](ROADMAP.md#security-recovery-and-known-limits)
- [Backup v3 format](ROADMAP.md#backup-v3-format-and-compatibility)
- [Testing and acceptance](ROADMAP.md#tests-and-recorded-acceptance)
- [Release runbook](ROADMAP.md#release-operations)
- [Safe feature work after 2.0](ROADMAP.md#safe-feature-work-after-20)

Completed work-package plans and superseded diagnostic/handoff reports are
available in Git history. Generated builds, test reports, runtime state and
signing material stay out of Git.
