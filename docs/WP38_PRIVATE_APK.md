# WP38 private signed APK — independently verified

Verified **2026-10-14** from the dedicated WP38 branch. The owner subsequently reported “It officially all works” and authorized official public publication. This receipt preserves the accepted test APK; [public release receipt](WP38_PUBLIC_RELEASE.md) records the distinct official build. Render/live-provider verification remains separate and unverified.

| Identity | Value |
| --- | --- |
| Package | `com.spendwise.app` |
| Version | **2.1.4 / Android code14** |
| Exact reviewed application/workflow source | `732065e5455ca4de734d4982a662c2819fdd01af` |
| Private signed build | [38589986178 — success](https://github.com/RyanEid06/SpendWise/actions/runs/38589986178) |
| Private artifact | [11907202097](https://github.com/RyanEid06/SpendWise/actions/runs/38589986178/artifacts/11907202097), retained30days |
| APK | `artifacts/wp38/SpendWise-WP38-v2.1.4-test.apk` (ignored local delivery copy) |
| Owner-requested Desktop copy | `C:\Users\Administrator\Desktop\SpendWise-v2.1.4-test.apk`, independently hash-matched after copying |
| APK bytes | 17758826 |
| APK SHA256 | `0f4b5c46f93882387a45febf5ad58ceceabfdeb28c67d5074153117297747ab0` |
| Permanent certificate SHA256 | `e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965` |
| Compiled HTTPS API | `https://spendwise-api-v9sv.onrender.com` |
| Machine-readable receipt | [WP38_APK_RECEIPT.json](WP38_APK_RECEIPT.json) |

The artifact archive digest reported by GitHub is `sha256:47627cd5b4b3d12d3e63084c33f961bd892591c47d7b16d90599b171f6536fec`. This identifies the artifact archive, separately from the independently calculated APK hash above.

Independent local Google apksig8.13.0 verified the actual APK's cryptographic signature, V2 scheme and exact single permanent certificate. Its SHA256 matched both build-receipt.json and SHA256SUMS, then matched again after copying to the delivery path. Decoding the compiled binary manifest confirmed package/version, non-debuggable release behavior, backup/cleartext disabled and the private non-exported authentication host. Embedded `assets/public/wp35-build.json` matched source, run, version and private variant. Compiled JavaScript contained the receipt's HTTPS API endpoint and no Google provider-key pattern; Capacitor retained the local app with no remote-server override. These checks do not prove effective server routing or phone behavior.

All six required workflows passed this exact source: [combined38530729922](https://github.com/RyanEid06/SpendWise/actions/runs/38530729922), [isolated native38530734631](https://github.com/RyanEid06/SpendWise/actions/runs/38530734631), [Android Build38530734855](https://github.com/RyanEid06/SpendWise/actions/runs/38530734855), [Auth Recovery38530734540](https://github.com/RyanEid06/SpendWise/actions/runs/38530734540), [Gemini Runtime38530734503](https://github.com/RyanEid06/SpendWise/actions/runs/38530734503) and [WP32 E2E38530734507](https://github.com/RyanEid06/SpendWise/actions/runs/38530734507). Combined CI includes687/687 Node tests with real PostgreSQL, API36 compile/JUnit/lint, both navigation gates, two actual-host instrumentation tests, full acceptance and encrypted recovery; all five isolated native jobs passed. Signed packaging also reran synthetic regressions and the production web build.

Final delivery documentation is a docs-only child of the source above. The APK and CI receipts always identify `732065e5455ca4de734d4982a662c2819fdd01af`, rather than the later documentation commit. The initial private handoff kept [PR50](https://github.com/RyanEid06/SpendWise/pull/50) draft and main at `16ea6870243d67daa28cfbc6e5d0e1126416fe47`. The later owner acceptance/publication authorization supersedes that stop; current integration is tracked in the public receipt.

Install over existing2.1.3/code13 using this same-package, same-certificate APK. Preserve a readable backup; **do not uninstall, clear storage or reset keys**. Same signing identity establishes update compatibility, while actual encrypted-data continuity and PIN/pattern/password behavior require the [owner acceptance checklist](WP38_DEVICE_ACCEPTANCE.md). No merge, Render deployment/settings change, public tag/release or branch deletion was performed at the private handoff. Subsequent authorized public delivery has its own receipt.
