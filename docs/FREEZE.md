# SpendWise 2.1.4 — product freeze

**Owner decision: product development complete, 2026-10-14.** SpendWise is frozen at the accepted public **2.1.4 / Android code14** release. There is no next work package or planned feature development.

## Accepted release

| Identity | Value |
| --- | --- |
| Package | `com.spendwise.app` |
| Public release | [v2.1.4 — Latest](https://github.com/RyanEid06/SpendWise/releases/tag/v2.1.4) |
| Immutable tag/source | `v2.1.4` at `8dc968b055eeb2bfc6a531ef347dce563f26f8bc` |
| Source verification | GitHub-signed merge commit, Verified |
| Public APK SHA-256 | `af50377cc519c7dadcb20be23337e94ba44dd2a222951b985f8667d23ececdb5` |
| Public main/tag builds | [38596394266](https://github.com/RyanEid06/SpendWise/actions/runs/38596394266), [38597721857](https://github.com/RyanEid06/SpendWise/actions/runs/38597721857) |
| Post-cleanup main build | [38613592505](https://github.com/RyanEid06/SpendWise/actions/runs/38613592505), passed at `6a356f6a742e6939bd501b994dc4cf7cc1461d2b` |
| Owner phone acceptance | “It officially all works”, 2026-10-14 |

The [public receipt](WP38_PUBLIC_RELEASE.md) and [machine receipt](WP38_PUBLIC_APK_RECEIPT.json) preserve the signer, source, APK, download and alignment checks. Final presentation and freeze changes do not modify application code, dependencies, build inputs or the published APK.

## Completion checklist

- Version metadata in `package.json`, `package-lock.json` and `version.json` agrees on 2.1.4; Android code remains 14.
- Required application CI passed at the accepted immutable application source, including 687/687 Node/PostgreSQL tests and all required native/browser gates.
- The official signed APK, checksum, source receipt and SBOM are published; 2.1.4 is Latest.
- Every shared entry in the public and accepted test APKs is identical. The test APK adds only `assets/public/wp35-build.json`; existing test installations need no replacement.
- Current documentation identifies 2.1.4, and older acceptance/failure records remain clearly historical.
- Read-only backend health on 2026-10-14 reported `ok: true`, source `6a356f6a742e`, installation authentication, AI configured and legacy compatibility disabled. This documentation-only descendant retains the published application inputs; no provider request or settings change was performed.
- Documentation links resolve locally; generated builds, logs, signing material and runtime state are excluded from tracked source.
- Completed work is merged to `main`; temporary branches are removed after ancestry checks. Final freeze acceptance requires a clean local checkout synchronized with remote `main` and no open PRs or issues.

## Maintenance policy

`main` is the canonical source. Preserve the immutable release tag, signed download, tests and historical receipts. No further product changes or routine dependency upgrades are planned. Dependabot version-update PRs are paused for npm and GitHub Actions using `open-pull-requests-limit: 0`. This setting controls routine version PRs; existing security settings are unchanged. See [GitHub's configuration guidance](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates).

The final main CI passed its production dependency audit and high-severity all-dependency audit. The GitHub API reported Dependabot alerts disabled for this repository; an alert listing was unavailable. No alert-setting or account-permission changes are included in this freeze.

A future security issue or external service change may require an explicit owner decision to reopen maintenance. A frozen source release cannot guarantee that Android, Render, Gemini or other external services remain unchanged forever. This checkpoint does not change Render settings, create a new release or archive the GitHub repository.

## Evidence limits

Owner testing establishes practical phone acceptance. It does not certify every API/OEM/device/TalkBack combination. Read-only backend health establishes readiness and reported source only; effective Gemini routes, provider quota and cold/warm behavior require separate live-provider evidence. No live Gemini request is needed to freeze this source release.

The [verification guide](VERIFICATION.md), [current status](STATUS.md) and [security boundaries](SECURITY.md) remain the detailed evidence references.
