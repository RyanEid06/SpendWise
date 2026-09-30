# SpendWise Target Architecture — WP25

Status: authoritative responsibility/dependency model for WP26-WP34  
Reviewed baseline: 0a60702eed64e6558e80330c9c2c15905d3e313e  
Product behavior: preserve the frozen v1.4 product shape unless a later hardening WP explicitly owns a security UX change.

## 1. Purpose

SpendWise v1.4 works, but several files currently own too many unrelated concerns. Security work must not be layered onto those hotspots directly or future changes will become fragile and difficult to audit.

The target architecture is based on responsibility and dependency direction, not arbitrary file-size limits.

Primary rule:

~~~text
UI
 -> feature controllers/hooks
 -> domain/application services
 -> repository/service interfaces
 -> platform/infrastructure adapters
~~~

Dependencies point inward toward stable business contracts. React presentation must not know SQLite/SQLCipher details. Backup screens must not implement cryptographic primitives. Backend routes must not independently reimplement authentication, rate limiting, validation, Gemini execution and logging.

## 2. Current concentration risks

### App.tsx

Current responsibilities include:
- primary navigation and Settings return behavior;
- Android Back handling;
- foreground/background lifecycle;
- App Lock state and timeout;
- theme and RTL application;
- expense refresh/mutations;
- pending delete/Undo coordination;
- currency mutation;
- AI request/cache orchestration;
- modal/viewer state.

This makes security-sensitive lifecycle and key-session behavior difficult to reason about in isolation.

### SettingsScreen.tsx

Current responsibilities include:
- presentation and navigation for Settings;
- App Lock configuration;
- backup v1/v2 export/import;
- CSV export;
- restore preview/merge/replace;
- media/storage flows;
- currency and language/theme settings;
- clear-data handling.

Security-sensitive export/restore/auth operations need service boundaries before WP28-WP30.

### StorageManager / localDataStore / attachmentStorage

Current code provides useful compatibility and transactional behavior, but:
- StorageManager mixes preferences, AI cache, financial facade, App Lock, backup v1 and CSV;
- localDataStore mixes native SQLite and web localStorage implementation;
- attachmentStorage mixes media normalization, persistence, previews, staging and integrity.

Security migrations should enter through explicit repository/services, not spread encryption knowledge across UI callers.

### server.ts

Current server.ts owns:
- configuration defaults;
- request schemas and sanitizers;
- CORS;
- authentication;
- rate limiting;
- AI prompt construction;
- Gemini execution;
- route behavior;
- logging;
- HTTP application composition.

WP27 must split these responsibilities without changing behavior before WP31 changes authentication/network policy.

## 3. Target module responsibility map

Names are recommended, not mandatory. Responsibility is mandatory.

### App shell

Suggested:
- src/app/AppShell.tsx

Owns:
- composition of providers/features;
- top-level route/screen composition;
- no domain mutation implementation;
- no SQL/crypto/API-secret logic.

May depend on:
- navigation controller;
- lifecycle controller;
- auth/session controller;
- feature hooks/services.

Must not depend directly on:
- Capacitor SQLite;
- SQLCipher modes;
- Keystore bridge internals;
- backup crypto;
- backend token format.

### Navigation

Suggested:
- src/app/navigation/useAppNavigation.ts
- src/app/navigation/useAndroidBack.ts

Owns:
- primary destination state;
- Settings return destination;
- nested modal/back priority;
- navigation events.

Must not own:
- database changes;
- authentication implementation;
- media deletion.

### Lifecycle

Suggested:
- src/app/lifecycle/useAppLifecycle.ts

Owns:
- Android active/background events;
- browser visibility fallback;
- publishing lifecycle events to lock/delete controllers.

Must not directly:
- compare PINs;
- open SQLCipher;
- delete attachments.

### Lock/auth session

Suggested:
- src/features/security/AppLockController.ts
- src/security/SecureSessionService.ts
- src/security/SecureKeyService.ts interface
- src/platform/android/AndroidSecureKeyService.* native adapter

Owns:
- whether a protected SpendWise session is locked;
- timeout/fresh-auth policy;
- BiometricPrompt/device credential orchestration;
- opening/closing protected local-data session;
- release of in-memory local secrets;
- security migration state.

SecureKeyService owns:
- Keystore aliases;
- generation/wrap/unwrap/rotation;
- permanent-invalidity classification;
- no UI copy.

Must not own:
- expense business logic;
- backup merge rules;
- Gemini routes.

### Expense domain

Suggested:
- src/features/expenses/ExpenseService.ts
- src/data/ExpenseRepository.ts
- src/data/BudgetRepository.ts

Owns:
- create/read/update/delete semantics;
- validation of domain records;
- budget mutation;
- atomic ledger-level actions such as currency conversion through repository transactions.

UI receives domain objects, not SQL rows.

### Delete/Undo

Suggested:
- src/features/history/ExpenseDeleteUndoController.ts

Owns:
- in-memory pending delete batch;
- five-second window;
- conservative restoration on background/dispose;
- commit request after expiry.

It calls ExpenseService/MediaService for permanent commit. It does not know SQLite/file encryption details.

Invariant:
- pending deletion never destroys durable data/media before expiry.

### AI orchestration

Suggested:
- src/features/ai/AiAnalysisController.ts
- src/services/AiClient.ts

Owns:
- request construction from already-approved domain summaries;
- cancellation/stale request handling;
- local fallback selection;
- AI cache lifecycle;
- user-visible normalized error states.

AiClient owns:
- calling the authenticated backend transport;
- no embedded permanent production secret.

The AI feature does not own:
- backend signing private-key implementation;
- ledger persistence;
- Gemini provider key.

### Settings

Suggested:
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
  destructive-data/
~~~

Settings components:
- render current state;
- collect user intent;
- call feature services/controllers.

They must not:
- parse ZIP internals;
- run Argon2/AES directly;
- issue SQL;
- manipulate Keystore aliases;
- implement media file paths.

### Repositories

Suggested interfaces:
- ExpenseRepository
- BudgetRepository
- PreferencesRepository
- AttachmentMetadataRepository

Native implementation:
- encrypted SQLite adapter after WP29.

Web implementation:
- explicit browser adapter with documented lower assurance.

Responsibilities:
- durable storage semantics;
- transactions;
- schema migration;
- no React dependencies.

StorageManager may remain during WP27 as a compatibility facade, but new security work should target the explicit interfaces. By the final hardened state, its role should be thin delegation rather than a security-critical god object.

### Media service

Suggested:
- src/services/MediaService.ts
- src/security/MediaCryptoService.ts
- platform storage adapter

Owns:
- image normalization policy;
- encrypted persistent format;
- staging/verification;
- preview decrypt lifecycle;
- export temp lifecycle;
- delete/repair/integrity;
- plaintext migration.

UI sees attachment handles/metadata and preview URLs, not media keys.

### Backup service

Suggested:
~~~text
src/features/backup/BackupService.ts
src/features/backup/formats/v1.ts
src/features/backup/formats/v2.ts
src/features/backup/formats/v3.ts
src/features/backup/RestorePlanner.ts
src/security/BackupCryptoService.ts
~~~

Owns:
- format detection;
- compatibility import;
- v3 serializer/envelope;
- KDF/AEAD invocation through crypto service;
- validation limits;
- preview model;
- merge/replace plan;
- staging and rollback.

UI owns:
- file selection;
- warnings;
- passphrase entry;
- user confirmation.

Backup service must not know:
- Android view hierarchy;
- raw Keystore key material;
- Settings layout.

### Preferences

PreferencesRepository owns:
- theme;
- language;
- currency preference references where not part of authoritative ledger state;
- lock timeout preference;
- setup/legal acknowledgement;
- non-secret UI preferences.

It must never become a dumping ground for:
- DB secret;
- media key;
- installation private key;
- raw PIN;
- backup passphrase.

### Backend config

Suggested:
- server/config.ts

Owns:
- environment parsing;
- production/development mode;
- Gemini model list;
- allowed origins;
- request limits;
- auth/token policy;
- rate/quota parameters.

Rules:
- production misconfiguration fails fast;
- development defaults never silently become production security defaults;
- secret values are never emitted in diagnostics.

### Backend middleware

Suggested:
~~~text
server/middleware/
  authentication.ts
  rateLimit.ts
  cors.ts
  requestLimits.ts
  errors.ts
~~~

Authentication:
- installation registration/challenge verification;
- access token verification;
- installation revocation checks.

Rate limit:
- per-install and per-IP controls;
- no Gemini dependencies.

CORS:
- exact origin policy;
- no authentication semantics.

Errors:
- stable safe external contract;
- internal sanitized diagnostic code.

### Backend routes

Suggested:
~~~text
server/routes/
  health.ts
  installationAuth.ts
  analysis.ts
  trends.ts
  smartCapture.ts
  receiptScan.ts
~~~

Routes:
- parse already-bounded body;
- call validator;
- call application service;
- return normalized response.

Routes must not:
- implement signature primitives inline;
- maintain their own rate bucket logic;
- create Gemini client directly;
- log raw financial payloads.

### Gemini service

Suggested:
- server/services/GeminiService.ts
- server/services/geminiReliability.ts

Owns:
- provider client;
- model/fallback selection;
- timeout/retry policy;
- prompt generation;
- response schema enforcement.

Provider credentials exist only here/config environment boundary, never in client code.

### Validation

Suggested:
- server/validation/*

Owns:
- canonical schemas;
- length/range/count bounds;
- image encoding/mime checks;
- normalized internal request types.

Validation happens before expensive AI provider work.

### Logging

Suggested:
- server/logging/*
- src/diagnostics/*

Owns:
- structured sanitized events;
- redaction contract;
- diagnostic bundle.

Must make it difficult, not merely discouraged, for callers to attach raw financial payloads.

## 4. Cross-cutting dependency rules

### Rule A — presentation cannot bypass services

Bad:
~~~text
SettingsScreen -> Filesystem.writeFile
SettingsScreen -> Argon2
SettingsScreen -> SQLiteConnection
~~~

Target:
~~~text
SettingsScreen
  -> BackupController
  -> BackupService
  -> BackupCryptoService + repositories + MediaService
~~~

### Rule B — crypto primitives live behind purpose-specific services

Do not create one global CryptoUtils file that every feature calls.

Purpose-specific boundaries:
- SecureKeyService: Keystore/wrapping;
- MediaCryptoService: attachment AEAD format;
- BackupCryptoService: Argon2id + backup envelope;
- backend signing/token service: installation identity verification.

This reduces accidental key reuse.

### Rule C — repositories do not own authentication UI

Repository requests protected material from SecureSession/SecureKeyService through injected contracts. It does not launch BiometricPrompt itself from arbitrary write calls.

Authentication occurs at session/sensitive-operation boundaries.

### Rule D — domain state is authoritative, caches are disposable

AI analysis cache, previews and computed statistics must be recreatable. They cannot be required to recover the ledger.

### Rule E — failures are typed across boundaries

Security-sensitive operations return stable classified failures such as:
- USER_AUTH_REQUIRED;
- USER_AUTH_CANCELED;
- KEY_PERMANENTLY_INVALID;
- DB_MIGRATION_FAILED;
- MEDIA_AUTH_FAILED;
- BACKUP_WRONG_PASSPHRASE_OR_TAMPER;
- RESTORE_ROLLBACK_FAILED.

UI converts these to localized messages. Infrastructure errors/stacks do not leak directly.

## 5. Authoritative flows after refactor

### Startup

~~~text
AppShell
 -> lifecycle/security bootstrap
 -> detect migration/recovery state
 -> if protected session required: App Lock
 -> SecureSession authenticates
 -> SecureKeyService unwraps local secrets
 -> repositories open encrypted data
 -> feature controllers load domain state
~~~

If encrypted data exists but keys are unavailable, startup routes to recovery state instead of empty initialization.

### Expense write

~~~text
Expense UI
 -> ExpenseService.validate
 -> repository transaction
 -> refresh/selectors
~~~

If attachments:
~~~text
acquisition
 -> MediaService normalize
 -> MediaCryptoService encrypt/stage
 -> ExpenseService/repository transaction commits metadata
 -> MediaService activates file
 -> cleanup stale stage
~~~

### Delete with Undo

~~~text
History UI
 -> ExpenseDeleteUndoController.stage
 -> UI hides item only

Undo
 -> controller restores view state

expiry
 -> ExpenseService permanent delete transaction
 -> MediaService deletes encrypted files after DB ownership result
~~~

App background/dispose before expiry restores conservatively.

### Unlock

~~~text
Lock UI
 -> SecureSession.requestUnlock
 -> native BiometricPrompt
 -> Keystore-authorized unwrap
 -> open protected repositories
 -> unlocked session
~~~

No native custom SpendWise PIN comparison remains.

### Backup v3 export

~~~text
Settings Backup UI
 -> fresh re-auth
 -> passphrase entry/confirmation
 -> BackupService snapshot logical state
 -> MediaService streams required attachments
 -> BackupCryptoService builds encrypted v3 envelope
 -> ExportService writes dedicated temp cache
 -> platform share destination
 -> cleanup
~~~

### Backup restore

~~~text
file
 -> format detector
 -> v3 header bounds
 -> passphrase/KDF
 -> AEAD authenticate/decrypt
 -> archive/schema/content limits
 -> RestorePlanner
 -> staged media/state
 -> fresh re-auth for replace
 -> transactional activation
 -> verification
 -> cleanup
~~~

Legacy v1/v2 enter through separate compatibility parsers but converge on the same validated RestorePlan.

### AI request

~~~text
AI feature
 -> domain summary builder
 -> AiClient
 -> backend auth client obtains/renews short token by signed challenge
 -> HTTPS backend route
 -> auth middleware
 -> rate/quota middleware
 -> validator
 -> GeminiService
 -> normalized response
~~~

### Key-loss recovery

~~~text
repository open
 -> KEY_PERMANENTLY_INVALID
 -> SecureSession enters recovery
 -> keep encrypted DB/media untouched
 -> user selects portable backup or acknowledges unrecoverable local state
 -> recovery creates new key hierarchy only after explicit choice
~~~

## 6. WP ownership and interfaces

### WP26 — app shell

May create:
- AppShell/navigation/lifecycle/feature hooks.

Must preserve:
- all v1.4 behavior;
- current storage/security implementation.

Output needed by WP28:
- one clear lock/session lifecycle seam;
- background/foreground events separated from UI composition.

### WP27 — service boundaries

May create:
- Settings decomposition;
- repositories/services interfaces;
- backend module split;
- compatibility facades.

Must preserve:
- formats;
- credentials;
- behavior.

Output needed by WP28-WP31:
- SecureKeyService placeholder interface;
- BackupService/MediaService seams;
- backend auth middleware seam;
- centralized backend config.

### WP28 — authentication and key foundation

Owns:
- native auth;
- SecureKeyService native implementation;
- legacy plaintext PIN migration;
- secure-session behavior;
- Privacy Shield.

Does not encrypt DB/media yet.

### WP29 — encrypted local data/media

Owns:
- SQLCipher adapter/migration;
- media crypto format/migration;
- provider/cache path narrowing related to media sharing;
- encrypted media integrity.

Does not redesign backup portability.

### WP31 — backend/network

Owns:
- installation identity registration/challenges;
- access tokens;
- quotas;
- HTTPS/no-cleartext client/network config;
- server security middleware/config.

Can proceed with WP29 after WP28 because local persistence and backend modules are separated by WP27.

### WP30 — backup v3

Owns:
- Argon2id/AES-GCM portable envelope;
- v3 UX/services;
- legacy compatibility;
- plaintext CSV warning/export safety.

Starts after WP29 and WP31 merge so its backup/export flows consume the final secure local services and auth/network boundaries.

### WP32 — integration/E2E

Owns:
- actual rendered/browser/Android test layers;
- migration fixtures;
- process-kill/failure injection;
- disaster recovery proof.

### WP33 — observability/performance

Owns:
- local sanitized diagnostics;
- backend aggregate metrics;
- measured performance budgets.

Does not add financial analytics telemetry.

### WP34 — release gate

Owns:
- final security/release checks;
- code/dependency/secret scanning;
- release APK configuration verification;
- migration and backup compatibility gate;
- final MASVS-style review;
- version/tag only after everything is green.

## 7. Security-sensitive persistence metadata

Non-secret metadata may exist outside the encrypted DB only when startup needs it before the DB is open. Keep it minimal and versioned.

Allowed examples:
- security schema version;
- migration state;
- active KEK alias version;
- wrapped-secret ciphertext/nonce/tag records;
- whether protected recovery is required;
- non-secret App Lock preference/timeout.

Forbidden:
- raw DB secret;
- raw media key;
- raw PIN;
- backup passphrase/derived key;
- installation private key;
- financial records.

## 8. File/provider boundary

Current v1.4 FileProvider:
- provider is non-exported;
- URI grants are enabled;
- file_paths.xml exposes external-path "." and cache-path ".".

Target:
- use dedicated app-owned cache/export subtrees;
- remove broad external-root exposure when plugin/share compatibility proof permits;
- emit only content URIs for files created for the current share operation;
- read-only grants unless a workflow demonstrably requires write;
- cleanup stale export files;
- test that arbitrary external paths cannot be granted through SpendWise.

## 9. Testing seams the architecture must enable

By WP32, tests should be able to substitute:
- in-memory ExpenseRepository;
- fake SecureKeyService with valid/missing/invalidated states;
- fake native authenticator success/cancel/error;
- faulting migration destination;
- tampered MediaCryptoService ciphertext;
- deterministic BackupCryptoService fixtures;
- fake backend installation-auth verifier;
- fake quota store;
- mock GeminiService.

Tests must not need to render the whole app merely to prove:
- key-loss state handling;
- backup wrong-passphrase non-mutation;
- nonce replay rejection;
- deletion persistence safety;
- restore rollback.

## 10. Architecture acceptance invariants

These are release-level invariants:

- UI never receives DB/media/Keystore keys.
- No native raw SpendWise PIN persists after migration.
- An existing encrypted database with a missing key never causes automatic empty-ledger initialization.
- Plaintext DB/media source is deleted only after encrypted replacement verification.
- Backup validation/authentication completes before active ledger mutation.
- Legacy backup parsers cannot bypass the common validated restore plan.
- CSV is intentionally plaintext and warned, not accidentally treated as secure.
- No permanent client bearer secret is considered confidential.
- Backend authentication/rate limiting/validation are independently testable from Gemini.
- Provider keys and release signing secrets remain server/CI-side.
- Financial payloads are excluded from production logs/diagnostics.
- Root/tamper signals never replace cryptographic controls.
- Web/native security claims remain distinct.
- WP26/WP27 refactors do not change behavior before security migrations begin.

## 11. WP sequence result

WP25 research found no reason to reorder the approved roadmap.

~~~text
WP25
 -> WP26
 -> WP27
 -> WP28
 -> WP29 + WP31
 -> WP30
 -> WP32
 -> WP33
 -> WP34
~~~

The sequence is retained exactly. No roadmap edit is required in WP25.
