# Signing and release runbook

Current WP37 candidate metadata: **2.1.3 / Android versionCode13**, package `com.spendwise.app`.
The owner selected this next version after the accepted private WP36 **2.1.2/code12** build.
The permanent signing identity is retained. Review and required CI gate merging
through integration to main; then build the private APK from the exact merged main SHA.
No2.1.3 tag or public release is authorized.

**WP37 code/required application CI and main integration passed (2026-10-12).**
[PR48](https://github.com/RyanEid06/SpendWise/pull/48) merged main9045c699;
[private exact-main build38297255401](https://github.com/RyanEid06/SpendWise/actions/runs/38297255401) passed and was independently verified in the
[WP37 receipt](WP37_PRIVATE_APK.md). Owner screenshots confirm existing Render
main / After CI Checks Pass; live health matches main9045c699346f, installation
auth and two bounded synthetic compatibility checks passed. The owner Deploys screenshot confirms Auto-Deploy/main9045c69/Live in1m12s;
a deployment ID was not displayed.
WP37 physical/OEM/TalkBack remains unverified; historical WP36 owner acceptance
and [private2.1.2 receipt](WP36_PRIVATE_APK.md) remain distinct. See [status](STATUS.md).
`version.json` is authoritative; package and lockfile root versions must match.
The current authoritative values are:

```json
{"versionName": "2.1.3", "versionCode": 13}
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

For WP37's private2.1.3/code13 APK, after the checked main merge dispatch
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
phone acceptance separate; this 2.1 release was authorized for the subsequent phone trial.

The tag must match `version.json`. Publish from the verified final main commit:

```powershell
git tag v2.1.0 <verified-main-sha>
git push origin v2.1.0
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
