# WP37 manual acceptance — owner reported green

**Owner sign-off2026-10-12:** “manual test done all green” after receiving the private2.1.3/code13 APK. This is practical owner-reported acceptance; no row-by-row device/OS measurements, exhaustive OEM/API matrix or TalkBack transcript was supplied. The checklist below remains reusable and does not imply those missing measurements.

Use the exact private WP37 **2.1.3/code13** APK and receipt, keeping the accepted WP36 **2.1.2/code12** receipt as historical evidence. Back up existing financial data before destructive restore scenarios. Automated checks do not establish physical/OEM acceptance.

Record device model, Android/API level, biometric capability, selected SpendWise language, OS language, timeout and APK source. Exercise API24–27, API28–29 and API30+ when available, including both reported phones. Unsupported combinations must be reported, not inferred green.

| Area | Required observation |
| --- | --- |
| Native copy EN/FR/AR | Distinct localized title/reason for Unlock and each sensitive action; no internal IDs or repeated app name. OEM-owned text may follow OS language. Check long French subtitle and large system text. |
| Biometric-first | Exactly one launch prompt; ordinary mismatch allows native retry. Strong biometric success must authorize the protected key operation and open the existing ledger. |
| Credential recovery | Explicit system-owned PIN/pattern/password flow where supported; no custom credential field. Cancel remains locked and does not auto-launch recovery. Temporary/permanent lockout and hardware-unavailable recovery are truthful. |
| Legacy immediate-lock limit | API24–29 external credential confirmation cannot bypass immediate App Lock. Verify localized unsupported explanation and absence of an unusable recovery action. No automatic timeout change. Credential-only devices must not be offered an unusable new immediate configuration. |
| Lifecycle | Home, Recents, screen off, rotation and rapid taps during both prompt types. Return before/after configured timeout; delayed/stale success must never open protected data. Repeat while storage is opening after authentication and during sensitive operations. |
| Key failure | Missing/invalidated established key stays a safe error. No silent replacement, reset or deletion; no raw exception text. Exercise migration cancellation/repair with synthetic data only. |
| Privacy | Privacy Shield, screenshot/Recents protection, encrypted storage/media, draft recovery and sensitive reauthentication retained. |
| RTL/user content | English and Arabic descriptions in the opposite UI language across History, Home, details, inputs, Statistics and Media Library. Confirm ellipsis preserves the logical beginning; amounts/dates remain readable. Arabic legal Back returns correctly. |
| Progress | Four AI surfaces in EN/FR/AR, light/dark and reduced motion: feature-colored thin activity, meaningful stages, reachable Cancel/Retry, no fake percentage or duplicate error. Cancel preserves work; no late result. |
| Backup V1/V2/V3 | Opposite language/theme and SYSTEM backups. Replace defaults to current SpendWise prefs; explicit checkbox applies backup prefs. Merge always retains prefs. Verify currency, expenses, budgets and photos after restart. |
| Restore failures | Inject synthetic post-financial preference failure and failed rollback. No false success; visible focused incomplete-recovery alert, reconciled ledger/preferences and media counts. Keep backup; never discard potentially referenced media. Process-kill cross-domain atomicity is not certified by these runtime compensation tests. |
| Statistics | Sparse/zero/partial/tied histories, 3/6/12 months and All Time. Compare displayed deterministic ranges/amounts against source data. Confirm category attribution is observational and output concise. All-Time shows latest6, expands all36 and resets; totals/chart/AI still use all36. |
| Accessibility | TalkBack names, reading order and announcements, font scaling, 320px/small-height dialogs, Settings/History/form/swipe/FAB navigation and focus after restore. |

The owner authorized WP37 main integration and restoring Render auto-deploy from main. Live HTTP200 health now matches main9045c699346f; synthetic installation auth and legacy/new144month Statistics compatibility passed. [Current status](STATUS.md) records the scoped proof and owner screenshot confirming Auto-Deploy/main9045c69/Live; the Render deployment ID was not displayed. The verified new backend is available before installing the new private client. No physical/OEM/TalkBack acceptance is implied by automated or deployment receipts.
