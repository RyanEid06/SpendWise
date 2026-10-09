# Owner phone acceptance

Status: **pending for the final2.1.0/code10 APK**. Automated CI/emulator results do
not establish acceptance on HONOR X9d/Android16 or verify the owner's real records.
The old code8 startup failure was repaired; do not use that artifact for the trial.

Use the permanent-signed2.1 APK and record its published checksum/source receipt.
Update the installed application without uninstalling or clearing storage. Preserve
a known-readable backup. If update fails, retain the exact error instead of replacing
the signing identity or removing app data.

| Area | Owner observation required |
| --- | --- |
| Startup and data | Cold/warm launch reaches usable Home; existing budgets, expenses, categories and photos remain readable after authentication |
| Authentication/privacy | Strong biometric and device credential fallback; cancel/retry; no prompt loop, exposed finance/draft text, black transition or sensitive Recents/screenshot |
| Appearance/accessibility | Light/Dark/System; EN/FR/AR/RTL; narrow/landscape layouts, 48dp targets, amounts, Settings version, independent legal links/checkbox; real TalkBack announcements |
| Editing/IME/Back | Long amounts/descriptions/notes; focus and Save/Cancel remain reachable; correct nearest-overlay Back and rotation behavior |
| Media acquisition | Camera/gallery grant/deny/cancel; photos retained, viewed/removed; All/Day/Category grouping; integrity warning/repair reachable |
| Food/category continuity | Existing Food records and new Food & Beverage share the intended category identity in History/Statistics/AI/export/restore |
| Backup | Data-only/full encrypted backup offline; password confirmation, wrong-password safe failure, current/legacy imports, deliberate merge/replace without unintended loss |
| AI/offline | Local fallback/error offline; online analysis/loading/error; tab switches/recreation avoid duplicate or stale work; Apply populates draft and Save remains manual |
| Draft recovery | Background/Activity recreation, distinct PID after actual process death, reboot/keyguard distinct from App Lock; partial Add/photo/Edit recovered once, discard leaves no orphan |

For each row record artifact hash/source, date, expected/observed behavior and
pass/fail/pending/unsupported. Use synthetic entries for destructive experiments;
never expose owner financial data or device credentials in public evidence.
Signed production may deny `run-as`; retain that limit without rooting the phone
or weakening protections. A failed or unrun check leaves physical sign-off pending.
