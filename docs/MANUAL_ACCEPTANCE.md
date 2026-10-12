# Owner phone acceptance

Status: **GREEN — owner accepted the current 2.1.2/code12 phone build on
2026-10-11**, reporting “all works nice”. This closes the WP36 practical phone
acceptance checkpoint. See [status and evidence](STATUS.md) and [APK receipt](WP36_PRIVATE_APK.md).
The owner did not supply a row-by-row checklist, device/OS measurements or a
TalkBack transcript; the reusable scenarios below do not claim such records.
The old code8 startup failure was repaired; do not use that artifact for the trial.

For future regression testing, use the permanent-signed APK and record its checksum/source receipt.
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
or weakening protections. Record any future failed or unrun scenario explicitly;
do not infer exhaustive scenario coverage from the current owner sign-off.
