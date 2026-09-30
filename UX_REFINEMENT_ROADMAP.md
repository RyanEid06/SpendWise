# SpendWise UX Refinement Roadmap — v1.3.1 + v1.4.0

Status: **Approved for implementation**
Baseline: SpendWise v1.3.0 on `main`

This roadmap is the explicitly approved post-freeze UX work for SpendWise. It preserves the frozen product principles: local-first/private-by-default data, four primary destinations, Settings as a secondary destination, compact mobile-first design, and English/French/Arabic RTL support.

## Locked product decisions

### Brand
- Restore the exact original v1.2-style Android launcher artwork already preserved in the checked-in `mipmap` resources.
- Use that same canonical artwork for the installed launcher icon and the in-app top-left brand icon.
- Do not redraw or approximate it.
- Preserve proper normal/round/adaptive launcher behavior.

### Dashboard
- Remove the separate Spending Alert card; the main budget card already communicates budget state.
- Keep state communication in the main card through wording, badge, progress, and color.
- Rename **Starting Money** to **Monthly Budget**.
- Put **Monthly Budget** and **Spent** side by side in a compact two-column row.
- Preserve the current Top 3 Biggest Expenses design.
- Preserve Home Spending by Category.

### History and deletion
- Remove the duplicate visible Delete action/overflow delete UI.
- Keep swipe as the primary visible delete interaction.
- Expense detail remains read-only and informational: full description, amount, category, timestamp, note, and attachment information/preview.
- Replace routine expense-delete confirmation with a bottom **Undo snackbar**.
- Undo window: **5 seconds from the most recent deletion**.
- Rapid consecutive deletes join one batch, e.g. “3 expenses deleted — Undo”.
- Stage deletion: hide immediately, but permanently destroy database/media only when the Undo window expires.
- Undo restores the complete batch.
- Keep a nonvisual/accessible alternative to swipe delete.
- Truly destructive global operations such as Clear App Data and destructive restore/replace still use confirmation.

### Global overlays
- Fix the scroll-relative modal bug globally.
- The screen-entry animation must not leave a transformed ancestor after completion.
- Fixed modal/sheet overlays must position against the viewport/root, not a long scrolling page.

### Statistics
- Replace the four stacked summary cards with a compact **2×2 grid**:
  - Total spent
  - Average expense
  - Frequency
  - Largest expense
- Replace developer shorthand such as **txns** with localized **transactions**.
- Replace ambiguous **Top:** copy with **Largest:** or localized equivalent.
- Home and Statistics Spending by Category share one visual/base component.
- Statistics adds trend/history disclosure on top of Home's base design.
- Trend states:
  - spending up: rose/red + upward indicator;
  - spending down: green + downward indicator;
  - stable: neutral/blue-slate;
  - insufficient history: muted neutral/info.
- Do not rely on color alone.

### Largest Expense by Month
- Rank by largest-expense **amount**, not date.
- Reuse Home Top 3 hierarchy:
  - #1 amber/gold-like;
  - #2 silver/slate;
  - #3 stone/bronze-like;
  - #4+ neutral.
- Keep month visible.

### Settings information architecture
Settings becomes a compact **progressive-disclosure overview**, not one giant long form.

Preferred top-level order:
1. Appearance
2. Language
3. Currency
4. App Lock
5. Storage & Media
6. Backup & Restore
7. Review setup / Run setup again
8. Terms of Use
9. Privacy Policy
10. Clear App Data / destructive controls at the bottom

Interaction semantics:
- **⌄ / ⌃** = expands/collapses inline.
- **›** = opens a dedicated sub-screen.

Inline/simple:
- Appearance → System / Light / Dark
- Language → English / Français / العربية
- Currency → compact selector where practical

Dedicated sub-screens:
- App Lock → enabled state, Set/Change PIN, auto-lock timeout
- Storage & Media → library, usage, integrity/repair
- Backup & Restore → data backup, full backup with media, restore/import, CSV/export
- Terms of Use → existing legal screen
- Privacy Policy → existing legal screen

Review setup:
- Use clearer naming such as **Review setup** or **Run setup again**.
- A concise confirmation may explain that expenses/settings are not deleted before relaunching setup.
- Remove the giant Setup & Privacy card from the top.
- Remove redundant privacy-marketing/informational clutter from the overview.

The overview should normally fit comfortably on common phones, but must remain scrollable for narrow devices, large text, Arabic wrapping, or future settings.

## Release strategy

### v1.3.1 corrective patch
- WP19 — Brand Restoration + Dashboard Cleanup
- WP20 — History Detail + Undo Delete + Overlay Infrastructure

### v1.4.0 UX refinement
- WP21 — Statistics Density + Terminology
- WP22 — Unified Category Statistics + Ranked Largest-by-Month
- WP23 — Settings Progressive Disclosure Redesign
- WP24 — Integration Hardening + Release Gate

---

# WP19 — Brand Restoration + Dashboard Cleanup

## Goals
Restore the intended v1.2 visual identity and remove redundant Home UI.

## Required implementation
- Restore Android launcher references to the original checked-in `@mipmap/ic_launcher` / round/adaptive launcher system.
- Make AppTopBar use the same canonical original artwork.
- Do not delete newer artwork until references are understood; remove only confirmed dead assets.
- Remove the separate Spending Alert card from `BudgetSummaryCards`.
- Keep approaching/exceeded/on-track communication inside the main budget card.
- Rename “Starting Money” to “Monthly Budget” in EN/FR/AR.
- Keep Monthly Budget and Total Spent in a compact two-column layout on narrow phones.
- Preserve edit affordance on Monthly Budget.
- Prevent large currency values from overflowing.
- Do not redesign Top 3 Biggest Expenses.
- Do not redesign Home Spending by Category.
- Add focused regression coverage for brand references and dashboard structure.

## Primary ownership
- `android/app/src/main/AndroidManifest.xml`
- Android launcher/adaptive icon resource references
- `public/` canonical in-app brand asset if required
- `src/components/AppTopBar.tsx`
- `src/components/BudgetSummaryCards.tsx`
- `src/screens/DashboardScreen.tsx` only if required
- focused tests/copy

## Do not touch
- History deletion lifecycle
- Statistics layout
- Settings architecture
- global storage deletion semantics

## Acceptance
- Installed icon matches the good pre-WP17/v1.2 launcher artwork.
- Top-left app icon matches the intended launcher artwork.
- No duplicate Spending Alert card.
- “Monthly Budget” is clear in EN/FR/AR.
- Budget + Spent render side-by-side without clipping in light/dark/RTL.

---

# WP20 — History Detail + Undo Delete + Overlay Infrastructure

## Goals
Make deletion fast/recoverable, remove duplicate actions, improve read-only detail, and fix viewport overlays correctly.

## Required implementation
- Remove visible three-dot/overflow Delete action.
- Keep swipe-to-delete behavior and reduced-motion handling.
- Add a nonvisual accessibility delete action/semantics.
- Add reusable bottom Undo snackbar.
- Use a 5-second window from the latest deletion.
- Group rapid consecutive deletes into one batch.
- Stage persistent deletion until Undo expiry.
- Undo restores the batch completely.
- Favor data preservation on app-close/crash edge cases.
- Expanded/read-only details surface full useful metadata and attachments, not another delete action.
- Fix persistent-transform overlay bug globally.
- Verify Android Back.
- Keep confirmations for truly destructive global operations.

## Primary ownership
- `src/screens/HistoryScreen.tsx`
- `src/components/SwipeableExpenseCard.tsx`
- `src/components/ExpenseItemCard.tsx`
- `src/components/ExpenseDetailModal.tsx`
- `src/index.css`
- new undo/snackbar utilities/components
- storage/persistence paths required for staged deletion
- `src/App.tsx` only where needed for deletion lifecycle/global snackbar
- focused tests

## Do not touch
- Dashboard redesign
- Statistics
- Settings information architecture

## Acceptance
- No duplicate visible History Delete action.
- Swipe delete is immediate.
- Undo appears at bottom and batches rapid deletes.
- Undo fully restores records/photos.
- Expiry permanently deletes staged records/media.
- Long-page modals center in the real viewport.
- Clear Data/restore confirmations still work.

---

# WP21 — Statistics Density + Terminology

## Goals
Reduce wasted vertical space and remove developer-facing wording without changing deeper category architecture yet.

## Required implementation
- Convert four top statistic cards into a compact 2×2 grid.
- Keep labels readable and numbers dominant.
- Handle narrow screens and large values.
- Replace “txns” with localized “transactions”.
- Replace “Top:” with clearer “Largest:” wording.
- Keep Monthly Spending & Remaining substantially unchanged.
- Do not redesign Spending by Category yet.
- Do not redesign Largest Expense by Month yet.
- Add focused tests.

## Primary ownership
- `src/screens/StatisticsScreen.tsx`
- relevant Statistics copy/translations
- focused tests

## Do not touch
- Category statistics component architecture
- Home category breakdown
- Settings
- History deletion

## Acceptance
- Top summary is 2×2 on common phone widths.
- No visible “txns” shorthand.
- Calculations remain unchanged.

---

# WP22 — Unified Category Statistics + Ranked Largest-by-Month

## Dependency
**Must start from completed WP21.**

## Goals
Make category statistics visually consistent with Home while adding drill-down history, and make Largest Expense by Month genuinely useful.

## Required implementation
- Extract/reuse shared category presentation between Home and Statistics.
- Home remains simple: category, amount, percentage, existing color/emoji identity.
- Statistics uses the same base row/card plus trend state, expansion arrow, and per-month values.
- Improve trend-state visual differentiation without relying on color alone.
- Rank Largest Expense by Month by amount descending.
- Reuse Home Top 3 hierarchy.
- Keep month, useful expense identity, and amount visible.
- #4+ stays neutral.
- Add ordering/trend/shared-component regression tests.

## Primary ownership
- `src/screens/StatisticsScreen.tsx`
- `src/components/CategoryStatisticsSection.tsx`
- `src/components/CategoryBreakdownSection.tsx`
- shared category presentation components
- Top-3 presentation utilities/components only if extraction is needed
- focused tests

## Acceptance
- Home and Statistics visibly share the same category design language.
- Statistics rows expand into monthly history.
- largest-by-month is amount-ranked.
- top-three hierarchy works in light/dark/RTL.

---

# WP23 — Settings Progressive Disclosure Redesign

## Goals
Replace the long Settings form with a professional compact overview and reveal complexity only when requested.

## Required implementation
- Replace large stacked cards with compact top-level rows.
- Use current-value/status secondary text where useful.
- Preserve scrolling as fallback even if default overview fits.
- Inline-expand Appearance, Language, and Currency where practical.
- Dedicated sub-screens for App Lock, Storage & Media, and Backup & Restore.
- Legal rows open existing Terms/Privacy screens.
- Review setup/run setup again gets clearer naming and concise relaunch confirmation if useful.
- Remove giant Setup & Privacy card.
- Remove redundant privacy-marketing/informational clutter from overview.
- Put destructive data actions at the bottom.
- Arrow semantics: down/up for inline disclosure, forward/right for sub-screen.
- Preserve all existing functionality.
- Preserve Android Back for nested settings pages.
- Verify light/dark/EN/FR/AR RTL.

## Primary ownership
- `src/screens/SettingsScreen.tsx`
- new Settings-specific components/subscreens
- Settings-local copy/translations
- focused tests

## Do not touch
- History deletion
- Dashboard
- Statistics
- shared modal infrastructure unless a blocking bug exists; consume WP20's fix during integration

## Acceptance
- First Settings view is compact and scannable.
- Simple choices expand inline.
- Complex areas open focused sub-screens.
- Back behavior is predictable.
- No existing Settings capability disappears.

---

# WP24 — Integration Hardening + v1.4 Release Gate

## Dependency
**Runs only after WP19–WP23 are integrated.**

## Required verification
- Light / Dark / System
- English / French / Arabic RTL
- 320px, 360px, 390px, 412px+ widths
- accessibility/large text
- huge currency values
- unset / healthy / near-limit / exceeded budgets
- empty and large ledgers
- notes and 1–8 photos
- one delete / rapid batch delete / Undo / expiry
- tab navigation during Undo
- Android Back
- long-page fixed overlays
- App Lock and nested Settings back behavior
- Storage & Media
- data-only/full backup + restore
- Terms/Privacy/setup replay
- category expansion
- largest-by-month ordering
- launcher normal/round/adaptive behavior

## Regression invariants
- manifest cannot silently switch to the wrong launcher artwork;
- top-left app icon uses canonical intended artwork;
- no duplicate visible History delete action;
- pending delete does not destroy photos before Undo expiry;
- no “txns” copy;
- Home/Statistics category base presentation remains shared;
- modal overlays are viewport-rooted;
- Settings remains compact/progressive;
- EN/FR/AR remain functional;
- existing AI/persistence/media-backup/security suites stay green.

## Release
- After WP19 + WP20 integration and validation: bump/tag/build **v1.3.1**.
- After WP21 + WP22 + WP23 + WP24 integration and validation: bump/tag/build **v1.4.0**.

---

# Parallel execution plan

Parallelism is encouraged only with strict branch/file ownership.

## Wave A — safe to run in parallel
Start from the same current `main` baseline on separate branches:
- **WP19** — Brand + Dashboard
- **WP20** — History + Undo + Overlay
- **WP21** — Statistics Density
- **WP23** — Settings Redesign

These areas are sufficiently separated for parallel implementation.

## Merge discipline
1. Merge **WP19 + WP20** first.
2. Run the v1.3.1 regression gate.
3. Release/tag **v1.3.1**.
4. Rebase/update still-open WP21/WP23 branches onto the new main.
5. Merge WP21/WP23 after resolving only genuine shared-file conflicts.

## Wave B
- **WP22** starts from completed WP21.
- WP22 may be developed while WP19/WP20/WP23 are still underway, but it must not merge before WP21 and must be rebased onto the final integration baseline.

## Wave C
- **WP24** starts only after WP19–WP23 are integrated.
- No opportunistic feature work in WP24.

## Collision rules
- WP19 owns Dashboard/brand.
- WP20 owns History/delete/overlay infrastructure.
- WP21 owns initial Statistics summary/copy.
- WP22 owns deeper Statistics category/ranking architecture and follows WP21.
- WP23 owns Settings.
- Shared files such as `src/App.tsx`, `src/index.css`, centralized translations, version files, release docs, and package metadata are edited only when required by the owning WP and reviewed carefully during integration.
- No WP should refactor another WP's area.

## Recommended branch names
- `wp19/brand-dashboard`
- `wp20/history-undo-overlay`
- `wp21/statistics-density`
- `wp22/statistics-category-ranking`
- `wp23/settings-progressive-disclosure`
- `wp24/integration-release-hardening`

---

# Non-goals
This roadmap does **not** add:
- accounts/cloud sync;
- social/community features;
- ads;
- gamification;
- shared budgets;
- a new primary navigation tab;
- a standalone gallery product;
- arbitrary redesign of AI Insights;
- database rewrites unrelated to safe staged deletion;
- large dependency upgrades.

The objective is a smaller, clearer, more coherent SpendWise — not scope expansion.
