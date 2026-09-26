# SpendWise

SpendWise is a privacy-first, offline personal expense tracker and monthly budget planner with category breakdowns and AI-powered financial insights.

Originally written as an Android application, this project has been fully rewritten into a modern, full-stack React TypeScript SPA powered by Vite, Express, and Tailwind CSS with server-side Gemini integration.

## Key Features

- **Dashboard & Budget Tracking:**
  - Dynamic monthly budget allocations with visual progress tracking.
  - "Money Left" / "Budget Exceeded" prominent status card with percentage calculations.
  - Multi-category proportional spending bar and detailed category breakdowns.
  - Quick top 3 biggest expenses with rank highlights.

- **Expense History & Search:**
  - Real-time search by description, category, or notes.
  - Monthly expense transaction logs with categorized badges and formatted timestamps.
  - Fast inline editing and confirmation-protected deletions.

- **AI Spending Analysis & OCR Receipt Scanning:**
  - Real-time receipt scanning using Gemini multimodal vision (`gemini-3.8-flash`) to auto-populate merchant, total amount, category, date, and line item notes.
  - Thoughtful financial pattern analysis with objective, non-judgmental tone distinguishing unusual expenses from bad ones.
  - Comprehensive local statistical engine ensuring 100% offline baseline analytics even without network access.

- **Data Privacy & Backup:**
  - 100% local persistence with complete user privacy.
  - Full JSON backup export and import with "Merge" or "Restore & Replace" modes.
  - CSV spreadsheet export compatible with Excel, Google Sheets, and Numbers.
  - App Lock with PIN authentication and inactivity timeout protection.
  - Multi-currency support (USD, EUR, GBP, CAD, AUD, JPY, INR).
  - Appearance customization (Light, Dark, and System Default themes).

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend / Proxy:** Node.js, Express, `@google/genai` SDK (`gemini-3.8-flash`)
- **Build Tool:** Vite 6
