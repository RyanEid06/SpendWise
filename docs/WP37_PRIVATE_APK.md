# WP37 private signed APK — independently verified

Verified **2026-10-12** after the authorized main merge. The owner subsequently
reported “manual test done all green” on2026-10-12. Exhaustive OEM/API/TalkBack
coverage remains unverified. This is private testing, with no tag/public release.

| Identity | Value |
| --- | --- |
| Package | `com.spendwise.app` |
| Version | `2.1.3`, Android code`13` |
| Application/main source | `9045c699346f44f7867cf9d1238c6558ca17e841` |
| Main merge | [PR48](https://github.com/RyanEid06/SpendWise/pull/48), 2026-10-12T19:22:21Z |
| Private build | [38297255401 — success](https://github.com/RyanEid06/SpendWise/actions/runs/38297255401) |
| Private artifact | [11768889340](https://github.com/RyanEid06/SpendWise/actions/runs/38297255401/artifacts/11768889340), retained30days |
| Local ignored file | `artifacts/wp37/private-main-9045c699/SpendWise-WP37-v2.1.3-test.apk` |
| APK bytes | 17757578 |
| APK SHA256 | `708a12a38d89fa5956b9eb63d45346683c895423993aed49c369dd7922a1a8c8` |
| Permanent certificate SHA256 | `e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965` |
| API | `https://spendwise-api-v9sv.onrender.com` |
| Observed live backend | `9045c699346f` at2026-10-12T19:33:57Z, matching application/main source |

Independent local Google apksig verification confirmed a valid V2 signature and
exact permanent certificate. SHA256 matched build-receipt.json and SHA256SUMS.
Decoded compiled manifest verified package/version, non-debuggable, backup-disabled
and cleartext-disabled settings. Embedded assets/public/wp35-build.json matched
source/run/version/variant; compiled JavaScript contained the configured HTTPS API.
Capacitor config retained the local app without a remote server override.

Exact-version combined38286074724 attempt2 passed all four required application
gates. Main PR Android Build38296180292 and post-merge main38297213552 passed.
Feature99278ce, integrationfa1dae and main9045c699 share the exact tested tree.

The owner screenshots confirm existing Render branchmain / After CI Checks Pass.
Public HTTP200 health reported auth-store readiness, configured AI and the matching
main commit prefix. A synthetic installation authenticated successfully; two
bounded trends requests passed deterministic summary/client-shape checks for a
legacy period-less payload and a new144month All-Time payload. These are scoped
synthetic checks, not provider-load, physical or OEM certification. The owner Deploys screenshot additionally confirms main9045c69 Live, triggered
by Auto-Deploy, duration1m12s. A deployment ID was not displayed.

Install as a same-certificate update without uninstalling or clearing storage.
Preserve a readable backup. [Device checklist](WP37_DEVICE_ACCEPTANCE.md).
The historical accepted WP36 build remains in [its separate receipt](WP36_PRIVATE_APK.md).

Desktop delivery copy: `C:\Users\Administrator\Desktop\SpendWise-v2.1.3-test.apk`, independently hash-matched after copying.
Owner Deploys screenshot confirms **Auto-Deploy**, **main9045c69**, **Live**, duration **1m12s**. Current verified Auto-Deploy remains **After CI Checks Pass**, which already updates main automatically.
