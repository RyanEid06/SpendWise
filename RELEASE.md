# SpendWise Android Release & Update Runbook

SpendWise uses one permanent Android signing identity for all long-term APK updates.
Keep the keystore and its passwords safe. If the key is lost, Android will not allow a future APK signed with a different key to update the existing installation of `com.spendwise.app`.

## Versioning

`version.json` is the single source of truth:

```json
{
  "versionName": "1.3.0",
  "versionCode": 4
}
```

For every future release:

- increment `versionCode` by at least 1;
- change `versionName` to the user-facing version;
- create a matching tag such as `v1.3.0`.

Android Gradle and the Settings screen both read this file.

## One-time signing key setup

Generate the key once on a trusted machine with a JDK installed:

```powershell
keytool -genkeypair -v `
  -keystore "$HOME\spendwise-release.jks" `
  -alias spendwise `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000
```

Back up `spendwise-release.jks` somewhere safe and private. Never commit it to Git.

## GitHub Actions secrets

In GitHub: **Repository -> Settings -> Secrets and variables -> Actions -> New repository secret**.

Create these four repository secrets:

- `SPENDWISE_KEYSTORE_BASE64`
- `SPENDWISE_KEYSTORE_PASSWORD`
- `SPENDWISE_KEY_ALIAS`
- `SPENDWISE_KEY_PASSWORD`

For `SPENDWISE_KEY_ALIAS`, use `spendwise` if you used the command above.

To copy the keystore as Base64 from PowerShell without creating another file:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("$HOME\spendwise-release.jks")
) | Set-Clipboard
```

Paste the clipboard contents into `SPENDWISE_KEYSTORE_BASE64`.

## Normal CI

Pushes to `main` and maintenance branches run the full regression suite, Capacitor sync, `assembleDebug`, APK artifact upload, and the deployed Gemini backend smoke test. Signing secrets are not needed for this debug verification.

The debug APK is for internal testing/distribution only. For a permanent update path that can reliably replace an installed production build without clearing app data, use the signed tag workflow below.

## Publishing a permanent update

Only publish a version tag from `main` after the merged commit's debug CI is green:

```powershell
git tag v1.3.0
git push origin v1.3.0
```

The tag must exactly match `version.json`. The release job will:

1. verify the version/tag;
2. restore the signing key from GitHub Secrets;
3. build a signed release APK;
4. upload the APK as an Actions artifact;
5. publish `SpendWise-v1.3.0.apk` on GitHub Releases.

All future release APKs signed with this same key and a higher `versionCode` can update the existing app in place without clearing its local data.