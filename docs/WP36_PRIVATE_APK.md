# WP36 private signed APK — accepted

**GREEN, owner phone acceptance confirmed 2026-10-11.** The owner reported
“all works nice” after testing the delivered build. [Current status](STATUS.md).

| Identity | Value |
| --- | --- |
| Package | `com.spendwise.app` |
| Version | `2.1.2`, Android code `12` |
| Source | `d89063b8630c74355074544d1e5dfe215c66aab2` |
| Private build | [38168712767 — success](https://github.com/RyanEid06/SpendWise/actions/runs/38168712767) |
| Desktop file | `C:\Users\Administrator\Desktop\SpendWise-v2.1.2-test.apk` |
| APK SHA256 | `70b523f9365dba9e22c742c4ae4087f8bbc0111bec64e5c550fb1d6224b01d1e` |
| Permanent certificate SHA256 | `e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965` |
| API | `https://spendwise-api-v9sv.onrender.com` |
| Live backend version | `d89063b8630c` |

CI verified the APK signature, permanent signer, compiled package/version,
source/run receipt and hash. The downloaded APK and Desktop copy matched the
receipt; packaged build metadata and HTTPS API endpoint were inspected locally.
Render health/version and the installation-authenticated synthetic analysis
smoke passed before owner testing. No credentials were exposed.

This supersedes the WP35 2.1.1 private trial. It is not a public release:
main was unchanged at this historical WP36 checkpoint. The later WP37 integration
is recorded in [current status](STATUS.md); public v2.1.0 remains available.
