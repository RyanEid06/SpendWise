# SpendWise 2.1 automated verification

## WP38 2.1.4 / code14 — automated gates and owner testing passed

The [WP38 ledger](WP38_PROGRESS.md) records current red/green evidence. All six required workflows passed immutable source `732065e5455ca4de734d4982a662c2819fdd01af`, including all four combined jobs and all five isolated native jobs. Private build38589986178 passed; independent Google apksig/binary-manifest/asset inspection verified V2, permanent signer, hash, package/version, embedded source/run and compiled HTTPS endpoint. [Artifact receipt and CI links](WP38_PRIVATE_APK.md). Final documentation changes do not alter the tested application. The owner reported “It officially all works” on 2026-10-14 and authorized the public Latest release/tag; [public build and independent download verification](WP38_PUBLIC_RELEASE.md) passed: main38596394266 and tag38597721857 at GitHub-Verified source `8dc968b055eeb2bfc6a531ef347dce563f26f8bc`; actual public package2.1.4/code14/permanentV2 signer/checksum/source/HTTPS and all twelve native ZIP/ELF16KiB alignments verified. Compiled web assets and native libraries match the accepted test APK. Latest APK resolves HTTP200. Exhaustive device coverage and effective Render/live-provider checks remain separately unverified. Historical WP37 acceptance is not used as WP38 proof.

## WP37 2.1.3 / code13 — code, CI and main integration passed

[Combined38286074724 attempt2](https://github.com/RyanEid06/SpendWise/actions/runs/38286074724) passed web/PostgreSQL, API36 isolated
editor/continuity, full API34 acceptance and encrypted draft recovery on
`99278cebbc1b46e80b8e6b434e33f727954c5927`. One unchanged acceptance-only
retry passed; initial media navigation failure and artifacts remain retained.
Main PR [Android Build38296180292](https://github.com/RyanEid06/SpendWise/actions/runs/38296180292) passed on integrationfa1dae.
[PR48](https://github.com/RyanEid06/SpendWise/pull/48) merged exact same file tree
to main `9045c699346f44f7867cf9d1238c6558ca17e841`. Independent immutable reviews found no required findings.
Local version checks:648passed,0failed,1PostgreSQL skip; TypeScript/build passed.

[Private exact-main build38297255401](https://github.com/RyanEid06/SpendWise/actions/runs/38297255401) passed and was independently verified: hash, permanent
V2 signer, compiled package/version, embedded source/run and HTTPS endpoint.
[WP37 artifact receipt](WP37_PRIVATE_APK.md) records exact values. Post-merge
[main Android Build38297213552](https://github.com/RyanEid06/SpendWise/actions/runs/38297213552) passed too.
Owner screenshots verify Render main / After CI Checks Pass. Public HTTP200
health reports matching main9045c699346f and auth-store readiness; synthetic
installation auth plus legacy-periodless/new144month trends requests passed
deterministic summary and client-shape checks. Owner Deploys screenshot confirms Auto-Deploy/main9045c69/Live in1m12s;
deployment ID was not displayed. [Current status](STATUS.md) records the scoped proof.
Owner reported WP37 manual testing green on2026-10-12; exhaustive OEM/API/TalkBack coverage remains unverified. No public release.

## Historical 2.1.2 / WP36 checkpoint — GREEN

As of 2026-10-11, code/CI, backend deployment, signed APK delivery and owner
phone acceptance are green. The owner confirmed “all works nice”.
[Current status](STATUS.md) records the exact application/backend commits,
[combined CI38164832712](https://github.com/RyanEid06/SpendWise/actions/runs/38164832712),
[Android Build38164841401](https://github.com/RyanEid06/SpendWise/actions/runs/38164841401)
and [signed APK38168712767](https://github.com/RyanEid06/SpendWise/actions/runs/38168712767).
See the [2.1.2 artifact receipt](WP36_PRIVATE_APK.md). Subsequent WP37 delivery
under its [approved scope](WP37_SPEC.md) has independent evidence
in the [progress ledger](WP37_PROGRESS.md). This WP36 receipt does not certify WP37;
main was unchanged at that historical checkpoint; the public2.1.0 release remains unchanged.

## Historical published 2.1.0 verification

Published release **2.1.0/code10**, package `com.spendwise.app`:
[official release and verification assets](https://github.com/RyanEid06/SpendWise/releases/tag/v2.1.0).
Tagged application and documentation source:
`005d1d0f78d5c7917a5d63c848d487d44b50ee91`.
Final automated application source:
`d6838dc076913801239de74ab92577b6c7beb30c`.
The later documentation cleanup changes current documentation and two documentation
assertions only. Application, dependency lock, Android, workflow, runner and native
fixture inputs retain the tested tree. The published receipt records the final tag SHA.

| Gate | Actual result | Evidence |
| --- | --- | --- |
| Official tag debug/backend and permanent-signed release build | Passed; published APK independently downloaded and verified | [37975298591](https://github.com/RyanEid06/SpendWise/actions/runs/37975298591) |
| Android debug, dependency gates and deployed authenticated Gemini | Passed | [37968566745](https://github.com/RyanEid06/SpendWise/actions/runs/37968566745) |
| Full sequential native + executable web | Passed; 26 retained native JUnit flows, zero failures/errors | [37968599647](https://github.com/RyanEid06/SpendWise/actions/runs/37968599647) |
| Encrypted recovery | 33/33 native flows; at-rest, reboot/keyguard, process death, photo/Edit recovery | [37968604977](https://github.com/RyanEid06/SpendWise/actions/runs/37968604977) |
| Node22/component/Playwright regression | 443/443 Node, 39 components, 48 Playwright | [37968604977](https://github.com/RyanEid06/SpendWise/actions/runs/37968604977) |
| Actual permanent-signed API36 startup/upgrades | 19/19 retained flows, zero failures/errors | [37968610165](https://github.com/RyanEid06/SpendWise/actions/runs/37968610165) |
| API36 FileProvider instrumentation | 3/3, zero failures/errors | [37968610165](https://github.com/RyanEid06/SpendWise/actions/runs/37968610165) |

Both retained signed upgrade receipts passed: populated2.0.1/code7 through actual
2.0.2/code8 installed without launching, then2.1/code10; and populated actual
2.0.2/code9 to2.1/code10. Budget1250 and the exact synthetic expense were read through
production storage after same-certificate updates. This establishes emulator
functionality, not the owner's physical data/phone acceptance.

The final published APK SHA-256 is
`af705a5c4f05a3419dea8cb29630057060697f61bc7ac1e810f4211bbbff36c8`.
The independently downloaded APK matched public `SHA256SUMS`, the GitHub asset
digest and the delivered Desktop copy. The public build receipt records exact
source `005d1d0f78d5c7917a5d63c848d487d44b50ee91`, package/version and run37975298591.
Independent Google apksig verification of that public APK confirmed a valid V2
signature and the permanent certificate. Decoded compiled manifest checks found non-debuggable,
backup-disabled, cleartext-disabled configuration and non-exported providers.
Embedded Capacitor config retained HTTPS/encryption, without a remote server,
WebView debugging or mixed-content override. Native64-bit ELF and ZIP16KiB alignment
passed. Packaged PNG pixel identities match the padded original splash resources.
The public CycloneDX SBOM contains 331 components. Its digest and the exact
source/build receipt were independently checked against the published assets.

The actual Settings screenshot was reviewed: version2.1.0, nine-photo summary,
no build-number row and no clipped Settings rows. Prelaunch Light/Dark videos
were retained and inspected. Light contains visible branding; Dark and other
intervals contain protected black frames. These recordings do not establish a
complete first-second system-splash/no-mask-clipping or no-black-transition visual
pass. No privacy protection was weakened; that visual acceptance remains with
the owner phone trial.

Local Gitleaks8.30.1 binary was verified against publisher checksums. The exact
current source tree had zero findings. Scanning586 historical commits yielded one
false positive, verified from source: a public localStorage metadata namespace,
not an API credential. Hosted Dependabot alerts were disabled and secret-scanning
API permissions were unavailable; those services are not represented as green.
CI enforces production moderate-or-higher and overall high-or-higher npm audit
thresholds. Three development-only moderate findings did not breach those gates.

Native artifact names containing `failure` are historical upload names: the run
above concluded success and its retained26 reports contain no failures/errors.
Generated evidence and complete pre-cleanup Git/file backups are kept locally
under ignored `artifacts/wp34-release-monitor/`, not committed with financial data.

The owner authorized publication followed by phone trial.
[Current owner phone acceptance and future regression checklist](MANUAL_ACCEPTANCE.md)
supersede this historical trial's pending status; separate per-scenario TalkBack
or splash recordings were not supplied with the 2.1.2 owner sign-off.
