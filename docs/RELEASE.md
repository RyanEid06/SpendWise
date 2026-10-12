# Signing and release runbook

Current candidate metadata: **2.1.2 / Android versionCode12**, package `com.spendwise.app`.
This is the user-requested private WP36 phone-test candidate on
`codex/wp35-integration`; public main remains2.1.0/code10. No2.1.2 tag or
public release is authorized yet.

**Current checkpoint: GREEN through WP36, owner phone acceptance confirmed
2026-10-11.** Backend deployment and signed APK delivery passed.
See [status](STATUS.md), [APK receipt](WP36_PRIVATE_APK.md) and [roadmap](ROADMAP.md).
WP37 is next; main remains untouched until after WP37.
`version.json` is authoritative; package and lockfile root versions must match.
The current authoritative values are:

```json
{"versionName": "2.1.2", "versionCode": 12}
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

For the private2.1.2/code12 phone trial, dispatch `wp35-integration.yml` on the
integration branch with `signed_test_apk=true` and its exact expected source.
It calls the reusable `wp35-test-apk.yml`; this build-only workflow uses
the permanent key and checks actual package/version/signature/hash; it does not
repeat signed upgrade emulator certification, deploy the backend or publish.
WP35's combined full native/recovery/API36 gates have separate green receipts.
Render now runs the manually selected integration commit `d89063b8630c74355074544d1e5dfe215c66aab2`.
The configured branch label remains main and auto-deploy is disabled. Health
reports `d89063b8630c`; authenticated synthetic analysis and the owner's phone
test passed. Do not uninstall the owner's app.

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
