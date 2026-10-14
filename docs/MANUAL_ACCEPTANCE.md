# Owner phone acceptance

## WP38 2.1.4/code14 — GREEN, owner reported 2026-10-14

After testing the independently verified 2.1.4 APK, the owner reported “It officially all works” and authorized official publication. [Public receipt](WP38_PUBLIC_RELEASE.md), [accepted test receipt](WP38_PRIVATE_APK.md), [phone/Render checklist](WP38_DEVICE_ACCEPTANCE.md). This is owner-reported practical acceptance, with no per-scenario device/API/OEM measurements supplied. Effective production Gemini routing and live-provider checks remain separately unverified. Preserve existing app data during updates.

## WP37 2.1.3/code13 — GREEN, owner reported2026-10-12

After receiving the verified Desktop APK, the owner reported “manual test done all green”
for WP37. [Current status](STATUS.md), [artifact receipt](WP37_PRIVATE_APK.md) and
[WP37 checklist](WP37_DEVICE_ACCEPTANCE.md) distinguish automated proof from this
practical phone sign-off. No per-scenario device/OS measurements, exhaustive
OEM/API matrix or TalkBack transcript was supplied.

## Historical WP36 owner phone acceptance

Status: **GREEN — owner accepted the historical WP36 2.1.2/code12 phone build on
2026-10-11**, reporting “all works nice”. This closes the WP36 practical phone
acceptance checkpoint. See [status and evidence](STATUS.md) and [APK receipt](WP36_PRIVATE_APK.md).
The owner did not supply a row-by-row checklist, device/OS measurements or a
TalkBack transcript; the reusable scenarios below do not claim such records.
The old code8 startup failure was repaired; do not use that artifact for the trial.
WP37 adds a separate [device acceptance checklist](WP37_DEVICE_ACCEPTANCE.md);
the WP36 sign-off above does not certify those new changes.

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
