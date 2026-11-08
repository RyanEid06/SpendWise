<img src="public/app-icon.png" alt="SpendWise app icon" width="72" height="72">

# SpendWise

A local-first expense tracker and monthly budget planner for Android and the
web, built with React, TypeScript, Capacitor, and Express.

**Current version: 2.1.4 · Android versionCode 14 · Product frozen**

[Download the official Android APK](https://github.com/RyanEid06/SpendWise/releases/latest/download/SpendWise-v2.1.4.apk) · [Latest release and notes](https://github.com/RyanEid06/SpendWise/releases/latest) · [Release details](docs/WP38_PUBLIC_RELEASE.md)

Install the APK as an update over an existing SpendWise installation. Do not
uninstall the app or clear its storage when updating.

## Features

- Monthly budgets, remaining-money summaries, category breakdowns, and expense
  history.
- Search, edit, delete/Undo, statistics, and up to eight photos per expense.
- Optional AI insights and receipt scanning; financial calculations remain
  deterministic.
- Encrypted backups, legacy backup import, CSV export, and protected Android
  media.
- Android App Lock, English/French/Arabic with RTL, light/dark/system themes,
  and eleven currencies.

## Platforms and privacy

Manual tracking works without a provider key. Financial records stay on the
device. Android protects financial storage with encrypted SQLCipher and media
with AES-GCM; the web app uses browser-local storage. Optional AI features send
the selected data to the configured backend and Gemini service.

The web application runs locally with Node.js 22 and npm. There is no verified
public web deployment linked to this repository.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. To build a local Android debug app, install JDK 21
and Android SDK 36, then run:

```powershell
npm run android:sync
cd android
.\gradlew.bat assembleDebug
```

The debug APK is for development; use the official v2.1.4 release link above for
the published app.

## Documentation

[Release notes](docs/RELEASE_NOTES_2.1.4.md) · [Security boundaries](docs/SECURITY.md) · [Release record](docs/WP38_PUBLIC_RELEASE.md)
