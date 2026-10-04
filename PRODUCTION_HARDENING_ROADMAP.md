# SpendWise Production Hardening Roadmap — WP25–WP34

Status: **WP25–WP32 implementation complete; WP32 automated acceptance GREEN. WP33/WP34 not started.**
Historical planning baseline: **SpendWise v1.4.0**
Baseline commit: **c0d7522192af7e07cbb1f46c3a00145e8b94a988**
Current user-approved trial: **v2.0.0, Android build 6**. This supersedes the tentative v1.5 target and the earlier version-freeze rule for local trial distribution. It does not authorize starting WP33/WP34 or publishing a new public release tag.

## Current checkpoint — 2026-10-04

- WP25–WP31 are already merged in main. WP32 and dependency PR #31 are approved for main integration after candidate CI/signing passes.
- WP32 source `253639e561c9ed822ea9ab892b32125d4d81eb4e` passed all **22/22 native flows together** in run `37227530296`, plus **54 web checks**. Android Build `37219280661` passed **226 regression checks**, audits and APK construction.
- Version 2.0.0/code 6 is prepared with the same permanent Android signing identity. The signed artifact records package/version, signature, hash and exact source/run provenance. No new public release/tag is created for the local trial request.
- Manual physical-device/TalkBack coverage, actual process-kill migration proof and final production certification are not claimed by these automated results. WP33 observability and WP34 release certification remain future work.
- See `WP32_ISOLATED_DIAGNOSTIC_REPORT.md`, `WP32_HANDOFF.md` and `RELEASE.md` for evidence and delivery provenance. The original baseline analysis below is historical context, not a description of the current hardened implementation.

## Mission

SpendWise v1.4.0 is already a capable local-first expense tracker with native SQLite persistence, private app-scoped media, Backup v2, App Lock, AI-assisted features, EN/FR/AR support, and a strong automated regression pipeline.

The next roadmap is deliberately not a feature roadmap. Its purpose is to make SpendWise suitable for real users who may trust it with financial data and photos.

The program has five goals:

1. Raise security and privacy from a casual personal-app level to a defensible mobile-app standard.
2. Make destructive failures and migrations recoverable by construction.
3. Split oversized application, Settings, storage, and backend modules into coherent, maintainable boundaries.
4. Replace source-shape confidence with actual rendered, integration, Android, migration, and failure-injection tests.
5. Make production failures diagnosable without collecting financial content.

## Quality targets

The roadmap is complete only when the final independent review can reasonably score every major category at 95 or above.

| Area | v1.4 baseline | Target |
| --- | ---: | ---: |
| Build / release engineering | ~96 | 98+ |
| Persistence / data integrity | ~94 | 97+ |
| Security / resilience | ~80 | 96+ |
| Architecture / maintainability | ~90 | 96+ |
| Real-device / E2E confidence | below target | 95+ |
| Overall production readiness | ~90 | 96+ |

These scores are planning targets, not compliance claims.

## Standards and external references

Security work should be reviewed against the current OWASP Mobile Application Security Verification Standard and companion testing guidance, especially the STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE, and PRIVACY control groups.

Primary references:

- OWASP MASVS: https://mas.owasp.org/MASVS/
- Android biometric/device credential guidance: https://developer.android.com/identity/sign-in/biometric-auth
- Android Keystore guidance: https://developer.android.com/privacy-and-security/keystore
- Capacitor Community SQLite encryption documentation: https://github.com/capacitor-community/sqlite/blob/master/docs/DatabaseEncryption.md

The current SQLite plugin supports SQLCipher on native platforms, including encryption of existing databases, but implementation must still be proven on SpendWise with migration and rollback tests before release.

## Historical v1.4 baseline risks addressed by this roadmap

The following were concrete risks in the original v1.4 baseline. WP28–WP31 implement the authentication, encryption, backup and network changes; WP32 tests the implemented behavior. They are retained here as planning provenance:

- App Lock currently stores the SpendWise PIN in plaintext browser localStorage.
- The native SQLite connection currently opens in no-encryption mode.
- App-scoped receipt/photo files are private by location but are not cryptographically encrypted at rest.
- Backup v2 protects structure and integrity but portable exported archives are not confidential by default.
- VITE_API_ACCESS_TOKEN is client material and therefore extractable from an APK; it cannot be treated as a durable secret.
- App.tsx currently coordinates navigation, persistence refresh, Android lifecycle, lock behavior, undo deletion, AI state, currency changes, theme/language, and modal state in one large module.
- SettingsScreen.tsx combines overview UI, App Lock, media, backup, import, currency conversion, legal, and destructive controls in one large module.
- server.ts combines configuration, schemas, validation, middleware, auth, rate limiting, Gemini execution, routes, logging, and development startup in one large module.
- A meaningful part of the later UX regression suite checks source structure rather than running the rendered app.
- There is no complete black-box Android path proving onboarding -> persistence -> lock -> backup -> wipe -> restore -> restart.
- Production diagnostics are intentionally minimal, which is good for privacy but weak for diagnosing failures once multiple real users exist.

## Program rules

### No feature creep

WP25–WP34 do not add new product features unless the feature is required to protect data, preserve compatibility, diagnose failures, or test the existing product.

Do not add:

- cloud sync;
- user accounts solely for convenience;
- social/community features;
- ads;
- gamification;
- new primary navigation;
- new statistics screens;
- arbitrary AI features;
- visual redesign unrelated to a blocking security/accessibility issue;
- broad framework/dependency upgrades hidden inside a security WP.

### Preserve product behavior

The existing product contract remains:

- four primary destinations;
- Settings as a secondary destination;
- local-first financial ledger;
- manual-first expense capture;
- optional AI;
- Dashboard editing;
- History/Statistics read-only detail;
- grouped Undo deletion;
- EN/FR/AR including RTL;
- private app-scoped media;
- Backup compatibility;
- Android Back semantics;
- 48dp interaction target floor.

### Migrations favor data preservation

For any migration:

1. validate source;
2. create or stage destination;
3. copy;
4. verify counts/integrity;
5. atomically switch active state where practical;
6. only then remove obsolete plaintext or legacy data.

If verification fails, old data remains authoritative.

No migration may destroy the only valid copy before validating the replacement.

### Security primitives

Do not implement custom cryptographic algorithms.

Use platform or established library primitives:

- Android Keystore for protected key material;
- Android BiometricPrompt / device credential for native authentication;
- SQLCipher through the existing SQLite stack for database-at-rest encryption if the WP29 proof succeeds;
- authenticated encryption such as AES-GCM for application-encrypted files;
- a vetted memory-hard password KDF such as Argon2id when a user-entered portable-backup passphrase must derive a key.

### Testing discipline

Every WP must:

- begin from the documented baseline or prior merged WP;
- keep old regression tests green;
- add focused tests for the new behavior;
- build the web app;
- sync Capacitor when native behavior changes;
- build a debug APK when Android/native behavior changes;
- avoid merging on red CI;
- document any intentionally deferred risk.

### Refactor discipline

Refactoring means behavior-preserving extraction, not redesign.

Do not split files only to satisfy a line-count target. A new module must have a coherent responsibility and a stable interface.

A large file can remain large if splitting would make ownership worse. Conversely, a 200-line file that mixes unrelated responsibilities should still be split.

---

# Target architecture

The exact names may change during implementation, but this is the desired direction.

~~~text
src/
  app/
    AppShell.tsx
    navigation/
    lifecycle/
    providers/
    hooks/

  features/
    expenses/
    history/
    statistics/
    settings/
      overview/
      app-lock/
      storage-media/
      backup/
      legal/
    ai/

  data/
    repositories/
    migrations/
    secure-storage/

  services/
    ledger/
    backup/
    media/
    currency/
    security/

server/
  app.ts
  config.ts
  middleware/
  routes/
  services/
  validation/
  security/
  logging/
~~~

The existing public interfaces may temporarily remain as facades while code migrates behind them.

---

# Dependency graph

Preferred execution:

~~~text
WP25  Security architecture + threat model
  |
WP26  Application-shell refactor
  |
WP27  Settings/data/server boundary refactor
  |
WP28  Secure local authentication + key-management foundation
  |
  +-------------------+
  |                   |
WP29                 WP31
Data/media           Backend/network
encryption           hardening
  |                   |
  +---------+---------+
            |
          WP30
     Secure Backup v3
            |
          WP32
   Integration + Android E2E
            |
          WP33
 Observability + performance
            |
          WP34
 Final production/security gate
~~~

Only WP29 and WP31 are intentionally parallelizable by default. Everything else should be serial unless a later review proves file ownership is isolated.

---

# WP25 — Security Architecture, Threat Model, and Hardening Contract

## Dependency

Start from v1.4.0 main at or descended from:

c0d7522192af7e07cbb1f46c3a00145e8b94a988

## Goal

Create the authoritative security and architecture contract before changing security-sensitive code.

This WP is documentation and test-planning only. It must not migrate data, replace App Lock, encrypt files, or change API authentication.

## Required deliverables

Create:

- SECURITY_ARCHITECTURE.md
- THREAT_MODEL.md
- ARCHITECTURE.md
- a concise hardening section in the existing roadmap or README only if needed for discoverability.

## Threat inventory

Explicitly classify at minimum:

- expenses;
- notes;
- categories and timestamps;
- budgets;
- receipt/purchase photos;
- App Lock material;
- database keys;
- media keys;
- backup passphrases/derived keys;
- exported Backup v1/v2/v3 files;
- CSV exports;
- AI request payloads;
- AI responses/cache;
- backend API credentials/tokens;
- release signing material;
- diagnostic/crash information.

## Attacker models

Document expected protection and limitations for:

1. lost/stolen locked phone;
2. lost/stolen unlocked phone;
3. malicious normal Android app;
4. device with developer access / adb backup-like access where applicable;
5. rooted/compromised device;
6. APK reverse engineering;
7. copied exported backup;
8. malicious backup import;
9. intercepted/tampered network traffic;
10. leaked client token;
11. abusive AI client attempting to consume backend quota;
12. corrupted or partially written database;
13. app kill during migration;
14. app kill during restore;
15. app kill during delete Undo window;
16. compromised diagnostic/crash output.

## Locked security decisions to make

WP25 must resolve and document:

- Native Android authentication becomes preferred over plaintext app PIN storage.
- Whether a custom SpendWise PIN remains as an optional fallback or is retired on native Android.
- How web builds behave when secure native storage is unavailable.
- Key hierarchy for database and media encryption.
- Key-loss behavior.
- Device credential/biometric timeout semantics.
- Whether sensitive operations require fresh re-authentication.
- Which exports are allowed to remain intentionally plaintext.
- Backup v3 portability and recovery model.
- Backend trust model without user accounts.
- Whether Play Integrity is optional, required only for Play-distributed builds, or deferred.
- Certificate/public-key pinning strategy and rotation requirements.
- Root/tamper detection stance: informational/risk signal versus blocking behavior.
- Logging redaction policy.
- crash/telemetry consent policy.

## Required honesty

The architecture must explicitly state that:

- no app can provide strong confidentiality on a fully compromised/rooted device;
- an APK-embedded value is not a secret;
- device public-key registration without attestation prevents token copying but does not by itself prove an official client;
- local encryption does not replace backups;
- encrypted backups are unrecoverable if the user loses the passphrase unless a recovery mechanism is deliberately designed.

## Testing plan

Map each relevant security decision to one or more automated/manual tests.

Create a traceability matrix:

Control / threat -> implementation WP -> verification test -> release gate.

## Acceptance

- Current sensitive-data flows are diagrammed.
- Trust boundaries are explicit.
- Key lifecycle is explicit.
- Backup confidentiality model is explicit.
- Backend abuse model is explicit.
- Every WP26–WP34 security item traces to a documented threat or maintainability goal.
- No code behavior changes.
- Existing CI stays green.

## Branch

wp25/security-architecture

---

# WP26 — Application Shell and State-Orchestration Refactor

## Dependency

WP25 merged.

## Goal

Reduce App.tsx from a multi-responsibility controller into a composition shell without changing user-visible behavior.

## Current responsibilities to separate

Extract coherent ownership for:

- primary/settings navigation;
- Android Back routing;
- native foreground/background lifecycle;
- App Lock lifecycle state;
- theme application;
- language/RTL application;
- expense ledger refresh/mutations;
- grouped delete/Undo lifecycle;
- AI analysis request/cache lifecycle;
- current-month derived data;
- modal/dialog orchestration.

## Recommended shape

Possible modules:

- src/app/AppShell.tsx
- src/app/hooks/useAppNavigation.ts
- src/app/hooks/useAppLifecycle.ts
- src/app/hooks/useAppLockLifecycle.ts
- src/app/hooks/useExpenseLedger.ts
- src/app/hooks/useExpenseDeleteUndo.ts
- src/app/hooks/useAiAnalysis.ts
- src/app/hooks/useThemeLanguage.ts
- src/app/selectors/monthlyLedger.ts

Names are not mandatory; coherent boundaries are.

## State rules

- Do not introduce a heavy global state library unless the existing React model demonstrably fails.
- Prefer feature hooks/services with explicit inputs/outputs.
- Do not create hidden mutable singletons to make the file shorter.
- Keep persistence writes in domain/data services, not presentation components.
- Derived monthly totals/categories/top expenses should be pure/testable functions where practical.

## Tests

Add behavior tests for extracted controllers/hooks:

- navigation return from Settings;
- Android Back ordering;
- background/foreground App Lock timing;
- pending delete restoration on background;
- expense add/update refresh;
- currency change invalidation;
- AI stale-request cancellation;
- theme and RTL application.

Existing WP20–WP24 tests remain green.

## Acceptance

- App.tsx/AppShell reads as composition, not as the implementation of every domain.
- No product behavior changes.
- No persistence format changes.
- No security storage changes yet.
- Android Back behavior remains identical.
- Current v1.4 manual smoke path still works.
- CI green and debug APK builds.

## Do not touch

- database encryption;
- backup format;
- backend authentication;
- media encryption;
- visual redesign.

## Branch

wp26/app-shell-refactor

---

# WP27 — Settings, Data-Service, and Backend Boundary Refactor

## Dependency

WP26 merged.

## Goal

Create clean ownership boundaries before security migrations touch storage, Settings, backup, and backend code.

## Part A — Settings

Split SettingsScreen responsibilities into coherent feature components/controllers.

Target domains:

- overview;
- appearance;
- language;
- currency;
- App Lock;
- Storage & Media;
- Backup & Restore;
- legal;
- setup replay;
- destructive data controls.

Recommended direction:

~~~text
src/features/settings/
  SettingsScreen.tsx
  SettingsOverview.tsx
  appearance/
  language/
  currency/
  app-lock/
  storage-media/
  backup/
  legal/
~~~

Move backup/import orchestration into a focused hook/service rather than leaving file parsing, restore state, media refresh, currency mismatch handling, and UI state in one screen.

## Part B — Data/service boundaries

Create interfaces or focused modules around:

- ExpenseRepository;
- BudgetRepository;
- PreferencesRepository;
- MediaRepository;
- LedgerService;
- BackupService;
- SecurityPreferences / SecureKeyService placeholders.

StorageManager may remain temporarily as a compatibility facade so the refactor can be incremental.

Do not create unnecessary repository abstraction for values that are simple UI preferences unless it improves security/testing boundaries.

## Part C — Backend

Split server.ts by responsibility:

- server/app.ts — Express composition;
- server/config.ts — validated environment configuration;
- server/middleware/auth.ts;
- server/middleware/rateLimit.ts;
- server/middleware/cors.ts;
- server/middleware/errors.ts;
- server/routes/health.ts;
- server/routes/analysis.ts;
- server/routes/trends.ts;
- server/routes/smartCapture.ts;
- server/routes/receiptScan.ts;
- server/services/geminiClient.ts;
- server/validation/*;
- server/logging/*.

Existing server/geminiReliability.ts behavior should be preserved unless extraction reveals a tested bug.

## Configuration rules

- Fail fast on invalid production configuration.
- Development defaults must never silently become production security defaults.
- Keep environment parsing centralized.
- Never log secret values.

## Tests

- Settings overview/subpage behavior;
- import/restore controller tests;
- repository/service contract tests;
- backend route tests separated from Gemini execution;
- auth/rate-limit middleware unit tests;
- config validation tests.

## Acceptance

- Settings UI no longer owns unrelated backup/media/security business logic directly.
- server entry point becomes composition rather than a 1000+ line implementation.
- storage writes are reachable through explicit domain boundaries.
- no behavior, data format, security credential, or backup format change.
- full old suite green.
- debug APK and backend smoke test green.

## Branch

wp27/architecture-boundaries

---

# WP28 — Secure Local Authentication and Key-Management Foundation

## Dependency

WP27 merged.

## Goal

Eliminate plaintext App Lock credential storage and introduce the trusted native key-management foundation used by later encryption WPs.

## Native Android authentication

Preferred path:

- Android BiometricPrompt;
- allow BIOMETRIC_STRONG and DEVICE_CREDENTIAL where platform support permits;
- use Android Keystore keys with user-authentication requirements for sensitive key operations where appropriate.

The app should prefer the device's secure credential instead of inventing a weaker password vault.

## Custom SpendWise PIN

If WP25 keeps a custom PIN:

- never store the PIN itself;
- never use unsalted SHA-* as a password verifier;
- use a vetted memory-hard KDF such as Argon2id with a unique random salt and versioned parameters;
- persist only the verifier/KDF metadata required to validate;
- throttle failed attempts persistently;
- clear legacy plaintext PIN after successful migration;
- migration must not lock a valid user out if secure credential creation fails.

If native Android retires the custom PIN, preserve an intentional web fallback rather than silently weakening Android security for cross-platform symmetry.

## Key service

Introduce a native security abstraction responsible for:

- generating cryptographically random app key material;
- creating/retrieving Android Keystore aliases;
- wrapping/unwrapping application secrets;
- determining whether user authentication is required;
- rotating/versioning key aliases;
- reporting unrecoverable key loss safely.

No encryption WP should access Keystore details directly outside this service.

## Sensitive-operation re-authentication

WP25 should define which actions require a fresh unlock. Candidates:

- disabling App Lock/encryption protections;
- destructive replace restore;
- Clear App Data;
- revealing/exporting a plaintext CSV;
- changing security configuration.

Do not add re-authentication friction to normal expense entry without a documented threat justification.

## Privacy Shield

Add an optional Privacy Shield and decide the default in WP25.

When enabled on Android:

- prevent app content from appearing in screenshots/screen recordings where platform controls permit;
- protect the Recents/task snapshot;
- ensure dialogs/attachment previews inherit protection.

Recommended default: enable alongside App Lock, with an explicit user-facing explanation if there is a toggle.

## Legacy migration

Test upgrade from a v1.4 installation containing:

- enabled App Lock + valid PIN;
- disabled App Lock + old PIN residue;
- malformed legacy PIN;
- no PIN.

After successful migration, no plaintext SpendWise PIN remains in localStorage.

## Tests

- no plaintext PIN at rest;
- legacy PIN migration;
- failed secure-storage migration rollback;
- biometric/device credential success/cancel/error;
- lock timeout behavior;
- failed-attempt throttling;
- process restart with lock enabled;
- key alias migration/version handling;
- privacy-screen behavior at native layer.

## Acceptance

- plaintext PIN storage is gone on native Android;
- secure key abstraction exists and is versioned;
- lock UX still works after upgrade;
- app cannot silently disable lock because native key access fails;
- no financial data migration yet;
- full CI + native debug build green.

## Branch

wp28/secure-auth-keystore

---

# WP29 — Encrypted Data at Rest

WP29 contains two explicit internal phases. Merge only when both are complete unless the implementation owner deliberately creates WP29A/WP29B branches.

## Dependency

WP28 merged.

## WP29A — SQLCipher financial database

### Goal

Encrypt the native financial database at rest while preserving all v1.4 data.

### Required implementation

- enable native SQLite encryption support;
- generate a strong random database secret;
- protect/wrap that secret through the WP28 secure key service;
- open the production native database using the encrypted mode supported by the existing plugin;
- version encryption/migration metadata;
- do not derive the database key directly from a short App Lock PIN.

### Migration

Upgrade algorithm must be transactional/recoverable:

1. detect valid plaintext database;
2. verify schema/integrity;
3. create/stage encrypted destination;
4. copy all financial and attachment metadata;
5. verify schema version, row counts, key invariants, and representative reads;
6. close/reopen encrypted destination;
7. mark migration complete;
8. remove plaintext only after verification.

If any step fails, the plaintext database remains recoverable and the app must present an actionable failure instead of resetting data.

### Tests

- clean install creates encrypted database;
- v1.4 plaintext DB migrates;
- migration interrupted before copy completion;
- migration interrupted after copy but before activation;
- wrong/missing key;
- corrupted source DB;
- corrupted encrypted destination;
- repeated startup after successful migration is idempotent;
- legacy localStorage recovery behavior remains safe;
- backup restore into encrypted DB works.

## WP29B — Encrypted private media

### Goal

Encrypt receipts/purchase photos stored in app-scoped files.

### File format

Use authenticated encryption with versioned metadata.

At minimum record:

- format version;
- algorithm identifier;
- random nonce/IV;
- ciphertext;
- authentication tag as provided by the primitive;
- non-sensitive identifier/metadata needed for lookup.

Use unique nonces and never reuse an AES-GCM nonce with the same key.

### Key management

Use a versioned media key protected by the secure key service.

Do not use filenames, expense IDs, PINs, or predictable values as keys.

### Media migration

- inventory current attachment metadata/files;
- encrypt to staged files;
- verify decryptability and attachment mapping;
- switch metadata;
- delete plaintext source only after validation.

Interrupted migration must resume or roll back safely.

### Operational requirements

- camera/gallery import encrypts before persistent storage is considered committed;
- preview creates only bounded temporary plaintext in memory/cache where necessary;
- temp plaintext is deleted promptly;
- delete/Undo semantics still preserve media correctly;
- media integrity scan understands encrypted files.

### Tests

- 1–8 photos per expense;
- large image;
- wrong key;
- tampered ciphertext/tag;
- interrupted migration;
- delete/Undo;
- Backup restore;
- Media Library/repair;
- no plaintext JPEG/PNG payload remains in long-term app storage after successful migration.

## Acceptance

- native financial database is encrypted at rest;
- private media is encrypted at rest;
- upgrade preserves all valid v1.4 ledger/media data;
- a filesystem search of persistent app data does not reveal expense notes/descriptions or intact private images in plaintext;
- rollback paths are tested;
- CI and APK build green.

## Branch

wp29/encrypted-local-data

---

# WP30 — Secure Backup v3 and Export Safety

## Dependency

WP29 and WP31 merged, unless the owner proves WP30 is isolated from an unfinished WP31.

## Goal

Make portable financial backups confidential as well as integrity-checked.

## Compatibility

- Backup v1 JSON import remains supported.
- Backup v2 ZIP import remains supported.
- New default secure export becomes Backup v3.
- Do not silently rewrite a user's old backup file.
- v1/v2 exports may be retired or moved behind an explicit legacy option after compatibility review.

## Backup v3 requirements

The archive/envelope must be versioned and self-describing.

Conceptual structure:

~~~text
format version
KDF algorithm + parameters
random salt
cipher algorithm
random nonce
encrypted authenticated payload
~~~

For portable passphrase backups:

- derive key with a vetted memory-hard KDF such as Argon2id;
- random salt per backup;
- use authenticated encryption such as AES-256-GCM;
- authenticate metadata that must not be altered;
- do not persist the passphrase;
- do not log passphrase/KDF output;
- zero/limit sensitive buffers where realistically possible in the JS/native environment.

## User experience

The app must clearly explain:

- secure backup requires the passphrase to restore on another device;
- SpendWise cannot recover a forgotten backup passphrase unless a recovery design is explicitly added later;
- CSV is intentionally unencrypted;
- exported plaintext CSV may expose financial information to Downloads, cloud backup, messaging apps, or other recipients.

## Full backup

Encrypted Backup v3 must support:

- data-only;
- data + photos;
- integrity validation before mutation;
- merge where semantically safe;
- replace with rollback;
- currency mismatch protection;
- existing media limits/validation;
- wrong-passphrase detection without modifying current data;
- tamper detection without modifying current data.

## Backup bomb / malicious archive defenses

Retain and strengthen:

- maximum archive size;
- maximum file count;
- maximum uncompressed size;
- path traversal rejection;
- manifest/schema validation;
- attachment count limits;
- duplicate ID/path validation;
- checksums/authentication;
- safe handling of malformed ZIP/envelope content.

## Tests

- secure backup round-trip on same device;
- restore on fresh install;
- wrong passphrase;
- tampered header/ciphertext;
- truncated file;
- old v1 import;
- old v2 data-only import;
- old v2 full import;
- v3 data-only;
- v3 data+photos;
- merge;
- replace;
- forced write failure rollback;
- currency mismatch;
- huge/malicious archive rejection;
- no backup passphrase in logs/storage.

## Acceptance

- default portable backup protects confidentiality and integrity;
- old backups still restore;
- wrong/tampered backup cannot mutate the ledger;
- plaintext CSV has an explicit warning;
- full automated compatibility matrix exists.

## Branch

wp30/secure-backup-v3

---

# WP31 — Backend Authentication, Abuse Resistance, and Network Hardening

## Dependency

WP28 merged. May run in parallel with WP29 because ownership should now be separate.

## Goal

Stop treating an APK-embedded static token as a durable secret and harden the AI backend for real-user distribution.

## Trust model

The backend must explicitly distinguish:

- server secret;
- installation identity;
- short-lived session/access token;
- anonymous/untrusted registration;
- optional attestation signal.

No APK value is considered secret.

## Installation identity

Preferred architecture:

1. app generates a per-install asymmetric key pair;
2. private key stays in Android Keystore where possible;
3. backend stores public key + random installation identifier;
4. server issues a challenge/nonce;
5. client signs it;
6. server verifies signature;
7. server issues a short-lived token;
8. expired token is renewed through a signed challenge.

This prevents simple copying of a reusable bearer secret between devices.

It does not prove the client is official by itself.

## Registration abuse

Because SpendWise does not currently require user accounts, registration itself is an abuse surface.

Mitigate with:

- strict IP and installation quotas;
- bounded registration frequency;
- backend cost caps;
- per-route request limits;
- body/image size limits;
- replay-resistant challenges;
- token expiry;
- revocation/deny-list support;
- operational alerts for unusual spend/error bursts.

If distributed through Google Play later, Play Integrity may become an additional attestation/risk signal. Direct APK builds must not falsely claim equivalent attestation.

## Remove static access-token dependency

Migrate away from relying on VITE_API_ACCESS_TOKEN as production authentication.

A temporary compatibility period is acceptable only if:

- it is explicitly time-bounded;
- both paths are tested;
- old token can be revoked after enough users upgrade;
- no new long-term design depends on it.

## Network hardening

- HTTPS-only production API URL;
- Android cleartext traffic explicitly disabled for production;
- strict origin allowlist where CORS applies;
- no wildcard production origins with credentials;
- security headers where relevant;
- bounded JSON/image payloads;
- consistent timeout behavior;
- sanitized errors;
- no financial payload logging.

## Certificate/public-key pinning

Do not blindly add pinning.

If adopted:

- pin only endpoints under SpendWise control;
- include a backup/next key pin;
- document certificate/key rotation;
- test expiry/rotation/failure behavior;
- provide a recovery path that does not require shipping an emergency insecure build.

If safe rotation cannot be guaranteed, rely on correct TLS/platform trust and document the residual risk rather than implementing brittle pinning.

## Backend structure

WP27 boundaries should allow:

- auth middleware testing without Gemini;
- rate-limit testing without Gemini;
- request validation testing without Gemini;
- Gemini service mocks;
- health endpoints that do not leak secrets.

## Tests

- unknown installation;
- valid signed challenge;
- replayed challenge;
- expired challenge;
- invalid signature;
- expired access token;
- revoked installation;
- per-install quota;
- IP quota;
- malformed/oversized request;
- AI endpoint without auth;
- static legacy token deprecation path;
- no secret values in logs;
- deployed smoke test using the new auth path.

## Acceptance

- production AI no longer depends on an extractable permanent APK bearer secret;
- server costs have layered abuse controls;
- TLS/cleartext policy is explicit;
- backend logs do not include financial request bodies;
- deployed smoke test proves the production auth flow.

## Branch

wp31/backend-security

---

# WP32 — Real Integration, Migration, Failure-Injection, and Android E2E Testing

## Dependency

WP29–WP31 merged.

## Goal

Make the release gate prove behavior rather than mostly proving source shape.

Existing structural tests remain useful as invariant tests. They are not removed simply because E2E tests are added.

## Layer 1 — Pure/unit tests

Continue fast tests for:

- statistics;
- ranking;
- date/currency math;
- backup validation;
- migration planning;
- crypto envelope parsing;
- rate limiting;
- request validation.

## Layer 2 — Rendered component tests

Add a modern React rendered-testing layer for critical UI behavior.

Cover:

- Settings disclosure;
- lock states;
- backup error states;
- History Undo snackbar;
- dialogs;
- accessibility labels;
- RTL direction;
- keyboard interaction where practical.

## Layer 3 — Web integration

Use a browser runner for:

- onboarding;
- expense CRUD;
- History detail/delete/Undo;
- Settings navigation;
- backup import/export logic using browser storage adapter;
- EN/FR/AR major routes;
- Light/Dark/System rendering sanity.

## Layer 4 — Android black-box E2E

Adopt one maintained approach, such as Maestro or native Android instrumentation, after a small proof-of-concept.

Required Android flows:

### Fresh install

fresh install
-> first-run setup
-> add budget
-> add expense
-> restart
-> verify persistence.

### Media

add expense
-> camera/gallery
-> 1 photo
-> 8 photos
-> restart
-> previews still work.

### Delete safety

delete
-> Undo

and:

delete
-> background app
-> return
-> verify conservative restoration.

### Lock

enable native lock
-> background past timeout
-> unlock with supported device credential
-> cancel unlock
-> retry.

### Backup disaster recovery

create secure full backup
-> clear app data through supported app flow
-> restore
-> compare ledger/budget/media state
-> restart
-> compare again.

### Upgrade migration

install v1.4 fixture build/data
-> create representative ledger/media/PIN
-> update to hardened build
-> verify secure migration
-> restart
-> verify again.

### Failure injection

Where possible in integration harness:

- kill during DB migration;
- kill during media migration;
- fail backup restore write;
- corrupt encrypted file;
- lose/deny key access;
- lose network during AI request.

## Visual regression matrix

At minimum major screens should be captured or programmatically checked across:

- 320px;
- 360px;
- 390px;
- 412px+;
- Light;
- Dark;
- EN;
- FR;
- AR/RTL.

Do not create hundreds of brittle pixel-perfect snapshots. Focus visual regression on layout invariants and representative screens.

## Accessibility

Add automated checks where supported plus manual Android TalkBack smoke coverage for:

- navigation;
- Settings;
- Add Expense;
- History delete alternative;
- modal focus;
- Backup security warnings;
- lock screen.

## Acceptance

- critical flows run against the actual application, not only source files;
- at least one CI Android/emulator lane exists;
- secure migration from v1.4 is repeatedly testable;
- backup disaster recovery is automated;
- source-shape tests are no longer the primary proof of UX correctness.

## Branch

wp32/e2e-hardening

---

# WP33 — Privacy-Safe Observability, Diagnostics, and Performance Budgets

## Dependency

WP32 merged.

## Goal

Make failures diagnosable for real users without turning SpendWise into a financial telemetry collector.

## Logging policy

Production logs may contain:

- app version;
- schema/migration version;
- Android/API version;
- coarse device capability class;
- operation name;
- duration;
- non-sensitive error code;
- anonymized installation/session identifier where justified;
- retry count;
- backup format version;
- attachment count only when needed to diagnose a failure.

Production logs must not contain:

- expense descriptions;
- notes;
- amounts;
- budgets;
- categories if avoidable;
- receipt text;
- photos;
- backup contents;
- PINs;
- backup passphrases;
- encryption keys;
- Gemini keys;
- raw auth tokens;
- raw AI request payloads.

## Local diagnostics

Provide an internal/exportable diagnostics bundle designed for support.

It should contain technical metadata and recent sanitized error codes, not financial data.

The user should be able to inspect/approve what is shared.

## Crash reporting

If an external crash reporting provider is introduced:

- decide consent/disclosure in WP25;
- enable aggressive data scrubbing;
- disable screenshots/session replay;
- block custom financial fields;
- verify SDK data collection behavior;
- document retention and deletion;
- allow disabling it if practical.

A vendor is not mandatory. Local diagnostics plus backend metrics may be enough for the initial friend-scale release.

## Backend metrics

Track operational aggregates:

- request count;
- success/error classes;
- 429 rate;
- authentication failures;
- latency percentiles;
- Gemini model/fallback usage;
- AI backend spend/cost guardrail;
- oversized/malformed request count.

Never store financial payload content for analytics.

## Performance budgets

Create reproducible benchmarks for representative ledgers:

- empty;
- 100 expenses;
- 1,000;
- 10,000;
- a stress size above expected normal use.

Measure:

- startup/read;
- History search/filter;
- Statistics calculation;
- category expansion;
- backup creation;
- backup validation;
- restore;
- media library scan.

Define budgets based on measured v1.4/hardened behavior instead of inventing arbitrary milliseconds before measurement.

## Regression policy

CI should fail or warn on material regressions depending on benchmark stability.

Security operations may intentionally add cost; the target is bounded, understood overhead, not zero overhead.

## Acceptance

- a friend can send a useful diagnostic package without exposing ledger contents;
- backend health/cost anomalies are visible;
- performance regressions have a measurable baseline;
- telemetry/crash handling matches the privacy-first product claim.

## Branch

wp33/observability-performance

---

# WP34 — Production Security Gate, Release Engineering, and Final v1.5 Candidate

## Dependency

WP25–WP33 merged.

## Goal

Prove the hardened application is shippable and make the release pipeline enforce that proof.

No feature work belongs in WP34.

## Repository/release controls

Where GitHub capabilities permit:

- protect main;
- require pull requests;
- require green CI checks;
- prevent accidental force pushes;
- require review or explicit release-gate approval where practical;
- enable dependency/security alerts;
- enable code scanning/static analysis;
- add secret scanning/push protection where available.

## CI additions

Gate on:

- TypeScript build;
- all legacy tests;
- all WP25–WP33 tests;
- dependency audit;
- static security scan;
- secret scan;
- Android sync;
- Android unit/instrumentation/E2E lane;
- debug APK;
- signed release APK on release/tag;
- deployed backend smoke;
- secure auth smoke;
- Backup v1/v2/v3 compatibility;
- v1.4 -> hardened migration;
- encrypted DB/media assertions;
- APK release configuration assertions.

## Release artifact checks

Assert:

- release APK is non-debuggable;
- WebView debugging is not unintentionally enabled in release;
- cleartext traffic is disabled;
- correct package/application ID;
- correct launcher identity;
- correct versionName/versionCode;
- release signing certificate matches expected identity;
- APK SHA-256 is published;
- generated SBOM is archived/published with the release where appropriate;
- no test credentials or debug endpoints are packaged.

## Reproducibility and provenance

Improve build provenance where practical:

- pin action versions;
- use lockfile install;
- record Node/JDK/Gradle versions;
- archive checksums;
- generate SBOM;
- document whether builds are fully reproducible and any blockers.

Do not claim reproducible builds unless verified.

## Security review

Perform a final MASVS-style review against the built APK.

At minimum review:

- STORAGE;
- CRYPTO;
- AUTH;
- NETWORK;
- PLATFORM;
- CODE;
- RESILIENCE;
- PRIVACY.

Document:

- passed controls;
- not-applicable controls;
- residual risks;
- consciously deferred hardening.

## Manual release matrix

Before tagging:

- clean install;
- update from v1.4.0 with real representative data;
- English/French/Arabic;
- Light/Dark/System;
- narrow portrait;
- landscape;
- one larger/tablet sanity pass;
- App Lock;
- privacy shield;
- expense CRUD;
- grouped Undo;
- photos;
- Media Library;
- Backup v3 data/full;
- v1/v2 import;
- restore merge/replace;
- offline AI fallback;
- backend auth;
- Android Back;
- process restart;
- device reboot.

## Versioning

Only after every gate is green:

- choose/finalize versionName, tentatively 1.5.0;
- increment versionCode;
- update release docs;
- create signed tag;
- build signed APK;
- verify update over installed v1.4.0 without clearing data;
- publish release notes including migration/security changes and any user-visible backup/auth changes.

## Acceptance

The final release candidate should support a defensible 95+ score in every major review category.

Any category below 95 must result in one of:

- a fix before release; or
- an explicitly documented residual risk with a concrete follow-up and a reason the release remains acceptable.

## Branch

wp34/production-release-gate

---

# Work-package ownership and collision rules

## WP25

Owns documentation only.

## WP26

Owns App/application state orchestration. Avoid storage format/server security changes.

## WP27

Owns Settings decomposition, repository/service boundaries, and backend file decomposition. Avoid security behavior changes.

## WP28

Owns native authentication, secure key abstraction, legacy PIN migration, and privacy shield.

## WP29

Owns database/media encryption and migration.

## WP30

Owns backup format v3, backup encryption, passphrase UX, and compatibility.

## WP31

Owns backend authentication, installation identity, quotas, and network security.

## WP32

Owns testing infrastructure and black-box workflows. Production behavior may change only to add safe test seams, not test-only bypasses.

## WP33

Owns diagnostics, privacy-safe logging, metrics, and performance benchmarks.

## WP34

Owns release gate, CI/security scanning, final version/release changes.

Shared files such as package.json, package-lock.json, Android manifest/config, central app entry points, version.json, RELEASE.md, and workflows require extra merge review.

---

# Merge strategy

## Serial foundation

Merge in order:

1. WP25
2. WP26
3. WP27
4. WP28

Each becomes the baseline for the next.

## Controlled parallel wave

After WP28:

- WP29 may run on encrypted local-data/storage ownership.
- WP31 may run on backend/network ownership.

They may run in parallel because WP27 must have separated those domains first.

Merge one, update/rebase the other, rerun its full gate, then merge the second.

## Final serial wave

Then:

1. WP30
2. WP32
3. WP33
4. WP34

Do not start WP34 early.

---

# Definition of done for every implementation WP

An implementation WP is not done merely because code compiles.

It must provide:

1. a clear before/after contract;
2. focused automated tests;
3. legacy regression suite green;
4. migration/rollback tests when persistent data changes;
5. error-path tests;
6. no known unreviewed plaintext secret/data exposure introduced;
7. no unrelated redesign;
8. updated documentation for changed architecture;
9. CI evidence;
10. commit/PR summary with residual risks.

---

# Security invariants after the roadmap

The final application should maintain these invariants:

- no plaintext SpendWise PIN in persistent storage;
- no durable private encryption key stored outside protected platform key storage on native Android;
- native financial DB encrypted at rest;
- long-term private attachment files encrypted at rest;
- portable default backups encrypted and authenticated;
- legacy backups remain import-compatible;
- plaintext CSV is explicit and warned;
- Gemini provider secret stays server-only;
- no permanent backend bearer secret is treated as safe merely because it is embedded in the APK;
- network production path is HTTPS-only;
- no financial payloads in production logs;
- restore/migration cannot destroy the only valid copy before validating the replacement;
- security failures fail closed where data confidentiality requires it and fail data-preserving where destructive mutation is involved;
- release build is not debuggable;
- Android Back, localization, accessibility, and existing product behavior remain functional.

---

# Architecture invariants after the roadmap

- App shell composes features rather than owning every feature implementation.
- Settings presentation does not contain the entire backup/security/media subsystem.
- persistence is accessed through explicit domain boundaries;
- crypto/key access is centralized;
- backend routes are separate from auth/rate-limit/Gemini implementation;
- business calculations remain pure/testable where practical;
- no new god module simply replaces the old one;
- modules are split by responsibility rather than arbitrary file length.

---

# Explicit residual-risk policy

Even after WP34, do not claim:

- protection against a fully compromised/rooted OS;
- impossible reverse engineering;
- perfect bot resistance for anonymously registered direct-APK clients;
- recoverability of forgotten encrypted-backup passphrases without an explicit recovery design;
- formal regulatory/security certification unless an actual certification process is completed.

The goal is strong, transparent engineering, not fake security marketing.

---

# First implementation step

Start with **WP25 only**.

Do not begin refactoring or encryption in the same chat/branch.

WP25 creates the documents and locked decisions that every later implementation must follow.
