# WP38 owner acceptance and Render handoff

Status: pending owner testing of the private **2.1.4 / code14** candidate. Automated synthetic/emulator checks do not prove the owner's PIN/OEM behavior or effective production Gemini routing. No production changes or live Gemini requests are performed for WP38 implementation.

## In-place phone upgrade

Use only the permanent-signed APK identified in the [WP38 artifact receipt](WP38_PRIVATE_APK.md): `SpendWise-WP38-v2.1.4-test.apk`, source `732065e5455ca4de734d4982a662c2819fdd01af`, SHA256 `0f4b5c46f93882387a45febf5ad58ceceabfdeb28c67d5074153117297747ab0`. Its signature/identity/source/HTTPS checks passed independently; all required exact-source CI passed. Install over 2.1.3 with the existing `com.spendwise.app` package; do not uninstall, clear storage or reset keys. Confirm the APK SHA-256 and permanent signer before installation. Confirm existing transactions, budgets, photos, encrypted storage, backups and App Lock remain usable after the update.

## Authentication

- Strong fingerprint succeeds and loads existing protected data.
- PIN, pattern and password each succeed where configured/supported; dismissing the OS screen alone is insufficient.
- Switch from fingerprint to phone credentials; cancel with X/Back at each stage, cancel twice, then retry. The lock action must recover without relaunching.
- Rapid taps, Home/recent apps, screen-off, returning to foreground, activity recreation and a late result from a cancelled attempt never unlock the interrupted session. A fresh foreground attempt works.
- Check established lock timeouts 0/60/300/900 seconds. API24–29 immediate credential-only authentication remains explicitly unsupported and fails closed. Test a second API/OEM when available; mark unavailable combinations untested.
- Invalidated/missing established keys show the existing repair failure and preserve data, aliases and App Lock.
- Capture one failing logcat attempt if symptoms remain; retain only bounded category/attempt identifiers, no PIN, key material, financial content or hardware identifiers.

## Arabic and regression UX

- Arabic lock title, description, status, cancellation, fingerprint retry and credential action match the plan. Latin SpendWise stays isolated within RTL copy.
- Check a narrow phone in Light/Dark, wrapping/punctuation, Android prompt overlays and buttons re-enabled after cancellation. EN/FR copy/design remain unchanged.
- Android system-owned fingerprint instructions may follow the phone's language; only application-owned prompt text is localized.

## Render / live Gemini (owner-deferred)

Do not infer effective deployment routes from repository defaults. Read current nonsecret effective routes/budgets before deciding any deployment action:

- `GEMINI_TASK_ROUTES`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL(S)`, `GEMINI_VERIFIED_MODELS`, `GEMINI_ROUTING_QUALITY_APPROVED`, max attempts, operation/attempt timeouts. Never share provider keys or full environment output.
- Record the effective model names for smart-capture, scan-receipt, analyze and explain-trends; confirm distinct qualified fallback and intended low thinking level.
- Keep the existing 90s backend operation / 50s attempt / two-attempt defaults and 115s client timeout. WP38 does not raise them or change Render settings.
- Backend invalid-response alternate handling becomes effective only when the reviewed backend code is separately deployed. Existing production behavior remains until then; deploying/merging requires separate authorization.
- If separately authorized and quota allows, use synthetic data for one cold and one warm request per task; record request ID, outcome, timings and local-versus-Gemini provenance. Keep real receipts/transactions out of logs and test inputs.
- After actual quota exhaustion, Retry and main Analyze/Refresh/Scan agree; a valid context/reset later allows recovery. Local analysis remains truthful and neither failed provider nor failed local generation leaves progress stuck.

## Sign-off

Record phone model/API, installed APK hash/source, tested scenarios and failures. Candidate readiness, automated verification, physical acceptance and production routing/deployment each retain their own status. Merge/deploy/publication remains unauthorized until the owner explicitly approves it.
