# Signing and release runbook

**Product frozen at 2.1.4, 2026-10-14.** The official release is already published. The procedures below support reproduction or explicitly authorized future maintenance. [Freeze record](FREEZE.md), [documentation index](README.md).

Current official version: **2.1.4 / Android versionCode14**, package `com.spendwise.app`, permanent signing identity unchanged. On 2026-10-14 the owner accepted phone testing and authorized main integration, public Latest release/tag `v2.1.4`, documentation updates and verified completed-branch cleanup. Published Latest: [v2.1.4](https://github.com/RyanEid06/SpendWise/releases/tag/v2.1.4), GitHub-Verified source `8dc968b055eeb2bfc6a531ef347dce563f26f8bc`; main/tag builds passed and the public APK was independently verified. [Release notes](RELEASE_NOTES_2.1.4.md), [official release receipt](WP38_PUBLIC_RELEASE.md), [WP38 report](WP38_REPORT.md).

The accepted test build and all required application CI identify source `732065e5455ca4de734d4982a662c2819fdd01af`. Prove application/build inputs unchanged through documentation and main integration before tagging. Publish the official permanent-signed APK through `android-build.yml` from the verified main tag, then independently download and verify the actual public asset and receipt. Public and private build hashes may differ; retain separate receipts. Mark the stable release Latest and verify both the direct APK URL and `releases/latest`.

Do not uninstall, clear storage or reset keys. Render settings/manual provider calls are not part of this publication; effective production routing remains separate evidence. Delete only completed branch refs after proving merged ancestry, clean main and green applicable checks. Never recreate or move a published tag.

## Historical WP37 delivery

**WP37 code/required application CI and main integration passed (2026-10-12).**
[PR48](https://github.com/RyanEid06/SpendWise/pull/48) merged main9045c699;
[private exact-main build38297255401](https://github.com/RyanEid06/SpendWise/actions/runs/38297255401) passed and was independently verified in the
[WP37 receipt](WP37_PRIVATE_APK.md). Owner screenshots confirm existing Render
main / After CI Checks Pass; live health matches main9045c699346f, installation
auth and two bounded synthetic compatibility checks passed. The owner Deploys screenshot confirms Auto-Deploy/main9045c69/Live in1m12s;
a deployment ID was not displayed.
Owner reported WP37 manual testing green on2026-10-12; exhaustive OEM/API/TalkBack coverage remains unverified; historical WP36 owner acceptance
and [private2.1.2 receipt](WP36_PRIVATE_APK.md) remain distinct. See [status](STATUS.md).
`version.json` is authoritative; package and lockfile root versions must match.
The current authoritative values are:

```json
{"versionName": "2.1.4", "versionCode": 14}
```

Every future APK update must increase the Android version code and retain the
permanent signing identity. Never recreate or move a published release tag.

Permanent certificate SHA-256:

```text
e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965
```

## Credentials and build

Keep the permanent keystore backed up privately. Do not generate a replacement
key for this application. Repository signing secrets are `SPENDWISE_KEYSTORE_BASE64`,
`SPENDWISE_KEYSTORE_PASSWORD`, `SPENDWISE_KEY_ALIAS` and `SPENDWISE_KEY_PASSWORD`.
Never put them in Git, frontend variables, public receipts or test archives.

PR/main verification builds a debug APK and runs regression/dependency gates.
Live installation-authenticated Gemini smoke is manual opt-in, defaultfalse;
main/tag pushes do not automatically issue live generation calls.
Debug artifacts do not update an installed official release signed with another key.

The manually dispatched `wp33-5-06-candidate.yml` builds the permanent-signed APK
and verifies API36 startup, saved appearance/lifecycle transitions, populated
same-build updates, retained code7→code8-unlaunched→candidate and code9→code10.
It also runs separate debug-only FileProvider instrumentation. Dispatch with the
exact checked-out SHA, expected name/code and actual owner baseline code. Reviewed
pairs are 2.0.2/code9 and 2.1.0/code10; strict baseline/source/hash/signature checks
must be updated deliberately for later releases. Code8 is never launched in its
historical upgrade path because that artifact has the known Android16 startup bug.

For historical WP37's private2.1.3/code13 APK, after the checked main merge dispatch
`wp35-integration.yml` on `main` with `signed_test_apk=true` and
`expected_source` equal to the exact merged main SHA.
It calls the reusable `wp35-test-apk.yml`; this build-only workflow uses
the permanent key and checks actual package/version/signature/hash; it does not
repeat signed upgrade emulator certification, deploy the backend or publish.
WP35's combined full native/recovery/API36 gates have separate green receipts.
Historical WP36 Render verification used manually selected integration commit
`d89063b8630c74355074544d1e5dfe215c66aab2`, with main branch label and auto-deploy disabled.
Its health/authenticated synthetic analysis and owner's phone test passed then.
WP37 live HTTP200 health matches main9045c699346f; synthetic installation auth
and legacy/new144month Statistics compatibility passed. The [WP37 receipt](WP37_PRIVATE_APK.md)
records scope and the owner Auto-Deploy/main9045c69/Live screenshot (deployment ID not displayed). Preserve
the owner's installed app and data.

## Certification and publication

Run all relevant automated gates on final main/application inputs, including
`wp32-e2e.yml` with `native_phase=full`, encrypted recovery and signed upgrades.
Targeted phase success is scoped evidence and must not be described as a full run.
Inspect actual APK package/version, cryptographic signature, signer, source receipt,
manifest/WebView/provider/network boundaries, embedded files, SBOM and checksum.
Review system splash video recorded before launch in Light and Dark. Keep owner
phone acceptance separate; the owner accepted the 2.1.4 phone trial and authorized public publication on 2026-10-14.

The tag must match `version.json`. Publish from the verified final main commit:

```powershell
git tag -a v2.1.4 <verified-main-sha> -m "SpendWise 2.1.4"
git push origin v2.1.4
```

`android-build.yml` verifies the tag, builds with the permanent key, checks actual
APK identity and publishes the signed APK, `SHA256SUMS`, `build-receipt.json` and
`sbom.cdx.json`. The receipt identifies the actual tagged source and build run;
the public checksum applies to the published binary, not an earlier candidate.

Download the published APK independently, verify signature/certificate/package/
version/source and checksum, then provide it with the receipt on Desktop. Preserve
earlier owner artifacts and existing app data. Do not uninstall the owner's app
to work around an update/signature failure.

Archive obsolete docs and completed branch refs locally before cleanup. Preserve
main, release tags, source/tests/fixtures/security/CI tooling and recovery backups.
Documentation-only cleanup may reuse full-native evidence only after proving
unchanged application/build/native-flow inputs and verifying affected doc checks.
