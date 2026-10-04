# SpendWise Product Freeze — WP16

WP16 established the original product freeze. Later approved UX refinement and WP25–WP32 hardening preserve the product shape below. The current v2.0 signed trial does not add a new product feature set; WP33/WP34 remain future work.

## Frozen product shape

- Four primary destinations: Home, History, AI Insights, Statistics.
- Settings is a secondary destination opened from the top app bar, not a fifth bottom-navigation tab.
- Add Expense remains manual-first with optional Smart Capture, receipt scanning, and photo attachment tools.
- Dashboard owns expense editing.
- History and Statistics use read-only expense details; History retains delete.
- Media stays private/local by default. Secure Backup v3 separates data-only from data+photos; Backup v1/v2 imports remain compatible.
- Existing compact mobile design remains the product baseline. Tablet/landscape support is a sanity/responsiveness pass, not a tablet redesign.

## Accessibility and interaction baseline

- Interactive controls must expose at least a 48dp-equivalent target.
- Keyboard focus must remain visibly identifiable.
- Reduced-motion preferences must be respected.
- English, French, and Arabic/RTL layouts must remain usable.
- Android Back must close the nearest modal/detail layer first, return from Settings to the prior primary screen, then follow primary navigation behavior.
- Narrow phones remain the primary layout target; wider screens may use modestly wider content without introducing a separate tablet UI.

## Final regression gates

Automated verification must include:

- TypeScript + Vite production build.
- AI reliability, including rate-limit behavior.
- Currency behavior.
- Persistence/migration and restart durability.
- Backup v1 compatibility.
- Backup v2 + media integrity/restore.
- WP15 core UX architecture.
- WP16 navigation/accessibility/freeze architecture.
- Large-ledger statistics and analysis sanity.
- Capacitor Android sync.
- Debug APK build and artifact upload.
- Deployed Gemini backend smoke test.

## Manual Android acceptance before release

- Home / History / AI Insights / Statistics bottom navigation.
- Open and close Settings from every primary destination.
- Android Back from Settings returns to the screen that opened it.
- Add Expense, edit from Dashboard, History delete, read-only details, photo preview.
- Camera/gallery, Smart Capture, receipt scan.
- Media Library, data-only backup, full backup, merge restore, replace restore.
- Offline Gemini fallback and rate-limit error presentation.
- English, French, Arabic RTL.
- Narrow phone, landscape, and one tablet-size Android sanity pass.
- Large ledger scrolling/search/statistics sanity.

## Explicitly not part of this freeze

No social/accounts system, leaderboards, streaks, gamification, ads, cloud account/sync/photo upload system, shared budgets, additional primary tabs, standalone Gallery product, complicated onboarding, or engagement mechanics.

After WP16 acceptance, changes should be bug fixes, compatibility/security maintenance, or explicitly approved new roadmap work rather than opportunistic feature additions.
