# SpendWise

SpendWise is a privacy-first, local-first personal expense tracker and monthly budget planner for Android and the web. Core financial data remains on the device; Gemini-powered features are optional and use the SpendWise backend only when the user explicitly invokes them.

Current app version: **2.0.0** (Android build **6**, signed local trial).
The last published GitHub Release remains v1.4.0; see `RELEASE.md`.

## Key Features

- **Dashboard & Budget Tracking**
  - Monthly budgets, remaining-money status, proportional spending progress, category breakdowns, and top expenses.
  - Dashboard-only expense editing keeps the main workflow predictable.

- **Manual-First Expense Capture**
  - Amount, description, category, date, and optional note are the primary flow.
  - Smart Capture, receipt scanning, and photo attachment are optional tools opened only when needed.
  - Up to 8 photos can be attached to an expense.

- **History & Statistics**
  - Search and monthly transaction history with swipe-to-delete, a 5-second grouped Undo window, and read-only details.
  - History and Statistics open read-only expense details instead of silently entering edit mode.
  - Pending History deletes remain in storage until Undo expires; backgrounding/termination conservatively restores them.
  - Multi-period statistics, category trends, largest expenses, and large-ledger regression coverage.

- **AI Spending Analysis & Receipt Scanning**
  - Gemini-powered spending analysis with a deterministic local statistical fallback when AI is unavailable.
  - Receipt and Smart Capture flows use bounded server-side requests and validated structured responses.
  - Model selection and fallback models are configured on the backend; see `AI_BACKEND.md`.

- **Private Media & Backup**
  - Encrypted app-scoped Android photo storage; photos are not copied to the device gallery by default.
  - Media Library with integrity checks and conservative repair of safe-to-fix issues.
  - Secure Backup v3 provides passphrase-encrypted **data-only** and **data + photos** backups, validation, merge, replace, and rollback protection.
  - Legacy Backup v1 JSON and Backup v2 ZIP imports remain supported.
  - CSV export is available for spreadsheet use.

- **Privacy, Security & Localization**
  - Native Android App Lock uses device credentials/strong biometrics and an inactivity timeout; web PIN protection uses an Argon2id verifier.
  - Android ledger and private media use encrypted storage with Keystore-backed key protection.
  - Light, Dark, and System themes.
  - English, French, and Arabic/RTL UI.
  - Supported currencies: USD, LBP, EUR, GBP, AED, SAR, EGP, CAD, AUD, JPY, and INR.

## Navigation

SpendWise has four primary destinations:

1. Home
2. History
3. AI Insights
4. Statistics

Settings is a secondary destination opened from the top app bar.

## Tech Stack

The checked-in npm lock currently resolves the trial release line to:

- **Frontend:** React 19.3, TypeScript 5.9, Tailwind CSS 4.3, Lucide React 0.577
- **Backend / Proxy:** Node.js 22, Express 4.22, `@google/genai`
- **Mobile:** Capacitor 8, Android compile/target SDK 36
- **Build Tool:** Vite 6.4
- **Persistence:** native encrypted SQLite plus authenticated encrypted app-scoped media; browser storage has lower assurance

Major upgrades such as Express 5, Vite 8, TypeScript 7, and Lucide 1.x are intentionally not mixed into maintenance updates without a dedicated compatibility pass.

## Roadmaps

- `UX_REFINEMENT_ROADMAP.md` documents the completed v1.4 UX refinement program.
- `PRODUCTION_HARDENING_ROADMAP.md` records WP25–WP32 implementation and the remaining WP33/WP34 plan. WP32 automated acceptance passed; the user approved a signed v2.0 trial before the final production release gate. WP33/WP34 have not started.
- `WP32_ISOLATED_DIAGNOSTIC_REPORT.md` records the complete 22-flow native run, repairs and exact evidence. Manual physical-device/TalkBack checks remain separate.

## Verification

```bash
npm ci
npm run verify
npm run test:reliability
npm run test:currency
npm run test:persistence
npm run test:media-backup
npm run test:core-ux
npm run test:final-freeze
npm run test:wp17
npm run test:wp18
npm run test:wp29
npm run test:wp30
npm run test:wp31
npm run test:wp32
npm run android:sync
```

GitHub Actions passed 22/22 native flows together, 54 web checks and 226 Build regressions for the WP32 source. It also builds APKs and runs deployed Gemini authentication smoke on main. The v2.0 PR artifact uses the permanent signing identity; a public release still requires the signed tag workflow in `RELEASE.md`.
