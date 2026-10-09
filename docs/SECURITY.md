# Security, storage and recovery

This records implemented boundaries and release checks. It does not establish
physical-device acceptance or protection against a compromised OS.

## Financial storage and authentication

Android financial storage uses encrypted SQLCipher; media uses AES-GCM envelopes.
Database and media secrets are separate and Keystore-wrapped. Installation signing
uses a separate P-256 key. Backup keys derive from passphrases, not App Lock.
Strong biometrics/device credentials remain the native authentication boundary;
cancel/retry must preserve protection and data. Session-secret caches are released
on lock where practical. Runtime copies and the SQLite plugin operational mirror
mean the whole stack must not be called exclusively ephemeral.

Browser PIN protection is a UI privacy lock, with a versioned Argon2id verifier
and throttling. Ordinary browser localStorage does not have Android's encryption
assurance. Unfinished browser drafts use encrypted IndexedDB recovery. Same-origin
code/profile access still has lower assurance than native Keystore protection.

Migrations stage and verify replacements before removing plaintext sources.
Missing/invalidated keys and incomplete migration fail closed; unreadable encrypted
data must not become an empty ledger. Protected drafts must recover once or discard
cleanly, without duplicate rows or orphaned photos. Recovery does not resume an
interrupted network request automatically.

## Privacy and sharing

Sensitive native surfaces use `FLAG_SECURE`; do not disable it to obtain screenshots.
OEM screenshot/Recents behavior requires owner testing. Ordinary Settings is safe
to capture with synthetic data. Integrity failures are isolated from unrelated
financial startup while authenticated media reads still reject damaged files.
Repair must preserve financial/media ownership.

The release manifest disables Android backup and cleartext traffic and is not
debuggable. Capacitor uses local HTTPS, with production WebView debugging and
mixed content disabled. Public TLS uses platform trust, without certificate pinning.
The only unrestricted exported app entry is the launcher; the profile installer
receiver requires Android's DUMP permission. App and camera FileProviders are
non-exported with temporary URI grants. The app provider exposes `Pictures/`
and `cache/shared/`, not private database/secret/cache roots. API36 instrumentation
checks real URI boundaries.

CSV and legacy imports are plaintext. Sharing writes explicit exports into the
restricted `shared/` cache namespace; they may remain until cache cleanup.
Do not describe plaintext exports as encrypted backups. Logs/support diagnostics
must exclude financial bodies, photos, passphrases, keys and raw tokens.

## Portable backups

Backup v3 uses `SWB3`, version3, a bounded authenticated JSON header and AES-256-GCM
ciphertext/tag. Fresh salt and nonce accompany a passphrase-derived Argon2id key.
KDF parameters are validated before derivation. The logical payload is Backup v2
ZIP data/photos, not native database ciphertext, device keys or credentials.

Restore authenticates first, validates ZIP structure and schemas before mutation,
rejects path traversal/duplicates/unexpected formats, and validates financial and
media ownership invariants. Media is staged, candidate state committed and old
media cleaned only following success; failures attempt rollback and staged cleanup.
Preserve v1 JSON/v2 ZIP compatibility, wrong-passphrase/tamper rejection, eight-photo
limits, 5MiB item limits and the 512MiB payload ceiling.

There is no hidden recovery key. Forgotten backup passphrases or lost device keys
can make data unrecoverable. Local encryption does not replace portable backups.

## Release evidence and limits

See [verification](VERIFICATION.md) for actual source/run identities, signature,
manifest, native alignment, dependency and secret-scan evidence. Hosted Dependabot
alerts were disabled and secret-scanning API access was unavailable; no zero-alert
claim is made for these services. CI dependency audits and a verified local redacted
Gitleaks scan are retained separately. Manual phone/TalkBack acceptance remains
[pending](MANUAL_ACCEPTANCE.md).
