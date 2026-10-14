# Current status — SpendWise 2.1.4

**2.1.4 / Android code14**, package `com.spendwise.app`, is accepted by the owner. On 2026-10-14 the owner reported “It officially all works” and authorized main integration, the official public Latest release, tag `v2.1.4`, current documentation updates and deletion of completed branches after verification. Publication and independent public download verification passed; [public release receipt](WP38_PUBLIC_RELEASE.md), [release notes](RELEASE_NOTES_2.1.4.md), [progress](WP38_PROGRESS.md).

## WP38 delivery gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Reviewed application/workflow | VERIFIED | `732065e5455ca4de734d4982a662c2819fdd01af`; later changes are documentation only |
| Required application CI | GREEN | [Combined38530729922](https://github.com/RyanEid06/SpendWise/actions/runs/38530729922), all four jobs; [isolated38530734631](https://github.com/RyanEid06/SpendWise/actions/runs/38530734631), all five jobs; Android Build/Auth/Gemini/WP32 E2E passed at the same source |
| Accepted signed test APK | GREEN / INDEPENDENTLY VERIFIED | [Build38589986178](https://github.com/RyanEid06/SpendWise/actions/runs/38589986178); [test artifact receipt](WP38_PRIVATE_APK.md) |
| Owner phone testing | GREEN — OWNER REPORTED | “It officially all works”, 2026-10-14; no detailed device/API/OEM measurements or exhaustive matrix supplied |
| Main / public tag / Latest release | GREEN / PUBLISHED | [PR50](https://github.com/RyanEid06/SpendWise/pull/50) and formatting correction [PR51](https://github.com/RyanEid06/SpendWise/pull/51) merged; `v2.1.4` at GitHub-Verified `8dc968b055eeb2bfc6a531ef347dce563f26f8bc`; [official release verification](WP38_PUBLIC_RELEASE.md) |
| Public tag/main CI | GREEN | [Main38596394266](https://github.com/RyanEid06/SpendWise/actions/runs/38596394266), [tag38597721857](https://github.com/RyanEid06/SpendWise/actions/runs/38597721857), verify-debug and signed-release passed |
| Official public APK | GREEN / INDEPENDENTLY VERIFIED | Permanent signer/V2, package/version/source/checksum, accepted web/native assets, twelve 16KiB-aligned native libraries; [machine receipt](WP38_PUBLIC_APK_RECEIPT.json); Latest APK HTTP200 |
| Render / live Gemini | SEPARATELY UNVERIFIED | No settings changes or manual provider calls included; an APK release is not proof of deployed backend routing |

The public release retains the permanent signer and version 2.1.4/code14. Historical release and deployment receipts below remain dated evidence, not the current release designation.

## Accepted WP37 main checkpoint (historical)

Updated **2026-10-13** after delivery and owner manual acceptance on2026-10-12. Candidate **2.1.3 / Android code13**, package
`com.spendwise.app`. Independent immutable application, workflow and version
reviews found no remaining required actionable findings.

| WP37 gate | Status | Evidence |
| --- | --- | --- |
| Required application CI | GREEN | [Combined38286074724 attempt2](https://github.com/RyanEid06/SpendWise/actions/runs/38286074724), all four jobs passed on exact source99278ce |
| Main PR Android Build | GREEN | [38296180292](https://github.com/RyanEid06/SpendWise/actions/runs/38296180292) at integrationfa1dae |
| Main integration | MERGED | [PR47](https://github.com/RyanEid06/SpendWise/pull/47), [PR48](https://github.com/RyanEid06/SpendWise/pull/48); main `9045c699346f44f7867cf9d1238c6558ca17e841` |
| Private signed APK | GREEN / INDEPENDENTLY VERIFIED | [38297255401](https://github.com/RyanEid06/SpendWise/actions/runs/38297255401), exact main2.1.3/code13; [hash/certificate/identity receipt](WP37_PRIVATE_APK.md) |
| Render settings | OWNER SCREENSHOT VERIFIED | Existing spendwise-api, branchmain, Auto-Deploy **After CI Checks Pass** |
| Render runtime | MAIN OBSERVED LIVE / SCOPED CHECKS PASSED | HTTP200 version9045c699346f; installation auth and legacy/new144month deterministic Statistics checks passed2026-10-12T19:33:57Z. Owner Deploys screenshot confirms Auto-Deploy / main9045c69 / Live,1m12s; deployment ID not displayed |
| WP37 manual phone testing | GREEN — OWNER REPORTED | Owner said “manual test done all green” for delivered2.1.3 on2026-10-12. No per-scenario device/OS measurements or exhaustive OEM/API/TalkBack certification supplied; [checklist](WP37_DEVICE_ACCEPTANCE.md) |

Feature99278ce, integrationfa1dae and main9045c699 share the exact tested tree
`08d4b0912d8be04efa4c83d34979eb8cda0737fa`. The main merge introduced no
application change. Owner authorized avoiding duplicate45minute manual native gates;
healthy additional automatic runs were preserved. One additional isolated backup
job was interrupted when Android killed SpendWise because Google FontsProvider's
process died; artifact11768143813 and log are retained. It is not claimed as a
passing check. Final-version full acceptance passed on one unchanged job-only
retry after the original media navigation mismatch. No assertion/security/timeout
was weakened; failure evidence remains in the [ledger](WP37_PROGRESS.md).

The private APK follows the main merge and retains the permanent signer. No tag,
public release or data reset was performed. Later owner authorization permits the audited completed-branch cleanup below. Final documentation
changes are separate from the exact application/APK/deployment source receipts.
[Post-merge main Android Build38297213552](https://github.com/RyanEid06/SpendWise/actions/runs/38297213552)
also passed. Owner screenshots establish main / After CI Checks Pass; public
runtime provenance establishes the matching main commit prefix. The owner Deploys screenshot confirms Auto-Deploy/main9045c69/Live in1m12s;
a deployment ID was not displayed.

## Historical WP36 owner acceptance — 2026-10-11

The owner accepted private2.1.2/code12, reporting “all works nice”. This historical
phone sign-off does not certify WP37. The following receipts describe WP36 only.

| Gate | Status | Evidence |
| --- | --- | --- |
| Code, review and automated CI | GREEN | [PR46](https://github.com/RyanEid06/SpendWise/pull/46), [combined CI](https://github.com/RyanEid06/SpendWise/actions/runs/38164832712), [Android Build](https://github.com/RyanEid06/SpendWise/actions/runs/38164841401) |
| Private signed APK | GREEN | [Build38168712767](https://github.com/RyanEid06/SpendWise/actions/runs/38168712767), [artifact receipt](WP36_PRIVATE_APK.md) |
| Backend deployment | GREEN | Render deploy `dep-db5ue7142hec73a8ehp0`, version `d89063b8630c`; HTTP200 health and authenticated synthetic Gemini analysis passed |
| Physical phone acceptance | GREEN — owner reported | Owner confirmed successful testing of the delivered 2.1.2 build in this conversation; no per-scenario device measurements or TalkBack transcript was supplied |

The historical WP36 green checkpoint includes WP35 readiness/durable authentication, bounded
Gemini retries/cancellation, honest progress and safe-area handling, plus WP36
task routing, verified financial facts, safe diagnostics and optional manual
descriptions. Earlier work-package reports retain their historical observations;
that WP36 sign-off superseded its earlier pending deployment/device status.

## Historical WP36 identity and branch boundary

- Tested application source: `dcd7198072903037aa150cd568d8e897eed485af`.
- Approved integration merge: `13b4a93b62c8cbd2a8c88371893ba903c2996808`.
- APK/backend source: `d89063b8630c74355074544d1e5dfe215c66aab2`; subsequent version/build metadata only, followed by the successful private build.
- Working branch: `codex/wp35-integration`. The merged WP36 fix branch was deleted with owner authorization.
- Main remains `7d00b2dafadf829f63d2b6074b08d08c00ca352d`; no main merge until after WP37.
- Render's configured branch label is main, but the exact integration commit above was manually deployed. Auto-deploy remains disabled.
- WP36 private APK: 2.1.2/code12. Latest public release: 2.1.0/code10. No 2.1.2 public tag/release was created.

## Historical WP36 validation and operating limits

Combined CI passed 548 Node/API tests including real PostgreSQL, 44 component,
75 browser, 3 accessibility and 8 visual checks, plus WP33 browser/performance
gates. Native unit2/2, lint, release-source compilation, debug build, API36
gesture/three-button editor checks, full API34 acceptance and encrypted recovery
passed. The separate private build verified the permanent APK signing identity.

Financial outputs remain grounded in deterministic facts; extraction still
requires review. Free-tier cold starts, quotas, future provider outages and
uncertain OCR remain operational limitations, not unresolved checkpoint failures.
The owner sign-off is practical phone acceptance, not an exhaustive new security,
accessibility, locale, destructive migration or provider-load certification.
Preserve green receipts; rerun only a failed/affected job after a justified fix.

See [WP36 review](WP36_REVIEW.md), [verification](VERIFICATION.md),
[manual regression checklist](MANUAL_ACCEPTANCE.md) and [roadmap](ROADMAP.md).

## Final owner-authorized cleanup — 2026-10-12

The owner explicitly authorized deleting completed SpendWise branches/worktrees
and disposable temporary files locally and on GitHub; other projects are excluded.
This supersedes earlier no-branch-deletion boundaries for this audited cleanup.
Merged feature `fix/wp37-localization-native-auth-ux` and integration
`codex/wp35-integration` were deleted locally/remotely after verifying their
exact tips are ancestors of main and PR47/PR48 are merged with no open dependency.
No extra worktree or stash existed. The final documentation branch is removed
only after its own PR merge; canonical main and all commit history remain.

After19/19 focused existing documentation-dependent checks and65local link checks
passed, removed only audited regenerable `node_modules`, `dist`,
`android/.gradle` and `android/build`:11,424files /282,500,955bytes.
Run `npm ci` before future local development; builds regenerate the other outputs.
Useful unique CI/runtime/review evidence, signed APKs, source and secrets remain.
The independently hash-verified delivery copy is
`C:\Users\Administrator\Desktop\SpendWise-v2.1.3-test.apk`.

## Historical artifact compaction and owner acceptance — 2026-10-13

Owner manual WP37 sign-off2026-10-12: **“manual test done all green”** on the
delivered2.1.3/code13. No detailed device/OS/API/OEM/TalkBack certification was supplied.

The historical artifact tree was compacted after a read-only path-consumer audit.
Preserved **7794files /1263509984bytes** in
`artifacts/history-2026-10-12.zip` (**581189507bytes**).
Archive SHA256: `f36b4a04e45674b42845db5deb5dbee4ec111586f84099a6df9bb8fd8f6e46ff`.
Every source relative path, size and SHA256 was verified against the ZIP and
rechecked against the original before removing loose originals. Full local index:
`artifacts/history-manifest.json`. Unique recordings/logs were preserved; no
claim is made that an unexamined recording establishes physical-device acceptance.

Current`artifacts/wp37` and operational`android-e2e`, `wp33`, `wp35`,
`wp35-live` inputs remain loose. Historical paths mentioned by dated reports
are now ZIP-relative paths; extract the archive **into artifacts/** if needed.
The artifact root now has seven items instead of372. Together with regenerated
dependency/build cleanup, about965MB was reclaimed, while source, secrets,
current signed APKs, Git history and useful evidence were preserved.

Final documentation-only PR49 records these receipts separately from application,
APK and live backend source9045c699. Its Android Build38301124879 passed at212b356.
An extra historical isolated-import job114984033851 failed at packageDebug before
emulator execution; no precise underlying cause appeared in its log. This duplicate
packaging result is not counted as passing application proof and no assertion was
weakened. The required application gates and exact-main delivery remain separately
verified above. Current final documentation changes affect Markdown only.
