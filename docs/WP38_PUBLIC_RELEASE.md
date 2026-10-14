# SpendWise 2.1.4 — official public Latest release

**Final product freeze: 2026-10-14.** [Freeze record](FREEZE.md). Later presentation/maintenance-policy commits preserve this immutable public source, signed APK and all release receipts.

Published and independently verified **2026-10-14**. The owner accepted the tested 2.1.4 build (“It officially all works”) and authorized main integration, public release/tag and completed-branch cleanup. The Releases page marks **SpendWise v2.1.4** as **Latest**.

[Download official APK](https://github.com/RyanEid06/SpendWise/releases/latest/download/SpendWise-v2.1.4.apk) · [Release](https://github.com/RyanEid06/SpendWise/releases/tag/v2.1.4) · [Tag](https://github.com/RyanEid06/SpendWise/tree/v2.1.4) · [Notes](RELEASE_NOTES_2.1.4.md) · [Machine receipt](WP38_PUBLIC_APK_RECEIPT.json)

| Identity / gate | Verified value |
| --- | --- |
| Version / package | **2.1.4 / code14**, `com.spendwise.app` |
| Immutable public tag/source | `v2.1.4` → `8dc968b055eeb2bfc6a531ef347dce563f26f8bc` |
| GitHub verification | [Release commit](https://github.com/RyanEid06/SpendWise/commit/8dc968b055eeb2bfc6a531ef347dce563f26f8bc) signature **Verified**, reason `valid`; lightweight tag references that GitHub-signed merge commit |
| Main integration | [PR50](https://github.com/RyanEid06/SpendWise/pull/50), then documentation whitespace correction [PR51](https://github.com/RyanEid06/SpendWise/pull/51) |
| Exact main build | [38596394266](https://github.com/RyanEid06/SpendWise/actions/runs/38596394266) — success |
| Official tag/signing/publishing build | [38597721857](https://github.com/RyanEid06/SpendWise/actions/runs/38597721857) — verify-debug and signed-release success |
| Public release ID | `412941237`, published2026-10-14T16:31:26Z; stable, not draft, Latest |
| APK | `SpendWise-v2.1.4.apk`, **17758563 bytes** |
| APK SHA256 | `af50377cc519c7dadcb20be23337e94ba44dd2a222951b985f8667d23ececdb5` |
| Permanent signer SHA256 | `e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965` |
| Compiled API | `https://spendwise-api-v9sv.onrender.com` |
| Public assets | APK, `SHA256SUMS`, `build-receipt.json`, CycloneDX1.5 `sbom.cdx.json` |
| Latest APK URL | Anonymous HTTP200 after redirects |
| Desktop official copy | `C:\Users\Administrator\Desktop\SpendWise-v2.1.4.apk`, independently hash-matched |

Independent Google apksig8.13.0 verified the actual downloaded public APK's V2 signature and exact single permanent certificate. SHA256 matched SHA256SUMS and GitHub's asset digest. Binary manifest decoding verified package/version, non-debuggable release behavior, backup/cleartext disabled and the non-exported authentication host. The published source/run receipt matches the exact tag workflow; the public pipeline uses this sidecar receipt rather than embedding the private `wp35-build.json`. Compiled assets contain the configured HTTPS endpoint, no provider-key pattern and no Capacitor remote-server override. All twelve packaged native libraries pass both ZIP and ELF16KiB alignment. Public compiled web assets and native libraries match the owner-accepted test APK exactly, excluding only its private identity asset.

The accepted application/workflow source is `732065e5455ca4de734d4982a662c2819fdd01af`; public source8dc968b adds documentation only. All required application CI at that source passed, including687/687 Node/PostgreSQL, all four combined jobs, all five isolated native jobs, Android Build/Auth/Gemini/WP32 E2E. [WP38 report](WP38_REPORT.md) and [accepted test receipt](WP38_PRIVATE_APK.md) retain the original evidence. Fresh pre-promotion Node22 regressions passed686/687 with0fail and1existing real-database skip. Exact public main/tag builds passed their own regression/build/audit gates.

Initial main38595403808 and tag38595513573 stopped before Node setup on five inherited Markdown trailing spaces; no APK/release was published. The complete baseline diff reproduced this, and PR51 removed the spaces without changing application/build/workflow inputs or weakening the gate. The provisional, unpublished tag was finalized once at green corrected main with an exact old-ref lease and release-absence checks. Existing published tags/releases were untouched; `v2.1.4` is immutable after publication. Historical failures remain in [the ledger](WP38_PROGRESS.md).

Final receipt/documentation updates are a docs-only child of the immutable public source and do not rebuild or replace the published APK. Final documentation PR52 merged before cleanup. Exact local/remote tips of `codex/wp38-auth-gemini-reliability` and `codex/wp38-release-docs` were proven ancestors of clean pushed main, then both completed branches were deleted. Only `main` remains after completed receipt branches are merged and removed. Release tags, source, receipts, private artifacts and installed data remain preserved.

Install as a same-package, same-certificate update; do not uninstall or clear storage. The public build has its own checksum, distinct from the accepted private APK. Render effective runtime/routing/live-provider checks and exhaustive API/OEM/TalkBack certification remain separately unverified; no settings changes or manual provider calls were performed.
