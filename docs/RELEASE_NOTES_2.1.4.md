# SpendWise 2.1.4

Official Android release: **2.1.4 / versionCode14**, package `com.spendwise.app`.

[Download APK](https://github.com/RyanEid06/SpendWise/releases/latest/download/SpendWise-v2.1.4.apk) · [Release/tag](https://github.com/RyanEid06/SpendWise/releases/tag/v2.1.4) · [Verification receipt](WP38_PUBLIC_RELEASE.md)

## What changed

- More reliable fingerprint and supported PIN/pattern/password authentication. Cancelled or interrupted attempts recover cleanly, stale results stay rejected, and protected access still requires the existing Keystore operation.
- Concise Arabic lock wording and correct RTL isolation of the SpendWise brand, preserving the existing design and English/French.
- Consistent quota handling across AI Retry and Analyze/Refresh/Scan controls. Failed local analysis or cache preparation releases loading state; failed scans retain previous validated results/photos.
- Bounded backend recovery after qualified invalid Gemini JSON/schema/quality responses, using at most one distinct configured alternate within existing limits. Strict schema/financial validation and deterministic calculations remain intact. Effective deployed routing is separately verified by the operator.

This public release also includes the intervening WP35–WP37 reliability work previously delivered privately: durable installation authentication and readiness handling, bounded AI operations and cancellation, qualified task routing, deterministic localized Statistics explanations, and retained Android encryption/recovery/backup safeguards. See [current features](../README.md) and [verification](VERIFICATION.md).

## Update and verification

Install over an existing SpendWise installation; the application ID and permanent signing certificate are unchanged. Do not uninstall or clear storage. VersionCode14 supersedes public code10 and private code13. The owner accepted the 2.1.4 phone build on 2026-10-14. Required automated application gates passed; the official tag workflow builds and signs the public APK and publishes its checksum, source receipt and dependency SBOM. [Public receipt](WP38_PUBLIC_RELEASE.md) records final download verification.

No new AI provider, architecture rewrite, dependency change, financial calculation change or increased timeout/retry budget is included. Render settings/manual provider checks and exhaustive OEM/API certification are separate from this release.
