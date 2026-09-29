# SpendWise hardening history

This document records the original hardening work that established the current SpendWise reliability baseline. It is historical context, not the current release checklist.

## Fixed

- Non-destructive storage initialization; removed merchant-name data wipe logic.
- AI insight cache invalidation on add/edit/delete.
- App lock no longer accepts blank input or a universal `1234` bypass.
- PIN can be changed from Settings (4–8 digits).
- Locked state renders only the lock screen, preventing modal/content overlap.
- Backup validation, schema versioning, rollback on write failure, theme/language restore, and non-destructive budget merge.
- Safe AI-cache clearing without mutating `localStorage` during indexed iteration.
- Statistics stale-cache bug removed.
- New-expense default date follows the month currently being viewed.
- History is sorted by transaction date, then creation time.
- Budget usage text can exceed 100% while the visual bar remains capped.
- Currency switching protects existing records from silent relabeling and supports explicit conversion.
- Currency-specific absolute statistical thresholds removed.
- AI API base URL is configurable with `VITE_API_BASE_URL`.
- AI/receipt calls have request timeouts; image uploads have type/size guards and category validation.
- Server-side AI output/request guardrails and fallback handling added.
- Fake Android status/gesture UI removed; navigation uses safe-area insets.
- Android cloud backup disabled for local-only financial storage.
- Android Gradle project files/wrapper launchers restored.
- Privacy wording corrected to disclose Gemini processing when AI features are explicitly used.
- `build` performs TypeScript checking before Vite bundling.

## Current verification status

The earlier environment limitation from the initial hardening pass is no longer applicable. The frozen release line is continuously verified in GitHub Actions with TypeScript/Vite, AI reliability, currency, persistence/migration, media/Backup v2, core UX, final freeze regressions, Capacitor sync, Android debug APK build, artifact upload, and a deployed Gemini backend smoke test.

For current release procedure, use `RELEASE.md`. For the frozen product scope, use `PRODUCT_FREEZE.md`.
