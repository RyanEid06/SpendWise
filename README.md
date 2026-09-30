# SpendWise

SpendWise is a privacy-first, local-first personal expense tracker and monthly budget planner for Android and the web. Core financial data remains on the device; Gemini-powered features are optional and use the SpendWise backend only when the user explicitly invokes them.

Current app version: **1.3.0**

## Key Features

- **Dashboard & Budget Tracking**
  - Monthly budgets, remaining-money status, proportional spending progress, category breakdowns, and top expenses.
  - Dashboard-only expense editing keeps the main workflow predictable.

- **Manual-First Expense Capture**
  - Amount, description, category, date, and optional note are the primary flow.
  - Smart Capture, receipt scanning, and photo attachment are optional tools opened only when needed.
  - Up to 8 photos can be attached to an expense.

- **History & Statistics**
  - Search and monthly transaction history with confirmation-protected deletion.
  - History and Statistics open read-only expense details instead of silently entering edit mode.
  - Multi-period statistics, category trends, largest expenses, and large-ledger regression coverage.

- **AI Spending Analysis & Receipt Scanning**
  - Gemini-powered spending analysis with a deterministic local statistical fallback when AI is unavailable.
  - Receipt and Smart Capture flows use bounded server-side requests and validated structured responses.
  - Model selection and fallback models are configured on the backend; see `AI_BACKEND.md`.

- **Private Media & Backup**
  - App-scoped photo storage; photos are not copied to the device gallery by default.
  - Media Library with integrity checks and conservative repair of safe-to-fix issues.
  - Backup v2 supports **data-only** ZIPs and **data + photos** ZIPs with validation, checksums, merge, replace, and rollback protection.
  - Legacy Backup v1 JSON import remains supported.
  - CSV export is available for spreadsheet use.

- **Privacy, Security & Localization**
  - App Lock with PIN and inactivity timeout.
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

The checked-in npm lock currently resolves the frozen release line to:

- **Frontend:** React 19.3, TypeScript 5.9, Tailwind CSS 4.3, Lucide React
- **Backend / Proxy:** Node.js 22, Express 4.22, `@google/genai`
- **Mobile:** Capacitor 8, Android compile/target SDK 36
- **Build Tool:** Vite 6.4
- **Persistence:** local structured storage with Capacitor SQLite on native plus app-scoped media storage

Major upgrades such as Express 5, Vite 8, TypeScript 7, and Lucide 1.x are intentionally not mixed into maintenance updates without a dedicated compatibility pass.

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
npm run android:sync
```

GitHub Actions also builds a debug APK and runs the deployed Gemini backend smoke test. Permanent install/update releases should use the signed tag workflow described in `RELEASE.md`.
