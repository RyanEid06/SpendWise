# WP37 backup policy and recovery report

Date: 2026-10-12. Scope: approved WP37 Parts 27–31 and 50, specification refinement 5, implementation-plan Task 2. Branch: `fix/wp37-localization-native-auth-ux`. No commits, provider/configuration/deployment changes, version changes, releases, merges or branch deletions were performed by this domain agent.

## Confirmed causes and existing behavior

- V1 Replace in `StorageManager.restoreBackup` wrote backup theme and language unconditionally after financial persistence. V2 Replace did the same through `setSettings`; encrypted V3 delegated to V2. Subsequent application refresh therefore adopted those backup UI preferences.
- The actual SpendWise `themeMode` is persisted independently of the resolved OS appearance. The existing getter returns `SYSTEM` itself. The new policy keeps that value rather than resolving it to LIGHT/DARK or consulting OS language.
- Currency already belongs to financial state. Replace adopts backup currency; Merge rejects differing currencies when both ledgers contain financial records, and adopts backup currency when the current ledger is empty. These rules are preserved.
- V1 swallowed financial and preference rollback exceptions. V2 did not verify rollback snapshots and swallowed preference rollback errors. A partially persisted theme followed by a failed language write could therefore fail to recover without reporting that distinction.
- V2 media validation/staging, ownership remapping, checksums and post-commit cleanup warnings already existed. V3 authenticated decryption, Argon2id/AES-GCM and archive validation already existed and were retained.

## Final changes

- Added optional `BackupRestoreOptions.restoreAppPreferences`, propagated through BackupService, StorageManager, V2 adapters, and V3 delegation. Omitting the options remains valid for existing callers. Options are runtime policy, never backup schema fields.
- Default Replace keeps current language/theme and performs zero preference writes. Explicit Replace opt-in applies backup theme/language. Merge ignores opt-in and always keeps current UI preferences.
- Added one shared Replace-only checkbox, **Restore app language and appearance**, OFF by default. It resets for new input and after choosing Merge. Both preview dialogs show visible policy copy, and remain scrollable within the viewport. Added EN/FR/AR feature-local copy in `src/features/backup/restoreCopy.ts`, exported for integration parity checks.
- Added a shared commit/compensation helper. Financial persistence finishes before optional preference writes. The helper verifies committed financial snapshots and resulting preferences, compensates financial state and any attempted preference writes, and verifies recovery rather than trusting a resolved rollback promise.
- `BackupRecoveryIncompleteError` explicitly records whether financial and preference recovery were verified. Original errors remain the result only after recovery is verified. An unreadable preference state cannot be declared recovered.
- Incomplete recovery closes the import dialog, clears stale success feedback, and presents a localized alert that receives focus and scrolls into view after dialog cleanup.
- V2/V3 retain staged media if financial recovery is uncertain, because the current ledger may still reference it. Verified financial recovery permits staged-file cleanup. Old media is removed only after successful commit/preference verification. Cleanup failures remain warnings; potentially recoverable orphan files are preserved.
- Brought V1 post-commit old-media cleanup in line with V2: cleanup failure returns a warning with the committed result instead of reporting an apparently failed restore after ledger replacement. The optional legacy summary warning field preserves compatible typed mocks/callers.
- Preference application explicitly constructs only `currencyCode`, `themeMode`, and `language`. Export settings remain the same allowlist. Security state, tokens, PINs, biometric data, Keystore and encryption keys were not added to any format or restore path.

## Test development and results

Runtime used for all recorded final commands: Node `v22.23.3` from `C:\Users\Administrator\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe` (PATH prefixed). No shared Playwright server or full suite was started by this agent.

The first valid RED run of `node --import tsx --test tests/wp37-backup.test.ts` produced **9 pass / 12 fail / 21 total**: nine default theme/language preservation cases and three incomplete preference rollback cases failed for the expected policy/recovery reasons. An earlier test-fixture attempt used an invalid empty description and was corrected before accepting RED evidence.

After implementation, that original 21-case run passed **21/21**. A separate RED test for V1 post-commit cleanup failed with `SIMULATED_CLEANUP_FAILURE`; it passed after cleanup warning handling was added. A test-fixture expectation was also corrected to preserve existing V1 Merge ID remapping rather than requiring V2/V3 IDs.

The final unique WP37 test file has **33 tests**. It exercises the real BackupService/StorageManager paths, real `LocalDataStore` web financial transaction persistence, individual injected preference storage writes, and fresh `LocalDataStoreImpl` instances reopened against the same backing store. Coverage includes:

- All formats: opposite LIGHT/DARK preferences, English/Arabic, SYSTEM/French, explicit SYSTEM/Arabic restore, zero default preference writes, Merge ignoring opt-in, empty-ledger Merge currency adoption, differing-currency rejection, and security-field exclusion/security-state preservation.
- All formats: language write failure after the financial commit and successful theme write; verified financial/preference rollback and reopen; failed preference rollback producing explicit incomplete recovery with the old ledger still present after reopen.
- V2 shared path: silently unsuccessful financial rollback is detected, and potentially referenced staged media is retained; silently unsuccessful preference rollback is detected.
- V1: post-commit media cleanup failure produces a warning while restored ledger/preferences remain correct on reopen.

Final focused command:

```powershell
node --import tsx --test tests/wp37-backup.test.ts tests/media-backup.test.ts tests/wp30-secure-backup-v3.test.ts tests/persistence.test.ts tests/wp33-5-backup-media.test.ts tests/wp32-failure-injection.test.ts tests/wp29-encrypted-at-rest.test.ts
```

Result: **111 tests / 111 pass / 0 fail / 0 skipped**, exit 0. This retains encrypted V3 tamper/passphrase/KDF/media protections, archive validation, persistence, backup media ownership, and existing failure-injection gates. Two existing expectations were updated for the approved policy: media-backup now expects current LIGHT by default, and the WP32 preference-failure injection explicitly opts into preference restoration.

Final compile command: `node node_modules/typescript/bin/tsc --noEmit` — **exit 0**, no diagnostics.

A wider concurrent run including WP28 had **126/127 pass**. Its sole failure was the WP28 source-text assertion for `setDeviceCredentialAllowed(true)` against the native-auth agent's in-progress Java changes, already reported to the coordinator. It is outside backup ownership; this report does not claim that gate green. Earlier WP28/WP29/WP32 runs passed before that native source change.

## Compatibility and remaining acceptance

- V1 metadata/schema 1, V2 manifest/schema 2 and encrypted V3 envelope/header/KDF remain unchanged. Existing format validators and archives remain accepted. Runtime options and summary warnings do not change serialized backup formats.
- Financial amounts, descriptions, dates, category normalization, budgets, currency safeguards and V1 Merge ID semantics remain in existing paths. V2/V3 staging/remapping and cryptographic validation remain in existing paths.
- The new copy/control and Settings error focus are implemented and TypeScript checked. Coordinator-owned browser/component checks still need to exercise real modal toggling, cancellation/reopening, option propagation, FR/AR wrapping, small-height scrolling, and incomplete-recovery announcement/focus.
- Reopen proof in this report is real web storage/datastore reopening, not a cloned in-memory state. Physical Android SQLCipher persistence, OEM filesystem failures, and visual/manual acceptance were not exercised here.
- Runtime compensation across the independently persisted financial and UI-preference domains is covered. Process termination between those independent writes was not simulated; this report does not claim cross-domain crash atomicity or a persistent post-restart recovery notification.
- No user data was reset or discarded to recover preferences. When a recovery write cannot be verified, the result explicitly remains incomplete; the application does not manufacture successful restoration.

## Independent review follow-up: displayed state after incomplete recovery

The independent reviewer identified a valid P2: the three incomplete-recovery catches closed their dialogs without invoking AppShell's existing refresh callback. A failed compensation could leave persisted ledger/currency/theme different from the React state presented to the user.

The follow-up now reconciles through `onBackupRestored` for all V1/V2/V3 incomplete outcomes, independently refreshes media counts, and preserves the error-only warning and focus. The callback is used to refresh existing state; it does not produce success feedback. If preference/readback reconciliation throws, the original warning remains and adds a localized instruction to close and reopen SpendWise before checking data. Media readback failure cannot overwrite or delay the warning.

At the coordinator/native author's request, Settings also maps `CREDENTIAL_IMMEDIATE_LOCK_UNSUPPORTED` ahead of generic unavailable errors to the existing EN/FR/AR `AUTHENTICATION_LIMIT_COPY`. It does not change the lock timeout or select weaker authentication.

Added CI-discoverable `tests/e2e/components/wp37-backup-recovery.spec.ts`, with a distinct HTML/harness. It uses real SettingsScreen, BackupService/StorageManager persistence, and the same real ledger/preference hooks that AppShell refreshes. Only narrowly scoped write/readback failures are injected. The harness commits a two-expense EUR ledger and DARK theme, then silently fails financial rollback and fails preference compensation, reopening a fresh datastore to prove what persisted.

Meaningful browser RED: **3/3 failed** because the visible state remained `1/0/USD/LIGHT/en` while the reopened state was two expenses, one budget, EUR and DARK. After the fix, those three cases passed. The final expanded browser run passed **9/9 in 19.3 seconds**: all three formats reconcile; all three retain the focused warning/no success status/no unhandled page errors when preference callback and media readback fail; all three locales show the exact native limitation copy and keep App Lock disabled after its rejected change.

Local command: `node node_modules/@playwright/test/cli.js test --config=.superpowers/wp37/backup-recovery.config.ts` using isolated localhost port 4188 in the approved normal terminal context. The local config is ignored scratch only; standard CI's `npm run test:wp32:components` discovers the committed spec. No common harness or shared server was changed. Initial infrastructure/harness attempts (cold navigation timeout, implicit status semantics on a harness output, and keyboard activation of a rejected controlled toggle) were corrected before accepting the recorded behavior evidence.

Fresh follow-up `node node_modules/typescript/bin/tsc --noEmit` and owned-file `git diff --check` both passed, exit 0. Physical Android/native SQLCipher acceptance and the cross-domain process-termination limitation above remain unchanged.

## Review follow-up: stale insights after uncertain financial recovery

Inspection confirmed that analysis is cached by month in localStorage without a ledger fingerprint, and the existing cache invalidation ran only after successful restore. When financial compensation could not be verified, AppShell's reconciliation could therefore reload claims computed for the old ledger.

All three StorageManager restore entry points now invalidate that disposable cache before propagating an incomplete-recovery error with `financialRecovered=false`. A session guard suppresses old cache reads even if cache removal throws; a successful write of newly computed analysis re-enables its month. The focused warning, original recovery error, and financial/media recovery behavior are preserved. No analysis hook, provider, persisted financial schema, or backup schema was changed by this follow-up.

Meaningful RED evidence: six new real-storage Node cases (all formats, with and without cache-removal failure) returned the old cached claim instead of null. A browser case using the real `useAiAnalysis` hook also displayed `Old ledger cached claim` after the persisted and displayed ledger had changed. The browser recovery harness now checks that old insights disappear across all formats, including preference/media readback failure cases.

Final focused Node command:

```powershell
node --import tsx --test tests/wp37-backup.test.ts tests/media-backup.test.ts tests/wp30-secure-backup-v3.test.ts tests/wp32-failure-injection.test.ts tests/wp35-client-runtime.test.ts tests/core-ux.test.ts
```

Result: **94 tests / 94 pass / 0 fail**, exit 0; the unique WP37 backup file now contains **39 tests**. The isolated recovery browser spec passed **9/9 in 12.4 seconds**. Fresh `tsc --noEmit` and `git diff --check` passed, exit 0. These are focused follow-up checks; the coordinator owns the final integrated build and full suites.

Cache deletion is persistent when storage accepts it. The fallback suppression is session-local if storage refuses deletion; this follow-up does not claim a process-restart guarantee under persistent storage failure. The existing localized close/reopen instruction remains available when reconciliation itself cannot read current state.
