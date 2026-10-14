<img src="public/app-icon.png" alt="SpendWise app icon" width="72" height="72">

# SpendWise

A local-first expense tracker and monthly budget planner for Android and the web. Built with React, TypeScript and Capacitor, with encrypted Android storage and optional Gemini assistance.

**Latest stable release: 2.1.4 · Android versionCode 14 · Product development complete.**

[Download Android APK](https://github.com/RyanEid06/SpendWise/releases/latest/download/SpendWise-v2.1.4.apk) · [Release notes](docs/RELEASE_NOTES_2.1.4.md) · [Documentation](docs/README.md) · [Freeze record](docs/FREEZE.md)

## Features

- Monthly budgets, remaining-money summaries, category breakdowns and top expenses.
- Manual expense entry and editing, optional descriptions and notes, and up to eight photos per expense.
- Searchable History, delete/Undo, and Statistics across multiple periods.
- Optional AI insights, Smart Capture and receipt scanning, with deterministic financial calculations and local analysis when available.
- Private media with date/category filters and integrity checks.
- Encrypted backups with or without photos, legacy backup import and CSV export.
- Android App Lock with strong biometrics and supported device credentials, encrypted database/media, and protected unfinished drafts.
- English, French and Arabic/RTL; light, dark and system themes; eleven currencies.

Financial records stay on the device. Invoking optional AI features sends the selected data to the backend/Gemini. Currency conversion defaults are dated suggestions, not a live exchange-rate feed.

## Engineering

| Area | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite and Tailwind CSS |
| Android | Capacitor, native Java integrations and Android Keystore; API 24 minimum, compile/target 36 |
| Local storage | SQLCipher database and AES-GCM media protection on Android; browser-local persistence on the web |
| Backend | Express, installation-signed authentication and durable PostgreSQL installation identities |
| AI | Google Gemini with bounded requests, cancellation, schema validation and deterministic financial facts |
| Quality | Node regression tests, Playwright browser/accessibility/visual tests, Maestro Android flows and native instrumentation |
| Delivery | GitHub Actions, permanent-signed APKs, checksums, source receipts and a CycloneDX dependency SBOM |

## Run locally

Use **Node.js 22** and npm. Android development also requires JDK 21 and Android SDK 36.

```bash
npm ci
```

Copy `.env.example` to `.env`, then start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. Manual tracking works without a provider key. Set the server-only `GEMINI_API_KEY` for optional AI; keep provider keys and signing material out of `VITE_*` variables.

```bash
npm run verify
node --import tsx --test tests/*.test.ts tests/*.test.cjs
```

For browser tests, install Chromium with `npx playwright install chromium`, then run `npm run test:wp32`. The `wpNN` script names identify retained regression suites.

For Android, run `npm run android:sync`, then from `android/` run `.\gradlew.bat assembleDebug` on Windows or `./gradlew assembleDebug` on Unix. Debug output is `android/app/build/outputs/apk/debug/app-debug.apk`. See the [development guide](docs/DEVELOPMENT.md) for backend configuration and native test prerequisites.

## Release and verification

The owner accepted 2.1.4 after phone testing on 2026-10-14. Required application CI passed, including **687/687 Node/PostgreSQL tests**, browser/accessibility/visual checks, Android acceptance, encrypted recovery and native instrumentation. The official public APK was independently checked for its permanent signature, package/version, checksum, source receipt and 16 KiB native alignment. [Verification evidence](docs/VERIFICATION.md) and the [public release receipt](docs/WP38_PUBLIC_RELEASE.md) identify the exact sources and runs.

Install the official APK as an update; preserve app data and do not uninstall or clear storage. The accepted test APK has identical shared contents; its only extra file records private build provenance. There is no need to replace an already working 2.1.4 test installation.

Production Gemini routing/live-provider behavior and exhaustive device/API/OEM/TalkBack coverage are separately documented limits. Automated checks and owner acceptance do not claim those broader certifications.

## Repository guide

| Path | Purpose |
| --- | --- |
| `src/` | Application UI, features, local repositories and security services |
| `server/`, `server.ts` | API, Gemini services and installation authentication |
| `android/` | Native Android integrations, resources and instrumentation |
| `tests/`, `.maestro/` | Regression tests, synthetic fixtures and Android flows |
| `scripts/`, `.github/` | Verification, build and release tooling |
| `docs/` | Current guides, release evidence and dated engineering history |

Start with the [documentation index](docs/README.md), [security boundaries](docs/SECURITY.md) and [release runbook](docs/RELEASE.md). Generated builds, local evidence, runtime state and signing material are excluded from Git.

SpendWise is frozen at **2.1.4** with no planned feature work or routine dependency upgrades. Future changes require an explicit owner decision; the [freeze record](docs/FREEZE.md) defines the accepted checkpoint and remaining operational limits.
