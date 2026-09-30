# SpendWise Threat Model — WP25

Status: authoritative design contract for WP26-WP34  
Baseline reviewed: main at 0a60702eed64e6558e80330c9c2c15905d3e313e  
Product baseline: SpendWise v1.4.0  
Scope: Android is the primary hardened target; web behavior is documented separately where its guarantees differ.

This document is an engineering threat model mapped to the OWASP Mobile Application Security Verification Standard (MASVS) and current Android security guidance. It is not a claim of OWASP certification or formal compliance.

## Security objectives and assumptions

SpendWise is a local-first financial application. The hardened design must protect confidentiality and integrity of the ledger, private media, authentication material, and portable backups while preserving recoverability and the existing product shape.

The Android application sandbox is useful isolation, but it is not sufficient protection for the financial data stored by v1.4. The target design therefore assumes defense in depth: Android device lock, App Lock, Android Keystore, encrypted database/media, authenticated portable backups, HTTPS, short-lived backend authorization, bounded server costs, and privacy-safe diagnostics.

Hard limits:

- A fully rooted or otherwise compromised Android OS can observe or manipulate an unlocked application process. SpendWise cannot guarantee confidentiality in that state.
- Anything permanently embedded in an APK, including Vite build variables, endpoints, public keys, algorithms, and certificate pins, is recoverable by an attacker and is not a secret.
- Local encryption reduces offline data exposure; it does not replace portable backups.
- A user-controlled encrypted backup cannot be recovered after its passphrase is forgotten unless a separate recovery mechanism exists. SpendWise will not add a hidden recovery key.
- Public-key installation registration without trusted attestation proves possession of a registered private key, not that the registering binary is an official SpendWise APK.

## Current v1.4 security reality

The following findings are from the reviewed implementation, not assumptions from the roadmap.

- Android financial records are stored in Capacitor SQLite opened with mode no-encryption.
- Web financial records are stored in browser localStorage.
- App Lock enabled state, timeout, and the custom 4-8 digit PIN are stored in localStorage; the PIN is persisted verbatim and compared directly on unlock.
- Failed App Lock attempts are throttled through persistent localStorage state, with a maximum delay of 30 seconds.
- Native receipt/purchase/proof images are re-encoded as JPEG and stored in app-scoped Directory.Data, but the JPEG bytes are not encrypted.
- android:allowBackup is false. The FileProvider is non-exported, but file_paths.xml currently exposes both the entire external path and cache path to URIs that the app chooses to grant.
- Backup v1 is plaintext JSON. Backup v2 is a plaintext ZIP with schema checks, CRC validation and optional SHA-256 media checksums; those checks detect corruption but are not a secret-key authenticity boundary.
- CSV export is intentionally plaintext.
- Native exports are written to the app cache in plaintext before the platform share sheet is opened; there is no explicit post-share deletion in v1.4.
- AI requests contain bounded structured financial data or images and are sent to the SpendWise backend. AI responses may be cached in localStorage.
- The Gemini provider secret is server-side. The current VITE_API_ACCESS_TOKEN is compiled into the APK and must be treated as public/recoverable client material.
- Backend failure logging is already comparatively conservative: endpoint, request ID, attempt, code, duration and retry status are logged rather than financial request bodies.
- Android release signing material is supplied by GitHub Actions secrets and reconstructed as a temporary runner keystore, not committed to the repository.
- The Android manifest has no explicit production network-security configuration or explicit no-cleartext rule today.
- The requested capacitor.config.ts does not exist in this repository; the real configuration file is capacitor.config.json.

## Sensitive-asset inventory

C/I/A means confidentiality, integrity, and availability/recovery priority.

| Asset | C/I/A | v1.4 location and protection | Post-WP34 target | Owner |
| --- | --- | --- | --- | --- |
| Expenses and amounts | High / High / High | Plaintext Android SQLite; web localStorage; app sandbox only | SQLCipher on Android; explicit web lower-assurance model; authenticated backups | WP29, WP30 |
| Descriptions and notes | High / High / High | Same ledger stores; may also enter AI payloads | Encrypted local store; bounded explicit AI disclosure | WP29, WP31 |
| Categories and timestamps | Medium-High / High / High | SQLite/localStorage | Encrypted local store | WP29 |
| Budgets | High / High / High | SQLite/localStorage | Encrypted local store | WP29 |
| Currency | Medium / High / High | SQLite app_meta plus localStorage legacy/preferences | Encrypted ledger ownership; migration-safe metadata | WP29 |
| Receipt/purchase/proof photos | High / High / High | Plain JPEG in app-scoped data; temporary previews/exports | Versioned authenticated encryption; plaintext only in bounded transient use | WP29B |
| Attachment metadata | Medium-High / High / High | SQLite or web localStorage | Encrypted DB; integrity-linked to encrypted media | WP29 |
| App Lock enabled state | Medium / High / Medium | localStorage boolean | Non-secret preference; security state coordinated by native auth service | WP28 |
| App Lock PIN | High / High / Medium | Plaintext localStorage | Retired on native Android; no plaintext credential residue | WP28 |
| Lock timeout | Low / High / Low | localStorage integer | Preference, validated; controls in-memory unlocked-session lifetime | WP28 |
| Failed-attempt throttle | Low / High / Low | localStorage JSON | Persistent security-state store with tamper-aware semantics; server-independent | WP28 |
| Native SQLite database | High / High / High | App-private but plaintext | SQLCipher with random database secret | WP29A |
| localStorage preferences/state | Varies / Medium-High / Medium | Browser/WebView localStorage | Only non-secret preferences and explicit lower-assurance web state; no native secret material | WP28-WP29 |
| AI response cache | High / Medium / Low | localStorage per month | Clear on lock/security transitions as appropriate; never considered authoritative ledger data | WP28/WP29 |
| Backup v1 | High / High / High | Plain JSON | Import-only compatibility; warning if legacy export remains | WP30 |
| Backup v2 | High / High / High | Plain ZIP; validation/checksums | Import-only compatibility; v3 default | WP30 |
| Backup v3 | High / High / High | Does not exist | Passphrase-derived authenticated encryption, portable between devices | WP30 |
| CSV | High / High / Medium | Plaintext text export | Still plaintext by design, with warning and fresh re-auth before export | WP30 |
| Gemini request payloads | High / High / Low | HTTPS expected but URL scheme not enforced by app; backend forwards selected data to Gemini | HTTPS-only production, minimum necessary fields, no payload logs | WP31 |
| Gemini responses | Medium-High / Medium / Low | Returned to app; some cached locally | Same semantics with encrypted/local-safe storage and bounded retention | WP29/WP31 |
| APK API access material | Low as a secret / High / Medium | VITE_API_ACCESS_TOKEN embedded in APK | Per-install Keystore key plus short-lived token; no permanent bearer secret | WP31 |
| Gemini provider secret | Critical / High / High | Server environment only | Server-only secret, rotation supported, never returned/logged | WP31/WP34 |
| Installation private key | High / High / Medium | Does not exist | Non-exportable Android Keystore EC key, not backed up | WP31 |
| Release signing material | Critical / Critical / Critical | GitHub Actions secrets; temporary runner JKS | Same principle plus final release/provenance checks | WP34 |
| Logs/errors | Potentially High / High / Low | Client errors collapsed; backend AI logs metadata only | Formal redaction contract and local diagnostics | WP33 |
| Temporary image/export files | High / Medium / Low | Camera/gallery transient URI; plaintext cache exports | Bounded lifetime, dedicated cache subtree, prompt cleanup, no long-term plaintext | WP29B/WP30 |
| Import staging data | High / High / High | JSZip/in-memory plus staged plaintext media before commit | Authenticate/decrypt/validate before ledger mutation; encrypted staging where persistent | WP30 |

## Trust boundaries and data flows

### Local financial flow

~~~text
React UI
  -> domain/controller layer
  -> ledger service
  -> repository interface
  -> encrypted native database
  -> Android app-private filesystem
~~~

The UI must not know SQLCipher modes, passphrases, or migration states. Repository adapters own persistence mechanics. The secure-key service is the only module allowed to cross the Keystore boundary.

### Media flow

~~~text
Camera/gallery
  -> acquisition URI / transient bytes
  -> image validation + normalization
  -> media encryption service
  -> encrypted app-private persistent file
  -> authenticated decrypt for bounded preview/share
~~~

Plaintext media is allowed only for the shortest practical transient window. Persistent media becomes authoritative only after encryption succeeds.

### App authentication and key flow

~~~text
Android device authentication
  -> BiometricPrompt using BIOMETRIC_STRONG and/or DEVICE_CREDENTIAL
  -> Android Keystore authorization
  -> unwrap SpendWise local data secrets
  -> unlocked in-process session
  -> close/zero/release secrets when SpendWise lock expires
~~~

The SpendWise timeout remains an app-session policy. It does not replace Android authentication.

### AI flow

~~~text
SpendWise app
  -> per-install signing identity
  -> challenge/nonce
  -> signed proof
  -> short-lived backend access token
  -> SpendWise backend
  -> Gemini
~~~

Gemini credentials remain server-side. Financial data is disclosed only when the user invokes an AI feature.

### Backup flow

~~~text
logical ledger/media
  -> backup serializer
  -> Backup v3 envelope encryption
  -> user-selected/share destination

portable backup
  -> envelope/KDF policy validation
  -> authenticate + decrypt
  -> schema/content/archive-limit validation
  -> staging
  -> transactional merge/replace
  -> verification
  -> activation
~~~

No restore may mutate the active ledger before the encrypted envelope and content are validated.

## Threat scenarios

### Lost or stolen device

Locked Android device:
- Current v1.4 benefits from Android full-device protections and the app sandbox, but its app data itself is plaintext after OS-level access is obtained.
- Target: encrypted DB/media secrets require Keystore access and, when App Lock is enabled, a fresh authorized unlock before protected local secrets are released.

Unlocked Android device, SpendWise locked:
- v1.4 App Lock is only a UI gate backed by a plaintext PIN.
- Target App Lock blocks normal access and keeps data secrets unavailable outside the authenticated session. This meaningfully improves theft resistance but cannot defeat a compromised OS.

Unlocked Android device, SpendWise currently unlocked:
- Sensitive content is accessible to the person holding the device until SpendWise locks.
- Target reduces exposure with timeout, Privacy Shield, and fresh re-auth for bulk export/destructive security actions. There is no honest way to cryptographically hide data from a person while the authorized app session is actively displaying it.

App Lock disabled:
- SpendWise follows the device-unlock trust decision. Local data remains encrypted at rest, but opening the app does not add a second user-presence check.

### Malicious normal Android application

Normal apps should not read SpendWise app-private storage, Keystore aliases, or a non-exported FileProvider directly. Threats remain through intentionally granted share URIs, screenshots/screen capture, clipboard or external destinations, overly broad provider paths, exported components, malicious input files, and network interception.

Target controls:
- keep providers/services non-exported unless required;
- narrow FileProvider roots to dedicated export cache only;
- grant URIs only to the chosen share recipient and only for the necessary duration;
- no sensitive clipboard flow unless explicitly required;
- Privacy Shield for App Lock/sensitive surfaces;
- android:allowBackup remains false;
- strict import validation and no path traversal;
- HTTPS-only production networking.

### Rooted or compromised device

A root attacker may read process memory, instrument the WebView, alter storage, call app code, or use Keystore operations while the app/user authorizes them. Keystore can make raw key extraction harder and hardware binding can improve resistance, but it does not make a compromised OS trustworthy.

SpendWise therefore treats root/debug/tamper checks only as risk signals. They are not a substitute for encryption, authentication, TLS, quotas, or server-side secrets, and normal sideloaded users must not be locked out merely because attestation is unavailable.

### APK reverse engineering

Assume an attacker can inspect the JavaScript bundle, Android resources, strings, endpoints, VITE variables, algorithms, public keys, and any certificate pins. Obfuscation/minification can raise effort but cannot turn embedded material into a secret.

Security consequence: backend authorization cannot depend on VITE_API_ACCESS_TOKEN or any other static APK bearer credential.

### Backend abuse

Threats:
- copied v1.4 token;
- fake clients and scripted registration;
- repeated new-install registrations;
- request replay;
- malformed/oversized bodies;
- brute-force authentication requests;
- per-install or per-IP quota evasion;
- IP rotation;
- compromised installation private key;
- Gemini/provider cost exhaustion.

Target:
- per-install Keystore signing key;
- server nonce that is single-use and expires after 120 seconds;
- signed challenge verification;
- access token lifetime of 10 minutes;
- renewal through a new signed challenge, not a long-lived refresh bearer token;
- independent registration, installation and IP quotas;
- initial registration throttle of 5 successful registrations/hour/IP and 20/day/IP, configurable server-side;
- AI rate limits enforced per installation and per IP, with the existing 30/minute behavior used only as a starting benchmark rather than the only control;
- global/provider spend guardrail and emergency circuit breaker;
- revocation of installation IDs/public keys;
- route-specific body/image limits and early rejection.

Without attestation, attackers can still automate fresh key generation and IP rotation. The cost controls are therefore layered and server-side.

### Network attacker

Production must reject non-HTTPS API origins. Android must explicitly disable cleartext production traffic using platform network-security policy. CORS is a browser/WebView boundary, not authentication.

Certificate/public-key pinning is not adopted for the current friend/sideload deployment. A stale or mis-rotated pin can brick network functionality for installed sideloaded APKs. Correct platform TLS validation, stable HTTPS origin policy, no cleartext traffic, short-lived authorization and server-side controls are preferred. WP31 may revisit pinning only if SpendWise controls a stable endpoint and can prove primary+backup pin rotation, overlap, expiry handling, CI coverage, and an emergency update path.

Residual risk: the platform CA trust model remains in the trust boundary.

### Backup attacker

Legacy v1/v2:
- copied files expose ledger data and, for v2 full backups, photos;
- v2 checksums are useful for accidental corruption but an attacker who can rewrite the archive can also rewrite unkeyed hashes.

Backup v3 target:
- random salt per backup;
- user-controlled passphrase;
- versioned Argon2id parameters bounded before allocation/work;
- AES-256-GCM authenticated encryption;
- authenticate envelope metadata required for decryption;
- wrong passphrase or tamper detected before mutation;
- input-byte, entry-count, individual-entry, aggregate-uncompressed-size and nesting limits;
- path traversal and duplicate path/ID rejection;
- merge/replace staging and rollback;
- forgotten passphrase is unrecoverable by SpendWise.

### Local corruption and interrupted operations

SQLite corruption:
- do not overwrite or silently initialize. Surface an explicit recovery state and offer validated backup restore.

DB encryption migration:
- journal state: not_started -> staging -> copied -> verified -> activated -> cleanup_complete.
- never delete the only valid plaintext source before the encrypted destination passes schema, row/invariant and close/reopen verification.

Media migration:
- each attachment has old/new authoritative state plus encryption format/key version;
- staged encrypted file is verified before metadata activation;
- plaintext deletion happens only after activation.

Keystore key missing/invalid:
- encrypted data remains present;
- application enters explicit key-recovery/data-unavailable state;
- never create an empty ledger over it.

Grouped Undo:
- current v1.4 already keeps the persistent record until the 5-second window expires. Process death before commit therefore favors data preservation. Future refactors must preserve this invariant.

Restore interruption:
- validate before mutation, stage new media/state, commit, verify, then cleanup old state. If rollback cannot be completed, enter a recovery state rather than pretending success.

### Privacy leakage

Android Recents/screenshots:
- v1.4 has no secure-window protection.
- target Privacy Shield uses Android secure-window mechanisms when App Lock is enabled and for designated high-sensitivity surfaces.

Logs/crash reports:
- never include expense descriptions, amounts, budgets, notes, receipt text/images, raw AI payloads, PIN/passphrase, DB/media keys, provider keys, or raw tokens.

AI:
- user invocation is the disclosure boundary. Send only fields required for the feature and do not log bodies.

CSV/backup/share:
- the share destination becomes outside SpendWise's trust boundary. CSV remains intentionally plaintext and must warn the user.
- cached plaintext export files must be deleted promptly after sharing/expiry, with stale-cache cleanup on startup.

## Privacy Shield decision

For the first hardened release, Privacy Shield is not a new user toggle. On native Android it is automatically enabled whenever App Lock is enabled. It is also enabled while high-sensitivity authentication/export/backup-passphrase/media-preview surfaces are active. A future opt-out requires a separate product decision and explicit warning.

The implementation must use the supported Android secure-window mechanism, while documenting that platform/OEM behavior can vary and that an already-compromised OS remains out of scope.

## Root, debugger, tamper and attestation policy

- Root, debugger and tamper checks: risk signals only; do not block normal app use by themselves.
- Play Integrity: deferred as a required control. If a Play-distributed build exists later, its verdict may be an additional backend abuse/risk signal.
- Sideloaded legitimate builds must continue to work without pretending they have Google Play attestation.
- The durable protections remain Keystore, encrypted data, authenticated backup, native authentication, TLS, backend quotas and server-side secrets.

## Residual risks after WP34

Even after the target architecture:
- an actively compromised/rooted OS can observe an unlocked session;
- a user can intentionally share/decrypt/export their own financial data;
- screenshots cannot be perfectly prevented across every OEM/platform path;
- anonymous installation registration cannot prove an official client without trusted attestation;
- TLS depends on platform trust because pinning is intentionally not adopted;
- user-chosen backup passphrases can be weak, so Argon2id slows but cannot eliminate offline guessing;
- loss of both Keystore-protected local keys and all usable portable backups means local data is unrecoverable;
- web remains lower assurance than native Android until a dedicated browser security/encryption design exists.

## Verification expectations

WP32/WP34 must exercise threats against the built application, not only source text. Required classes include migration kill/restart, missing key, wrong key, tampered DB/media/backup, wrong backup passphrase, screenshot/Recents checks, replayed backend nonce, expired/revoked tokens, oversized requests, update from a representative v1.4 installation, and release-APK configuration inspection.

## References

- OWASP MASVS: https://mas.owasp.org/MASVS/
- OWASP MASVS Storage: https://mas.owasp.org/MASVS/05-MASVS-STORAGE/
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Android biometric authentication: https://developer.android.com/identity/sign-in/biometric-auth
- Android Network Security Configuration: https://developer.android.com/privacy-and-security/security-config
- Android screenshot/FLAG_SECURE guidance: https://developer.android.com/about/versions/14/features/screenshot-detection
- RFC 9106 Argon2: https://www.rfc-editor.org/info/rfc9106/
- Capacitor Community SQLite encryption documentation: https://github.com/capacitor-community/sqlite/blob/master/docs/DatabaseEncryption.md
