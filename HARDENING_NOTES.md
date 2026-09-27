# SpendWise hardening pass

This source tree was repaired from the uploaded `SpendWise-main.zip` baseline.

## Fixed
- Non-destructive storage initialization; removed merchant-name data wipe logic.
- AI insight cache invalidation on add/edit/delete.
- App lock no longer accepts blank input or a universal `1234` bypass.
- PIN can be changed from Settings (4-8 digits).
- Locked state now renders only the lock screen, preventing modal/content overlap.
- Backup validation, schema versioning, rollback on write failure, theme/language restore, and non-destructive budget merge.
- Safe AI-cache clearing without mutating `localStorage` during indexed iteration.
- Statistics stale-cache bug removed.
- New-expense default date follows the month currently being viewed.
- History is sorted by transaction date, then creation time.
- Budget usage text can exceed 100% while the visual bar remains capped.
- Currency switching is blocked once expense records exist to prevent silently relabeling old amounts.
- Currency-insensitive budget presets removed.
- AI API base URL is configurable with `VITE_API_BASE_URL` for Android/private backend use.
- AI/receipt calls have request timeouts; receipt uploads have type/size guards and category validation.
- Server-side AI output/request guardrails added.
- Currency-specific absolute statistical thresholds removed.
- Fake Android status/gesture UI removed; bottom navigation uses safe-area inset.
- Android cloud backup disabled for local-only financial storage.
- Missing Android Gradle project files/wrapper launchers restored.
- Privacy wording corrected to disclose Gemini processing when AI features are explicitly used.
- `build` now performs TypeScript checking before Vite bundling.

## Verification limitation
The uploaded ZIP did not contain `node_modules`, and this execution environment could not reach the package registry before timeout. TypeScript parsing found no syntax errors introduced by the hardening pass, but a full `npm install && npm run verify && npm run android:sync` and Android Gradle build should be run on a networked development machine before installing the APK.

## Android AI configuration
For Android, set `VITE_API_BASE_URL` to the private HTTPS URL of the SpendWise Express/Gemini backend before building. Leaving it blank uses same-origin `/api/...`, which is appropriate for the web/dev server but not a standalone Capacitor APK.
