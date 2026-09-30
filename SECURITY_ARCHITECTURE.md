# SpendWise Security Architecture — WP25

Status: locked engineering contract for WP28-WP34
Reviewed application baseline: 0a60702eed64e6558e80330c9c2c15905d3e313e
Target: hardened native Android release after WP34

This document defines security behavior and ownership. It maps SpendWise engineering decisions to OWASP MASVS control areas; it does not claim certification.

## 1. Locked decisions

1. Native Android custom SpendWise PIN is retired. Native App Lock moves to Android BiometricPrompt with BIOMETRIC_STRONG and/or DEVICE_CREDENTIAL where supported.
2. Android Keystore is the root of trust for native local key protection. Keys are non-exportable when the platform supports that property. Hardware-backed storage is preferred when available but is not a compatibility requirement.
3. The existing App Lock timeout remains a SpendWise session-freshness policy. On timeout, protected data access is closed and decrypted application secrets are discarded from the app process as far as practical.
4. Web is explicitly lower assurance. It must not force Android to keep a weaker custom PIN. If the web PIN remains, plaintext PIN storage is removed and a versioned Argon2id verifier is used; the web UI must not imply that this encrypts browser localStorage.
5. Database, media, backup, and installation-identity keys are separate. No single key is reused for all purposes.
6. The SQLCipher path supported by the existing @capacitor-community/sqlite plugin is the intended WP29A route, subject to an implementation proof against the exact plugin version. The migration may not ship if secret storage/key lifecycle cannot satisfy this contract.
7. Native persistent photos move to authenticated encryption. Intact long-lived JPEG/PNG payloads are not acceptable after a successful migration.
8. Backup v3 becomes the default portable backup and provides confidentiality plus authenticity using a user-controlled passphrase. Backup v1/v2 remain importable. CSV remains intentionally plaintext with an explicit privacy warning.
9. The APK-embedded VITE_API_ACCESS_TOKEN is not a production secret. WP31 replaces permanent bearer-token reliance with per-install asymmetric identity plus short-lived backend authorization.
10. Production networking is HTTPS-only with Android cleartext disabled explicitly. Certificate/public-key pinning is not adopted for the current sideload/friend deployment.
11. Privacy Shield is automatic when App Lock is enabled and on designated high-sensitivity surfaces. It is not a new toggle in the first hardened release.
12. Root/debugger/tamper detections are risk signals, not hard security boundaries.
13. External crash reporting is not enabled by default for the first hardened release. Local sanitized diagnostics plus aggregate backend operational metrics are preferred. Any future third-party crash service requires opt-in, disclosure, aggressive scrubbing, no screenshots, and no session replay.
14. SpendWise never silently initializes an empty ledger over encrypted data that cannot be decrypted.
15. No hidden backup-recovery/backdoor key is created.

## 2. Native App Lock and secure-session design

### Authentication primitive

Native Android uses Android BiometricPrompt. The preferred allowed authenticators are:

- BIOMETRIC_STRONG;
- DEVICE_CREDENTIAL;
- the combination where the Android version supports it correctly.

SpendWise minSdk is 24, so WP28 must implement the platform-specific compatibility path rather than assuming the newest API behavior on every supported device.

The Android device credential is the security credential. SpendWise no longer asks the user to invent a second short PIN on native Android.

### Migration from v1.4 plaintext PIN

WP28 migration rules:

1. Detect legacy App Lock enabled/disabled and the old PIN residue.
2. Do not delete the legacy PIN before the native authentication/key setup succeeds.
3. If App Lock is enabled, explain that SpendWise is upgrading protection and require establishment/confirmation of an Android secure lock credential if needed.
4. Create the versioned Keystore key and verify an authenticated cryptographic operation.
5. Mark native secure-lock migration complete.
6. Remove spendwise_lock_pin and any obsolete verifier material.
7. Preserve the user's App Lock enabled state and timeout.
8. If secure setup fails or is canceled, retain the legacy state and present a retry path; do not silently disable App Lock and do not destroy data.
9. Malformed legacy PIN state enters an explicit repair path rather than granting access by default.

After migration succeeds, native unlock never compares a user-entered SpendWise PIN.

### Unlocked session

Authentication authorizes opening a SpendWise protected session. The preferred pattern is an auth-per-use Keystore operation to unwrap the local application secrets at unlock. The database/media secrets may then remain only in process memory while the SpendWise session is unlocked.

The existing timeout controls when a backgrounded session becomes stale. When the timeout is reached:

- close protected database handles where practical;
- discard in-memory DB/media secrets;
- revoke/deallocate decrypted preview material;
- close sensitive modals;
- require BiometricPrompt/device credential before reopening protected data.

A shorter user-selected timeout is allowed. The Keystore authorization model must never grant a longer effective app session than SpendWise considers unlocked.

### Web behavior

The web build cannot claim the same Android Keystore guarantee.

If web App Lock remains:
- never persist the raw PIN;
- validate against a versioned Argon2id verifier with a random salt;
- bound KDF parameters and failed-attempt work;
- preserve persistent throttling;
- call the feature a local UI privacy lock, not encrypted vault protection;
- document that browser profile access, same-origin script compromise, developer tools, or localStorage access can bypass its data confidentiality.

A dedicated future web-encryption design would be required to improve those guarantees.

## 3. Key hierarchy

No key is derived from the custom App Lock PIN.

~~~text
Android Keystore
|
+-- SW_LOCAL_KEK_vN
|     non-exportable AES key
|     user-auth-bound when App Lock is enabled
|     wraps local application secrets
|
+-- SW_INSTALL_SIGN_vN
      non-exportable EC P-256 signing key
      not user-auth-bound for every API call
      used only for backend installation authentication

Wrapped application secrets stored in app-private metadata:
  SW_DB_SECRET_vN      random 256-bit SQLCipher secret
  SW_MEDIA_KEY_vN      random 256-bit media AEAD key

Portable backup:
  user passphrase
    -> Argon2id(salt, bounded versioned parameters)
    -> SW_BACKUP_KEY for this backup only
    -> AES-256-GCM Backup v3 envelope
~~~

### 3.1 Android local key-encryption key

Purpose:
- wrap/unwrap DB and media secrets only.

Generation:
- cryptographically random Android Keystore AES-256 key where available;
- generated under a versioned alias such as spendwise.local-kek.v1;
- prefer hardware-backed implementation if present; do not fail otherwise.

Storage:
- key material never stored in JavaScript or persistent app files;
- alias/version metadata may be stored in app-private non-secret metadata.

Use:
- AES-GCM wrapping with fresh random nonce for each wrapped secret;
- authenticated metadata includes secret purpose, secret version, and key alias/version;
- user authentication is required for unwrap when App Lock is enabled.

Rotation:
- create new alias;
- authenticate;
- unwrap old application secrets;
- rewrap under new KEK;
- verify;
- atomically activate new key metadata;
- retain old alias only until verification succeeds, then delete it.

Invalidation:
- if Android reports the key permanently invalid/unavailable, never generate a new key and overwrite the existing wrapped data silently. Enter the explicit recovery state.

### 3.2 Database secret

Purpose:
- SQLCipher only.

Generation:
- random 256-bit secret from platform cryptographic randomness.

Storage:
- wrapped under SW_LOCAL_KEK_vN;
- never placed in localStorage, logs, backups, diagnostics or source code.

Use:
- passed only through the persistence/native adapter to the supported SQLCipher open/migration path;
- React/UI code never receives or formats it.

Rotation:
- a database rekey operation is a separate versioned migration with the same verify-before-delete discipline as initial encryption.

### 3.3 Media key

Purpose:
- persistent attachment encryption only.

Generation:
- independent random 256-bit key.

Storage:
- wrapped under SW_LOCAL_KEK_vN.

Use:
- AES-256-GCM;
- unique random 96-bit nonce per attachment encryption;
- never reuse a nonce with the same key.

Rotation:
- new media key version;
- migrate files one at a time through stage -> verify -> activate -> cleanup;
- DB metadata records the active media key version.

### 3.4 Backup v3 key

Purpose:
- one portable backup only.

Generation:
- derive from the user passphrase with Argon2id and a fresh random salt per backup.

Parameters:
- encoded in a versioned envelope;
- WP30 calibrates parameters on supported Android hardware to meaningful memory-hard cost rather than copying a desktop profile blindly;
- target an interactive delay that remains usable on supported phones;
- enforce both minimum accepted security parameters and maximum memory/time bounds before KDF execution so a malicious header cannot request unbounded work.

Storage:
- passphrase and derived key are never persisted;
- memory lifetime is minimized.

Recovery:
- not wrapped by the device Keystore, because the backup must be portable.
- if the passphrase is lost, SpendWise cannot recover the backup.

### 3.5 Installation identity private key

Purpose:
- prove possession of one registered SpendWise installation identity to the backend.

Generation:
- Android Keystore EC P-256 signing key pair, versioned alias.

Storage:
- private key non-exportable where supported;
- public key registered with backend;
- installation ID is random, non-secret server/app metadata.

Authentication:
- the key does not require an interactive biometric for every signature. AI access remains usable without repeated prompts while still preventing simple copying of a bearer secret between normal app sandboxes.

Rotation/reinstall:
- reinstall creates a new key/installation identity;
- old identity can be revoked or age out;
- installation identity is never exported in Backup v3.

## 4. Credential changes, reinstall and key loss

Android credential/biometric changes can affect auth-bound Keystore keys differently across versions/configurations. SpendWise does not assume survival.

On any key-access failure:
1. distinguish temporary user-not-authenticated/cancel from permanent invalidation;
2. retry through supported authentication only when the key remains valid;
3. if the local KEK is permanently invalid or missing, preserve encrypted files and DB untouched;
4. show an explicit recovery screen;
5. offer restore from a portable backup into a newly initialized secure store only after the user chooses that recovery;
6. never silently replace inaccessible encrypted state with an empty ledger.

Reinstall:
- Android app-private data and SpendWise Keystore identity are not treated as portable;
- recovery is from Backup v3 or supported legacy backups;
- a stale orphaned encrypted DB without its key is unrecoverable locally.

Device lost:
- new device restoration requires a portable backup and its passphrase for v3.

Legacy v2:
- can restore because it is plaintext, but possession of the file itself is sufficient to read it.

## 5. WP29A SQLCipher migration contract

The current @capacitor-community/sqlite documentation supports SQLCipher, encryption of existing databases, encryption configuration, secret storage APIs, and encrypted connection modes. WP29A must prove the exact 8.1.1 Android behavior before production migration.

Important: plugin documentation calling its passphrase store a secure store is not permission to bypass the WP28 key hierarchy. WP29A must verify whether its storage behavior can satisfy or integrate with SecureKeyService. No JS-readable duplicate DB secret may be persisted.

### Migration state machine

~~~text
not_started
  -> staging
  -> copied
  -> verified
  -> activated
  -> cleanup_complete
~~~

A durable migration journal records non-secret state, source/destination identities, schema version, and key version.

### Algorithm

1. Detect source database and current migration state.
2. Validate source open, schema version, foreign keys and basic integrity.
3. Obtain/unlock the DB secret through SecureKeyService.
4. Create a separate encrypted destination through the proven plugin SQLCipher path.
5. Copy every ledger table and app_meta value.
6. Verify:
   - schema version;
   - row counts;
   - primary/foreign-key invariants;
   - ledger currency;
   - representative complete rows, including notes and attachment metadata.
7. Close destination.
8. Reopen it using only the protected DB secret path.
9. Re-run integrity/representative checks.
10. Atomically activate the encrypted destination.
11. Start the application against the activated destination.
12. Only then remove the old plaintext DB.
13. Mark cleanup_complete.

### Crash/failure recovery

Source corrupt:
- stop; preserve source; enter recovery/import state.

Destination write fails:
- discard incomplete destination; keep source authoritative.

App killed during staging/copy:
- on restart, journal selects the still-authoritative source and safely resumes/restarts staging.

App killed after verify but before activation:
- verify again before activation.

Key unavailable:
- do not open/create a replacement ledger; request authentication or enter key-recovery state.

Verification mismatch:
- never activate destination; preserve source.

Cleanup fails after activation:
- encrypted destination remains authoritative; record cleanup_pending and retry removal without reverting to plaintext.

## 6. WP29B encrypted-media format and migration

### Persistent format v1

Conceptual binary layout:

~~~text
magic: SWM1
formatVersion: 1
algorithm: AES-256-GCM
keyVersion
nonce: 12 random bytes
ciphertext
authentication tag
~~~

Non-sensitive header fields required for parsing are authenticated as Additional Authenticated Data. Expense linkage, original filename, user-entered metadata and other sensitive metadata remain inside the encrypted database, not duplicated into plaintext file headers.

### Creation/import

Camera/gallery bytes:
1. acquire;
2. decode/validate as image;
3. normalize/re-encode;
4. encrypt into a staged encrypted file;
5. verify authentication/decryption and expected dimensions/size;
6. commit DB metadata + file ownership;
7. release/delete transient plaintext.

No persistent plaintext file becomes the long-term authoritative attachment.

### Existing plaintext migration

For each attachment:
1. confirm metadata and source file;
2. encrypt to a new staged path;
3. decrypt/authenticate staged ciphertext;
4. verify attachment mapping and image metadata;
5. transactionally switch DB metadata to encrypted format/key version;
6. delete plaintext source;
7. record completion.

Partial migration is resumable. The DB metadata says which representation is authoritative. Never overwrite the only valid plaintext source before the encrypted copy verifies.

### Preview/share

Preview:
- decrypt only on demand;
- prefer memory/blob representation;
- revoke object/data URLs promptly;
- do not persist a decrypted preview unless a platform API requires a temp file.

Share/export:
- if plaintext temp file is required, write only under a dedicated app cache export subtree;
- narrow FileProvider to that subtree rather than the current broad external-path;
- grant read access only to selected recipients;
- remove the temp file immediately after practical share completion and sweep stale export files on next startup.

Corrupted/tampered media:
- authentication failure produces a per-attachment corruption state;
- never display unauthenticated bytes;
- Media Library integrity scan reports the file and offers safe recovery/deletion choices without damaging unrelated attachments.

Delete/Undo:
- pending Undo does not delete ciphertext;
- permanent commit deletes DB ownership and encrypted media using the existing conservative staged-delete invariant.

## 7. Backup v3 contract

### Envelope

Backup v3 is a versioned encrypted envelope, not merely a ZIP with checksums.

Conceptually:

~~~text
magic + format version
KDF: Argon2id
KDF versioned parameters
random salt
cipher: AES-256-GCM
random nonce
authenticated metadata
ciphertext(payload ZIP/container)
authentication tag
~~~

The inner payload contains the logical ledger/settings manifest and optional encrypted-at-envelope photos. Outer metadata required to select KDF/cipher parameters is authenticated as AAD where possible and strictly bounded before use.

### Required behavior

- data-only and data+photos modes;
- fresh salt and nonce every export;
- no passphrase persistence or recovery escrow;
- wrong passphrase fails before any active-ledger mutation;
- tampered header/ciphertext/tag fails before mutation;
- v1 JSON and v2 ZIP remain importable;
- v3 is default export;
- plaintext CSV remains available for interoperability with a clear privacy warning;
- merge retains currency mismatch protection;
- replace uses stage -> commit -> verify -> cleanup with rollback.

### Malicious archive limits

WP30 must enforce tested limits for:
- outer input bytes;
- KDF parameter memory/time bounds;
- entry count;
- per-entry bytes;
- total uncompressed bytes;
- attachment count per expense;
- path syntax/traversal;
- duplicate IDs/paths;
- media format/dimensions;
- recursive/nested archive behavior.

The current v2 512 MiB outer limit and 5 MiB per-media policy are reference points, not permission to allocate those sizes eagerly in RAM. WP30 may lower limits when device testing shows safer bounds.

## 8. Backend authentication contract

### Registration and challenge flow

~~~text
first install
  -> generate SW_INSTALL_SIGN_v1 in Android Keystore
  -> POST registration(publicKey, client metadata)
  -> backend returns random installation ID

authorization
  -> request challenge(installation ID)
  -> backend returns random nonce with 120-second expiry
  -> app signs canonical challenge payload
  -> backend verifies public key + nonce + expiry + single-use status
  -> issue 10-minute scoped access token
  -> AI request with token
  -> renewal requires a new signed challenge
~~~

No long-lived refresh bearer token is required initially.

Challenge records are one-time use and atomically consumed. Signature input includes protocol version, installation ID, nonce, server audience/origin identifier and expiry to prevent cross-context replay.

### Registration limitation

Public-key registration alone cannot tell official SpendWise from a script that generates its own key. Therefore:
- registration is untrusted;
- Play Integrity is not required for sideloaded builds;
- optional attestation may be attached later as a risk signal, not as the only acceptance path.

### Required abuse controls

Server-configured independent controls:
- registration creation: initial target 5 successful registrations/hour/IP and 20/day/IP;
- challenge issuance: per-installation and per-IP throttles;
- AI calls: per-installation quota plus per-IP quota; current 30/min/IP is only an initial benchmark;
- tighter image-route limits than lightweight structured-analysis routes where cost justifies it;
- daily/global Gemini spend guardrail and emergency circuit breaker;
- maximum active/revoked installation records and cleanup policy;
- payload byte limits before expensive parsing/provider calls;
- canonical schema validation;
- nonce replay store;
- access-token revocation through installation revocation;
- operational counters for auth failure, 429, malformed/oversized input and provider cost.

IP rotation and mass synthetic installations can still bypass simple quotas; the global cost guardrail remains mandatory.

### Token properties

- 10 minute TTL;
- audience restricted to SpendWise backend;
- installation ID bound;
- minimum route scope if token format supports scopes;
- signed server-side;
- raw tokens never logged;
- token verification occurs before Gemini work.

The old static VITE token can exist only during a time-bounded migration window and must be removable/revocable after sufficient client upgrade.

## 9. Network-security contract

Production client:
- VITE_API_BASE_URL must parse successfully and use https:;
- production builds reject http:, except isolated development/test configuration outside the production flavor;
- Android network security config explicitly disables cleartext;
- backend origin is centralized and validated;
- no secrets in URL/query parameters;
- requests use bounded timeouts;
- response errors are normalized to safe codes/messages.

Backend:
- TLS terminated only by approved production infrastructure;
- exact origin allowlist for browser/WebView CORS;
- no wildcard production origin;
- route-specific JSON/image limits;
- sanitized errors;
- financial request/response bodies are never written to logs.

### Pinning decision

No certificate or SPKI pinning for the first hardened friend/sideload release.

Reason:
- direct APK distribution makes emergency coordinated pin rotation harder;
- an expired/misconfigured pin can break every installed client until an APK update is manually installed;
- current threat/cost profile is better served by correct platform TLS plus hardened auth.

Revisit only if all exist:
- controlled stable endpoint;
- primary and backup/next pins;
- overlapping rotation procedure;
- certificate/key expiry runbook;
- CI with current+next pin fixtures and negative tests;
- emergency update/recovery path;
- monitoring before old pin removal.

## 10. Sensitive-operation fresh re-auth

Fresh means a new BiometricPrompt/device-credential event, not merely that the app is currently unlocked.

| Operation | Fresh auth? | Reason |
| --- | --- | --- |
| Disable App Lock / weaken security setting | Yes | Prevent holder of an already-open session from removing future protection |
| Replace/destructive restore | Yes | Can replace entire authoritative ledger |
| Clear App Data | Yes | Irreversible local destruction |
| Change Keystore/security configuration | Yes | Changes root-of-trust behavior |
| Export plaintext CSV | Yes | Bulk confidential-data exfiltration into plaintext |
| Export Backup v3 | Yes | Bulk portable copy of ledger/media, even though encrypted afterward |
| Export any legacy plaintext v1/v2 format, if retained | Yes + warning | Direct confidentiality loss |
| View Media Library | No extra prompt | Normal in-app read while session is authorized; avoid pointless friction |
| Preview an attachment | No extra prompt | Same reason; Privacy Shield covers display when applicable |
| Change currency with ledger conversion | No extra prompt | Existing confirmation/transaction safety addresses accidental mutation; not a security-boundary change |
| Add/edit/delete ordinary expense | No | Core app use; App Lock session is sufficient |

Fresh-auth results should have a short in-memory action-specific grace period only if necessary to prevent duplicate prompts within one operation. They must not become a general long unlock bypass.

## 11. Privacy Shield

Native target:
- automatically active whenever App Lock is enabled;
- active during fresh-auth security dialogs, portable export flows that display sensitive metadata/passphrases, and Media Library/attachment fullscreen previews;
- protects Recents/task snapshots and screenshots/screen recording where Android platform controls permit;
- implemented at the native activity/window layer, not as a cosmetic React overlay.

No toggle is added in the first hardened release. This avoids creating a new user-facing security setting during a hardening cycle. Reconsider later only as an explicit product decision.

## 12. Root, debugger and reverse-engineering stance

- Do not block solely on root.
- Do not claim root detection protects encryption keys.
- Debuggable/release configuration is enforced at WP34.
- APK tamper/integrity signals may inform backend quotas or diagnostics but are not relied on to protect local secrets.
- Obfuscation/minification is defense-in-depth only.
- Play Integrity is optional/deferred and must not make legitimate sideloaded builds unusable.

## 13. Logging, diagnostics and crash reporting

### Allowed production diagnostic fields

- app/version/build;
- Android/API version;
- schema version;
- migration state;
- operation name;
- sanitized error code;
- duration;
- retry count;
- backup format version;
- attachment count only when needed;
- pseudonymous installation ID only when justified.

### Forbidden

- expense description;
- amount/budget;
- note;
- category unless a specific diagnostic cannot work without it;
- receipt OCR text;
- image bytes;
- PIN;
- backup passphrase;
- Argon2 output;
- DB/media/KEK material;
- Gemini provider key;
- raw access token/challenge signature;
- raw AI financial request/response body;
- backup contents.

No session replay and no screenshot telemetry for financial screens.

External crash reporting is not part of the first hardened release. WP33 builds local inspectable diagnostics and backend aggregate metrics. A future external crash provider requires an explicit privacy review and opt-in.

## 14. Disaster recovery contract

Keystore local KEK missing/invalid:
- preserve encrypted data;
- report explicit unrecoverable-local-key state;
- restore path is portable backup, not silent reset.

DB/media key unwrap fails temporarily:
- prompt supported device authentication;
- keep current data untouched.

App reinstall:
- generates new local keys and installation identity;
- old local encrypted data is not assumed recoverable;
- portable backup is the recovery mechanism.

Lost device:
- recover to another device from v3 + passphrase, or legacy v1/v2 if available.

Only legacy Backup v2:
- import remains supported but file itself had no confidentiality protection.

Forgotten v3 passphrase:
- no recovery by SpendWise.

No usable backup and lost local key:
- data loss is real and must be stated plainly.

## 15. MASVS traceability matrix

This matrix is a planning/control map, not a compliance certificate.

| Area | Current v1.4 status | Target | Implementation WP | Verification | Residual risk |
| --- | --- | --- | --- | --- | --- |
| MASVS-STORAGE | Gap: plaintext DB/media/PIN; plaintext exports/cache | Encrypted DB/media, no raw PIN, bounded temp plaintext | WP28-30 | WP32 migration/E2E; WP34 APK/filesystem review | Unlocked/rooted process can expose data |
| MASVS-CRYPTO | Partial: TLS/provider crypto, v2 SHA checks; no local at-rest crypto | Keystore-rooted keys, SQLCipher, AES-GCM media/v3, Argon2id backup | WP28-30 | Wrong key/tag/passphrase, nonce/format tests, migration verification | Passphrase strength and platform implementation |
| MASVS-AUTH | Gap: plaintext custom PIN; static backend bearer token | Native device auth + Keystore; per-install signed backend auth | WP28, WP31 | Biometric/device credential flows; replay/expiry/revocation tests | No official-client proof without attestation |
| MASVS-NETWORK | Partial: backend intended HTTPS, CORS, timeouts; no explicit client HTTPS/no-cleartext contract | HTTPS-only, explicit no-cleartext, short-lived auth, bounded routes | WP31 | Network config assertion, http rejection, deployed smoke | Platform CA trust model |
| MASVS-PLATFORM | Partial: allowBackup false, non-exported provider; broad provider paths/no secure window | Narrow URI grants/paths, Privacy Shield, platform-auth integration | WP28-29 | Native screenshot/Recents tests; manifest/provider inspection | OEM/platform capture variation |
| MASVS-CODE | Partial: TypeScript checks, dependency audit, input validation | Strong boundaries, dependency/static/secret scans, release config gates | WP26-27, WP34 | CI, SAST, audit, secret scan, release APK inspection | Third-party supply-chain risk |
| MASVS-RESILIENCE | Limited; no meaningful tamper strategy | Risk-signal posture, release non-debuggable, optional integrity signals | WP31, WP34 | Tampered/debuggable APK checks; documented limitations | Rooted OS remains out of scope |
| MASVS-PRIVACY | Partial: local-first, optional AI, no body logs; screenshots/plain exports leak | Privacy Shield, explicit export warnings, sanitized diagnostics, no replay | WP28, WP30, WP33 | Privacy tests/manual review/diagnostic bundle inspection | User-authorized sharing and AI disclosure |

## 16. WP order validation

The existing order remains correct after WP25 research:

~~~text
WP25
 -> WP26
 -> WP27
 -> WP28
 -> WP29 + WP31 in controlled parallel
 -> WP30
 -> WP32
 -> WP33
 -> WP34
~~~

Why:
- WP26 and WP27 first reduce architectural coupling without changing security behavior.
- WP28 must establish native authentication and SecureKeyService before any encrypted persistent data depends on keys.
- WP29 local encryption and WP31 backend/network work then have separated ownership and can proceed in parallel.
- WP30 depends on the stable local encrypted-data model and should also inherit the final backend/security boundaries.
- WP32 proves migrations and real E2E behavior after security implementation exists.
- WP33 adds diagnostics/performance after major behavior stabilizes.
- WP34 validates the built release.

No roadmap dependency correction is required, so WP25 does not modify PRODUCTION_HARDENING_ROADMAP.md.

## 17. Source guidance used

- OWASP MASVS: https://mas.owasp.org/MASVS/
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Android BiometricPrompt: https://developer.android.com/identity/sign-in/biometric-auth
- Android Network Security Configuration: https://developer.android.com/privacy-and-security/security-config
- Android FLAG_SECURE/screenshot guidance: https://developer.android.com/about/versions/14/features/screenshot-detection
- RFC 9106 Argon2: https://www.rfc-editor.org/info/rfc9106/
- Capacitor Community SQLite encryption: https://github.com/capacitor-community/sqlite/blob/master/docs/DatabaseEncryption.md
- Capacitor Community SQLite API: https://github.com/capacitor-community/sqlite/blob/master/docs/API.md
