# SpendWise roadmap and delivery record

Updated 2026-10-05. This is the single project record for completed work,
implemented constraints, verification and remaining production work. README is
the quick-start guide. Detailed superseded plans/diagnostic timelines remain in
Git history; existing regression tests and native runners remain active.

## Current status

- Source: **2.0.0**, Android version code **6**, package `com.spendwise.app`.
- Main inspected for WP33: `5ed7acdf2ce84e11200f3cc6f67eae76088a2610`;
  [Android Build baseline](https://github.com/RyanEid06/SpendWise/actions/runs/37234446017)
  passed before implementation. The signed 2.0 trial merged at `9be8b8f`.
- WP25–WP32 implementation and WP32 automated acceptance are complete.
- A signed 2.0 trial was integrated; the latest public GitHub Release is still
  [v1.4.0](https://github.com/RyanEid06/SpendWise/releases/tag/v1.4.0), checked
  2026-10-04.
- WP33 implementation and measured baselines are on
  `wp33/observability-performance`; receipts and the exact-source-head acceptance
  gate are linked below and in [PR #33](https://github.com/RyanEid06/SpendWise/pull/33).
  WP34 has not started. Physical-device/TalkBack validation remains separate.

## Completed work — what we added

| Milestone | Delivered changes |
| --- | --- |
| Initial reliability hardening | Non-destructive storage initialization; stable history ordering/month defaults; AI cache invalidation; bounded AI/image requests; currency conversion safeguards; backup validation/rollback; local-first privacy copy; Android cloud backup disabled. |
| WP15–WP16 product baseline | Manual-first expense entry with optional capture tools; four primary destinations; secondary Settings; read-only History/Statistics details; compact phone layout; keyboard focus, 48px target and reduced-motion rules. |
| WP17 core UX | Refined capture/navigation/copy and preserved canonical brand artwork and media affordances. |
| WP18 first-run security | First-run/setup, lock throttling and privacy behavior hardened; Android update identity/version assertions. |
| WP19 brand and Dashboard | Restored intended launcher/app artwork; simplified Dashboard/budget/category presentation. |
| WP20 History and Undo | Read-only details, accessible deletion, grouped five-second Undo, staged persistence/media deletion and viewport-rooted overlays. |
| WP21 Statistics density | Clearer spending summaries and terminology, compact mobile hierarchy and empty-state handling. |
| WP22 category statistics | Shared category presentation, category ranking/trends and largest-expense ranking by month. |
| WP23 Settings | Compact overview; inline simple choices; focused App Lock, Media and Backup subpages; predictable Back; destructive actions at the bottom. |
| WP24 integration | Cross-feature UX/regression gates and the v1.4 release baseline, later aligned to 2.0 trial metadata. |
| WP25 engineering contracts | Defined architecture boundaries, threat assumptions, security ownership, recovery rules and a staged hardening plan. |
| WP26 app shell | Split app composition, navigation, lifecycle, ledger, Undo, AI requests, overlays, lock and theme/language into focused hooks/controllers. |
| WP27 service boundaries | Introduced expense/backup/media/repository boundaries and decomposed the backend into configuration, middleware, routes, validation, prompts, Gemini service and logging. |
| WP28 authentication/keys | Native strong-biometric/device-credential App Lock; Keystore wrapping/key policy; separate session management; legacy PIN migration; Argon2id web verifier; fresh authentication and Privacy Shield. |
| WP29 encrypted storage | SQLCipher native financial database; separately keyed authenticated media; staged/journaled migration; destination verification and fail-closed key/recovery behavior. |
| WP30 Backup v3 | Passphrase-derived Argon2id/AES-GCM portable backups, data-only/full modes, bounded authenticated parsing, legacy v1/v2 imports, merge/replace and rollback protection. |
| WP31 backend security | Per-install P-256 challenge/proof authentication; short-lived tokens; replay/expiry/revocation; bounded IP/installation/daily/global quotas; HTTPS/cleartext policy; expiring legacy compatibility and sanitized logs. |
| WP32 executable acceptance | Rendered components, browser integration, accessibility/layout, failure injection and Maestro native/migration flows; artifact-backed repairs and full 22-flow native acceptance. |
| 2.0 trial packaging | Version 2.0.0/code 6, Share/Lucide maintenance, permanent signing identity checks, source/run/checksum receipts and 10 executable APK-verifier regressions. |

## Implemented architecture

| Path | Responsibility |
| --- | --- |
| `src/app/` | App composition, navigation, lifecycle, feature hooks and selectors |
| `src/screens/`, `src/components/` | Screens, presentation and dialogs |
| `src/features/`, `src/services/` | Expense/backup/media boundaries, Settings and analysis cache |
| `src/data/` | Ledger/preferences repositories, schema and encrypted native DB migration |
| `src/security/`, `src/platform/android/` | Secure sessions/keys, media codec, web PIN, installation identity, API client and Capacitor bridge |
| `src/utils/` | Compatibility persistence, backup formats, image/export helpers, statistics and copy |
| `server/` | Express configuration, middleware, routes, authentication, validation and Gemini |
| `android/` | Native Capacitor application, Java security plugin, resources and Gradle |
| `tests/`, `.maestro/` | Existing regression, web and native acceptance coverage |
| `scripts/`, `.github/` | Test orchestration, deployed smoke, build and release automation |

Dependencies flow from presentation through feature hooks/services to repositories
and platform/persistence adapters. UI code must not implement SQLCipher, Keystore,
backup crypto, provider secrets or backend authentication. Compatibility utilities
remain where services delegate to them.

`src/App.tsx` wraps `src/app/AppShell.tsx`. `src/main.tsx` initializes the secure
session before protected storage. `src/utils/localDataStore.ts` backs the ledger
repositories with SQLCipher on Android and localStorage on web. Media staging,
previews, encryption and integrity live in `src/utils/attachmentStorage.ts`.

`server.ts` starts `server/startServer.ts`; `server/app.ts` composes middleware and
routes. Development serves API + Vite middleware on port 3000. Production serves
built `dist/` when present. Gemini execution lives behind `GeminiService` with
shared validation, bounded retries/timeouts and normalized errors.

## Security, recovery and known limits

This section records implemented behavior, not a new security audit or a
certification claim.

- Android database and media secrets are separate (`spendwise.db.v1` and
  `spendwise.media.v1`) and Keystore-wrapped. Installation signing uses a separate
  P-256 key. Portable backup keys come from backup passphrases, not App Lock.
- Native App Lock uses strong biometrics/device credentials with version-specific
  compatibility. Successful migration removes the legacy SpendWise PIN;
  cancellation/failure retains a recovery path and does not destroy data.
- Web uses a versioned Argon2id PIN verifier and throttling. This is a UI privacy
  lock, not encryption of browser localStorage. Same-origin code/profile access
  can bypass its confidentiality boundary.
- Locking zeroes/releases the session-secret cache as far as practical. Runtime
  copies and the SQLite plugin's Android-encrypted operational secret mirror
  mean the whole stack must not be described as exclusively ephemeral secrets.
- Database/media migration stages and verifies replacements before removing the
  plaintext source. Missing/invalidated keys and unfinished migrations fail
  closed; unreadable encrypted data must never silently become an empty ledger.
- Native media uses AES-GCM authenticated envelopes. Known integrity failures
  after completed migration are isolated from unrelated financial startup;
  authenticated reads still reject damaged files. Integrity repair must not
  silently discard media or financial ownership.
- Privacy Shield uses Android `FLAG_SECURE` for protected/sensitive surfaces.
  Physical-device screenshot/Recents and OEM behavior remain manual gates.
- CSV and legacy v1/v2 imports are plaintext. Native sharing writes exports to
  app cache; `fileExport.ts` does not explicitly delete them after sharing.
  FileProvider remains non-exported with URI grants but broad cache/external
  roots. Review cleanup/path narrowing before claiming export hardening complete.
- There is no hidden recovery key. Forgotten backup passphrases or lost device
  keys may make data unrecoverable. Local encryption does not replace backups.
- A rooted/compromised OS or unlocked process can expose data. Installation key
  possession does not attest that a client is official. Production HTTPS uses
  platform CA trust; certificate pinning is not deployed.
- Logs exclude financial bodies/photos, passphrases, keys and raw tokens. Existing
  security telemetry records sanitized metadata/hashed scopes. Exportable support
  diagnostics and operational aggregates now follow the WP33 contracts below.

## Backup v3 format and compatibility

The default export is an authenticated encrypted envelope:

```text
0..3    magic SWB3
4       format version 3
5..8    big-endian authenticated-header byte length
9..N    UTF-8 JSON header (AES-GCM additional authenticated data)
N..EOF  AES-256-GCM ciphertext + 128-bit authentication tag
```

The header carries format/KDF versions, Argon2id parameters, a fresh 16-byte salt,
AES-GCM identifier, fresh 12-byte nonce, tag length, logical payload format,
data-only/full mode and plaintext byte count. The inner payload is a logical
Backup v2 ZIP, not native database/media ciphertext or device keys/credentials.

KDF v1 uses 19,456 KiB memory, two iterations, parallelism one and 32-byte output.
Restore permits only bounded v1 values (16–64 MiB, two–four iterations,
parallelism one–two, exactly 32-byte output) before running Argon2id.

Restore bounds/validates the outer envelope, authenticates/decrypts it, validates
ZIP central-directory structure before inflation, then validates schemas,
financial invariants, currency and attachment mappings. It stages media, commits
candidate state, applies settings where applicable and cleans old media only
following success. Mutation failures attempt restoration of prior state and
cleanup of staged media.

Reject unsupported ZIP64/multi-disk/encrypted/compression formats, excessive
entries/sizes, traversal/absolute/unexpected/duplicate paths, duplicate attachment
mappings, unsupported MIME types, malformed manifests, more than eight photos
per expense and corrupted v3 JPEGs. The v2 payload ceiling is 512 MiB; media is
bounded to 5 MiB per item. v1 JSON and v2 ZIP imports remain supported; v3 is the
default export. CSV remains intentionally plaintext.

## Backend configuration and authentication

`.env.example` lists server/build settings. `server/config.ts` defines actual
runtime defaults and bounds. Never ship `GEMINI_API_KEY` or signing material in
`VITE_*` variables.

| Setting | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-only provider key |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_TIMEOUT_MS` | Backend model/reliability controls |
| `VITE_API_BASE_URL` | Empty for same-origin local development; deployed HTTPS backend for Android |
| `ALLOWED_ORIGINS` | Exact allowed origins; local browser uses `http://localhost:3000`, Android uses `https://localhost` |
| `SPENDWISE_INSTALLATION_STORE_PATH` | Durable installation public-key/revocation registry; ignored runtime state |
| `SPENDWISE_DENIED_INSTALLATION_IDS` | Emergency installation deny-list |
| `SPENDWISE_TELEMETRY_SALT` | Optional server-only scope-hash salt |
| `SPENDWISE_API_TOKEN`, `SPENDWISE_LEGACY_AUTH_UNTIL` | Isolated legacy static-token compatibility with a concrete expiry |

Native installations generate a non-exportable P-256 signing key in Keystore and
register the public SPKI key. The backend issues a random one-time 120-second
challenge; valid ECDSA P-256/SHA-256 proof obtains a random 10-minute token.
Renewal uses a fresh signed challenge. The browser signer is ephemeral and has
lower assurance. Registration proves key possession, not official-client identity.

The server limits registration, challenges/proofs, per-installation/IP AI calls,
daily installation use and global provider cost. Auth JSON is bounded to 64 KiB;
financial JSON to 512 KiB; image requests to a 16 MiB parser ceiling with a
12,000,000-character image bound. Origins, validation and quotas complement auth.

Legacy compatibility stops automatically at its configured sunset. When the
upgrade window ends, unset the server legacy token, remove obsolete
`VITE_API_ACCESS_TOKEN` secrets and remove compatibility code in a reviewed change.
Current builds do not send `X-SpendWise-Token`.

`GET /api/health` exposes only `ok`, `aiConfigured`, `authentication` and
`legacyCompatibilityEnabled`. `scripts/deployed-auth-smoke.mjs` checks
registration -> challenge -> proof -> access token -> Gemini analysis on main/tag
pushes without printing keys/tokens. Normal E2E uses no live provider calls.

## Tests and recorded acceptance

The `wpNN` names identify retained regression suites and synthetic fixtures.
They are not disposable generated output. Install Node.js 22 dependencies with
`npm ci`; use `npm run verify` for TypeScript/Vite.

| Suite | Command / entrypoint |
| --- | --- |
| Existing Node regressions | `package.json` scripts `test:reliability`, `test:currency`, `test:persistence`, `test:media-backup`, `test:core-ux`, `test:final-freeze`, `test:wpNN` |
| Android harness and failure injection | `npm run test:wp32:runner`, `npm run test:wp32:failure` |
| Complete executable web suite | `npx playwright install chromium`, then `npm run test:wp32` |
| Rendered components | `npm run test:wp32:components`; harness `tests/e2e/components/index.html` |
| Browser, accessibility, layout | `test:wp32:browser`, `test:wp32:accessibility`, `test:wp32:visual` |
| APK receipt verification | `node --test tests/apk-signing-verification.test.cjs` |
| Full native suite | `scripts/run-wp32-android-e2e.sh` with prepared current/legacy APKs and emulator |
| Isolated native debug | `scripts/run-wp32-isolated-gate.sh` with `WP32_TARGET`; current CI matrix selects `import-v3-data` |
| Targeted backup debug | `scripts/run-wp32-backup-restore-targeted.sh`; does not replace full acceptance |

Harness regressions need Bash; Windows defaults to
`C:/Program Files/Git/bin/bash.exe` (override `WP32_BASH`). Native runs need JDK 21,
adb, prepared current/v1.4 APKs and an Android emulator. CI pins Maestro 2.11.0.
The full native E2E workflow runs on manual dispatch or the `wp32-final-native`
PR label. Isolated success is separate from full sequential acceptance.

Portable fixtures use the emulator month; `WP32_FIXTURE_MONTH=YYYY-MM` provides
reproducibility. Gallery fixtures deliberately use representative 1024px JPEGs.
See [fixture inventory](tests/fixtures/README.md). Generated fixture archives,
Playwright reports/traces and native artifacts stay under ignored output paths;
archive only synthetic/sanitized failure data.

Historical acceptance receipts (these are not a new local execution):

| Gate | Recorded result | Evidence |
| --- | --- | --- |
| Native sequential | 22/22 together at `253639e561c9ed822ea9ab892b32125d4d81eb4e` | [Run 37227530296](https://github.com/RyanEid06/SpendWise/actions/runs/37227530296), native job `111510178359` |
| Final web | 54 checks: 22 Node + 32 Playwright | Same run, web job `111510178323` |
| Earlier Android Build | 226 Node regressions plus audits/build | [Run 37219280661](https://github.com/RyanEid06/SpendWise/actions/runs/37219280661) |
| Integrated 2.0 main | Merge receipt records 236 Build regressions including 10 signing checks | [Merge 9be8b8f](https://github.com/RyanEid06/SpendWise/commit/9be8b8f405a4312b221222517623367ac2b446f2), [successful main Build](https://github.com/RyanEid06/SpendWise/actions/runs/37231841223) |

Seven initial native targets were narrowed to selector/SystemUI/viewport/bootstrap
issues plus a real completed-media-corruption defect. That repair preserves
unrelated finances and authenticated reads while keeping key failures/incomplete
migration strict. Data-only restore checks the exact receipt, budget, two entries
and no photos after ordinary section reentry because the native tree omitted a
painted banner; this does not prove immediate announcements or TalkBack.

The APK verifier accepts older `Signer #1` and SDK37 `V2 Signer` output and rejects
unexpected certificates. Maestro owns app startup/readiness after reset/upgrade;
host automation does not probe the accessibility tree before Maestro attaches.
Tests retain explicit assertions, no security bypasses and no retries that hide
deterministic failures. Public passphrases protect synthetic data only.

### Manual TalkBack checklist — still separate

Before production release, verify on a physical Android device:

- Navigation announces Home, History, AI Insights, Statistics and Settings/current state.
- Add Expense fields, category controls, tools and Save/Cancel have meaningful names.
- History details/Delete alternative are reachable and Undo is announced.
- Settings purpose/value and subpage Back are predictable.
- Backup passphrase fields, warnings, Merge/Replace and errors are announced without exposing secrets.
- App Lock announces state/authentication; cancellation leaves the app protected.

## WP33 delivery and remaining roadmap

### WP33 — privacy-safe observability and performance

Local support diagnostics expose inspect/export/clear controls in EN/FR/AR
Settings and remain available after storage initialization fails. Runtime
allowlists sanitize recording, persisted reload and export. Reports include
version/build/schema/backup format, platform, encrypted initialization/migration
state, fixed error/operation codes, bounded durations/status classes and safe
media integrity counts. They exclude amounts, budgets, descriptions, notes,
merchant/receipt text, category activity, photos, backup/CSV contents, PINs,
passphrases, keys, tokens, raw installation identifiers, challenges/signatures,
prompts and financial AI responses. Unknown fields/codes cannot pass through.
Only failures/fallbacks retain timestamps: at most 128 records, seven days and
64 KiB. Successful operations retain fixed aggregate timing buckets. Export is
an explicit local technical-diagnostics file; no tracking/crash SDK or remote
diagnostic upload is added. Clear preserves financial data and current technical
state. Best-effort recording never changes the operation result or failure.

Backend metrics use eight fixed API route labels plus `other`, fixed reason
codes, saturating counters and 512-sample request/provider latency windows
(p50/p95/p99). They cover status classes, 429, aborts, auth/challenge/proof,
malformed/oversized requests, quotas, provider attempts, roles, retries and
fallbacks. A one-minute aggregate report and per-tag ten-message/minute limit
bound emitted logging; host log retention remains an operator responsibility.
Only existing salted scope hashes and allowlisted technical fields are logged.
No request bodies, arbitrary paths/errors, photos or raw AI payloads enter the
logger. No new endpoint or health disclosure is added. Cost bounds are configured
daily admissions × model count × two attempts, not a monetary invoice estimate.

`npm run test:wp33` runs privacy/backend/fixture/large-ledger/equivalence/budget
contracts, then all 25 actual benchmark operations at 0/100/1,000/10,000/25,000
expenses. Seed 330026, UTC and a fixed 2026-10-05 clock isolate calendar behavior;
real monotonic timers, production Argon2id/AES-GCM and every result assertion
remain active. Each Node operation has one warmup and five independent samples,
on fresh synthetic adapters where mutation requires isolation. Two complete
runs establish the baseline. Media inventory scales to 1,000 generated records;
codec cases use generated 4 KiB/5 MiB bytes, not photo decoding or disk I/O.
Node web-memory storage timing is distinct from native SQLCipher timing.
Separately, 100 expenses/32 copies of the existing synthetic JPEG (11,376,864
media bytes) exercise full-media archive creation, decrypt, checksum validation
and restore staging. Every restored byte and attachment record is checked.
Two five-sample runs measured medians 206.35/54.93/97.00/318.49 ms respectively;
warning thresholds are 943.81/181.03/261.60/1,175.66 ms, derived from the same
measured envelope, with no hard timing failure. Environment, samples and source
are in `scripts/wp33/baselines/full-media-windows-node22.json`; the normal WP33
gate measures and compares this case too. This uses isolated media adapters,
not native disk I/O or photo decoding.

Measured Node environment: Node 22.23.3, Windows 10.0.26200 x64, Intel
i7-13620H/16 logical CPUs, UTC, isolated web-memory adapter, production crypto.
The table contains pooled median milliseconds across the two runs. Values
rounded to 0.00 are below the table precision. Exact medians, maxima, MAD,
source SHAs, dates, per-size thresholds and reasons are in
`scripts/wp33/baselines/windows-node22.json`.

| Operation | 0 | 100 | 1,000 | 10,000 | 25,000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| storage.web.init | 0.03 | 0.10 | 0.69 | 5.19 | 14.57 |
| storage.web.read | 0.01 | 0.08 | 0.60 | 4.75 | 15.40 |
| storage.web.persist | 0.01 | 0.15 | 1.44 | 11.63 | 31.20 |
| ledger.initial | 0.01 | 0.02 | 0.06 | 0.27 | 1.10 |
| history.sort | 0.00 | 0.02 | 0.15 | 1.03 | 3.92 |
| history.search | 0.00 | 0.03 | 0.22 | 1.67 | 5.67 |
| history.category | 0.00 | 0.02 | 0.15 | 1.38 | 3.57 |
| history.date | 0.00 | 0.03 | 0.18 | 1.70 | 4.15 |
| history.group.day | 0.00 | 0.11 | 0.41 | 2.71 | 8.03 |
| history.group.category | 0.00 | 0.01 | 0.16 | 1.06 | 3.70 |
| statistics.monthly | 0.06 | 0.21 | 0.40 | 2.28 | 5.74 |
| statistics.all | 0.06 | 3.03 | 3.67 | 11.77 | 23.13 |
| statistics.ranking | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| statistics.detail | 0.41 | 4.96 | 4.74 | 4.96 | 4.75 |
| statistics.localAI | 0.01 | 0.17 | 0.95 | 9.34 | 21.69 |
| backup.v3.create | 24.63 | 30.70 | 71.84 | 546.75 | 1600.66 |
| backup.v3.header | 0.02 | 0.02 | 0.06 | 0.18 | 0.28 |
| backup.v3.decrypt | 22.29 | 22.07 | 23.27 | 24.00 | 30.46 |
| backup.validate.parse | 0.30 | 0.55 | 2.80 | 26.00 | 79.70 |
| backup.restore.prepare | 0.00 | 0.35 | 1.90 | 28.69 | 100.23 |
| backup.restore.replace | 22.58 | 25.50 | 34.24 | 123.46 | 411.02 |
| backup.restore.merge | 23.61 | 26.93 | 41.23 | 220.95 | 828.73 |
| media.inventory.integrity | 0.01 | 0.13 | 0.64 | 0.75 | 2.36 |
| media.codec.small | 0.19 | 0.10 | 0.12 | 0.17 | 0.17 |
| media.codec.large | 10.23 | 10.49 | 9.29 | 9.72 | 14.68 |

The measured envelope is max(observed maximum, median + 6×MAD). Warnings start
at 2× that envelope. Severe failures require **every** repeated sample above
6× the envelope for History search, all-time Statistics or restore preparation
at sizes ≥1,000, on a matching runtime/CPU/platform/timezone/adapter/crypto
environment. Small, crypto-heavy and browser/native timings are warning-only.
Missing/invalid sizes, operations, samples, summaries or correctness receipts
always fail. A changed environment reports incomparable timings explicitly;
Linux runners cannot inherit a certified Windows timing budget. Comparison
never updates baselines. Recollect two isolated Node runs with
`npm run benchmark:wp33 -- <report.json>` and use `createBenchmarkBaseline`
after reviewing measured evidence and environment metadata.

`npm run test:wp33:browser` measures real History/Statistics React rendering,
commit, search and category detail in pinned Chromium 153.0.8010.12, 390×844,
UTC, development mode. All five sizes run in distributed ten-month and
concentrated single-month layouts, with five samples and ID/count/total
assertions. History initial render medians (distributed/concentrated) are
2/2, 8/41, 44/301, 331/1,904 and 548/4,682 ms respectively. Full metric samples,
spread and warning thresholds are in
`scripts/wp33/baselines/browser-windows-chromium.json`. Full DOM rendering at
25k concentrated entries remains expensive; this is not a subsecond or
physical-device responsiveness certification. Tracing is disabled only in
this performance harness because snapshotting the large DOM perturbs timings;
WP32 traces, assertions and flows remain intact.

Measured repairs: restore preparation originally scanned IDs/duplicates
quadratically (10k 933.67 ms; 25k 4,640.47 ms). Indexed candidates now retain the
original strict amount predicate, ordering, duplicate rules and ID mappings;
the reference implementation remains in equivalence tests. Repeated per-row
Intl construction was the second measured bottleneck. A maximum of two number
and nine date/time formatters is retained, never formatted financial values.
Independent EN/FR/AR, currency, DST and timezone-change equivalence tests guard
the repair. Diagnostics, logging, latency rings and listener/timer cleanup are
bounded. Heap deltas are approximate process observations affected by GC, not
retained-heap certification.

Native collection is restricted to a named disposable `wp33-synthetic` debug
emulator, after the normal isolated WP32 restore and before App Lock mutations.
It reads only re-sanitized technical diagnostics and measures three actual
cold encrypted open/read runs without changing credentials or bypassing crypto.
The first full native run on `64093bf` passed all 22 flows, but inspection
rejected its timing receipt: counters were cumulative and the final snapshot
repeated. The collector now preserves diagnostics, requires a changed process
and exactly one new successful init/open/read completion, and derives per-boot
durations with explicit rounding bounds. It sanitizes with the device clock so
host clock drift cannot hide fresh failures. The
[isolated v2-full restore/startup checkpoint](https://github.com/RyanEid06/SpendWise/actions/runs/37345596952)
passes on `e6d2f07a731dad8f46a743123e9ea8d7c5d4226c`. Its verified artifact
11361145196 has SHA-256
`f16522e58759dccf8c0effd71870393b6b875655e3766ef520c0810cfd5a5d6b`;
the compact source/environment/freshness receipt is retained in
`scripts/wp33/baselines/native-api34-first-measurement.json`. All three rows
prove changed processes, counters 1→2→3→4 and encrypted DB/media readiness.
On API 34, a two-core/4 GiB named synthetic debug emulator with one expense and
one photo, protected-storage initialization/open/read median milliseconds are
1,943.61/933.81/12.39; observed ranges are 1,892.09–2,040.50,
915.39–1,218.80 and 8.10–27.59. Rounding bounds are 0.02/0.03/0.04 ms per boot.
These operation timings include plugin overhead and exclude process launch and
UI rendering. Three initial samples do not establish a stable native regression
threshold: native timing remains observational/warning-only, while stale,
failed or incomplete measurements block the collector. No local SDK/emulator
was available. Native
large-ledger rendering, device reboot/OEM timing and physical-device performance
are unmeasured. Existing WP32 migration, encrypted media, backup and Undo gates
remain required.

Validation on implementation head `64093bf0b862cfce1c0dfae673eec40928638817`:
321 unique Node checks (including 74 WP33 and ten signing checks), 37 web checks
and ten five-sample performance browser cases pass. TypeScript/Vite, Capacitor
sync, debug APK and deployed installation-authenticated Gemini smoke pass in
[Android Build](https://github.com/RyanEid06/SpendWise/actions/runs/37318059276),
[web E2E](https://github.com/RyanEid06/SpendWise/actions/runs/37318059277) and
[both isolated native checkpoints](https://github.com/RyanEid06/SpendWise/actions/runs/37318059229).
Production audit has zero findings;
the high-severity full audit passes with three moderate development-only
Capacitor CLI/xcode/uuid findings. The
[full native run](https://github.com/RyanEid06/SpendWise/actions/runs/37339897535)
passes all 22 flows on that implementation head. The collector-only repair
passes 82 WP33 contracts, typed bundling and its isolated native checkpoint;
app/Android/backend/dependency source is unchanged by that repair.
The repaired head also passes
[Android Build](https://github.com/RyanEid06/SpendWise/actions/runs/37345597030)
and [web E2E](https://github.com/RyanEid06/SpendWise/actions/runs/37345596981):
329 unique Node checks, 37 web checks, ten performance cases and deployed smoke.
Its first Build attempt failed at `packageDebug` without a detailed cause;
the same-head isolated APK built successfully and only the failed Build job
was retried. That retry passed without source changes, including packaging and
deployed smoke. This was non-reproducible; the underlying packaging-worker
cause remains unproven. Final
delivery is gated by Build, web/full native and isolated checks on the exact
documentation head, visible in [PR #33](https://github.com/RyanEid06/SpendWise/pull/33).
Android Build runs WP33 after retained
WP32/signing checks and before sync/build; WP32 E2E adds separate browser/native
receipts. Safe compact artifacts have seven-day retention. Checkout selects
the source PR head. WP34 and automatic merge/release remain outside this work.
The first full native run reached clear-before-restore, then its unscrolled
`Clear App Data` selector failed: the action existed below the viewport after
the diagnostics section. Screenshot/accessibility evidence classifies this as
a native navigation assumption. The flow now scrolls to the action and retains
confirmation, erased-state and absent-expense assertions. A real browser check
also reaches/executes clear after expanding diagnostics. The existing isolated
clear-after-full-restore gate runs before retrying full native acceptance.
That isolated gate then exposed a real feedback regression: clear completed
(zero expenses/media and the success text in the accessibility tree), but the
message was above the scrolled viewport. A strengthened browser viewport
assertion reproduced it. Successful clear now focuses and scrolls its result
after modal cleanup; other dialogs retain their focus-return behavior. The
affected 52 Node and three browser clear/Backup v3 checks pass. The native
populated-restore/clear checkpoint now passes with all original assertions;
the full 22-flow gate was restored afterward.

### WP34 — production security and release gate

Depends on WP25–WP33. No feature work belongs in this gate.

- Apply practical main protection, PR/review requirements, green checks,
  force-push prevention, dependency alerts, code/static analysis and secret scanning.
- Gate TypeScript, all regressions, audits/static/secret scans, Android sync,
  native/instrumentation/E2E checks, debug/signed APKs, deployed/secure-auth smoke,
  v1/v2/v3 compatibility, v1.4 migration and encrypted DB/media assertions.
- Verify built-APK non-debuggable/WebView debug settings, no cleartext, correct
  package/launcher/version/certificate, published hash and no test credentials/
  endpoints. Review export-cache cleanup, provider paths and legacy plaintext residue.
- Record toolchain/source/checksum provenance and SBOM. Pin build actions where
  practical. Claim reproducibility only if demonstrated.
- Review storage, crypto, auth, network, platform, code, resilience and privacy
  against the built artifact. Record passed/not-applicable controls and residual risks.
- Manually check clean install and real-data v1.4 update; EN/FR/AR; Light/Dark/System;
  narrow/landscape/tablet; App Lock/Privacy Shield; expense CRUD/Undo/photos/media;
  v3 data/full and v1/v2 imports; merge/replace; offline fallback/backend auth;
  Android Back, process restart, interrupted migration, device reboot and TalkBack.
- Finalize production version from the existing 2.0.0/code 6 baseline. Any new APK
  intended to update build 6 needs a higher versionCode. Verify in-place update,
  then publish through the signed tag workflow with migration/security notes.

Each gate needs evidence tied to the final source/APK. Failed or unverified
controls require a fix or an explicitly approved residual risk and follow-up;
unsupported numerical quality scores do not replace proof.

## Product constraints

WP16 established the original product freeze. Completed UX refinement and
WP25–WP32 hardening preserve the product shape below. The integrated 2.0.0/build 6
signed trial does not add a new product feature set. WP33 observability is
implemented separately on its branch; WP34 remains future work.
Remaining work and acceptance are recorded above.

### Frozen product shape

- Four primary destinations: Home, History, AI Insights, Statistics.
- Settings is a secondary destination opened from the top app bar, not a fifth bottom-navigation tab.
- Add Expense remains manual-first with optional Smart Capture, receipt scanning, and photo attachment tools.
- Dashboard owns expense editing.
- History and Statistics use read-only expense details; History retains delete.
- Media stays private/local by default. Secure Backup v3 separates data-only from data+photos; Backup v1/v2 imports remain compatible.
- Existing compact mobile design remains the product baseline. Tablet/landscape support is a sanity/responsiveness pass, not a tablet redesign.

### Accessibility and interaction baseline

- Interactive controls must expose at least a 48dp-equivalent target.
- Keyboard focus must remain visibly identifiable.
- Reduced-motion preferences must be respected.
- English, French, and Arabic/RTL layouts must remain usable.
- Android Back must close the nearest modal/detail layer first, return from Settings to the prior primary screen, then follow primary navigation behavior.
- Narrow phones remain the primary layout target; wider screens may use modestly wider content without introducing a separate tablet UI.

### Final regression gates

Automated verification must include:

- TypeScript + Vite production build.
- AI reliability, including rate-limit behavior.
- Currency behavior.
- Persistence/migration and restart durability.
- Backup v1 compatibility.
- Backup v2 + media integrity/restore.
- Encrypted native database/media and legacy migration.
- Secure Backup v3, wrong-passphrase/tamper rejection and restore rollback.
- Native/web authentication, key failure and backend replay/expiry/revocation.
- WP15 core UX architecture.
- WP16 navigation/accessibility/freeze architecture.
- Large-ledger statistics and analysis sanity.
- Capacitor Android sync.
- Debug APK build and artifact upload.
- Deployed Gemini backend smoke test.
- Rendered components, browser workflows, accessibility and layout checks.
- Full sequential native acceptance, separate from isolated debug runs.
- Signed APK identity, version and source/checksum receipts.

### Manual Android acceptance before release

- Home / History / AI Insights / Statistics bottom navigation.
- Open and close Settings from every primary destination.
- Android Back from Settings returns to the screen that opened it.
- Add Expense, edit from Dashboard, History delete, read-only details, photo preview.
- Camera/gallery, Smart Capture, receipt scan.
- Media Library, data-only backup, full backup, merge restore, replace restore.
- Offline Gemini fallback and rate-limit error presentation.
- English, French, Arabic RTL.
- Narrow phone, landscape, and one tablet-size Android sanity pass.
- Large ledger scrolling/search/statistics sanity.

### Explicitly not part of this freeze

No social/accounts system, leaderboards, streaks, gamification, ads, cloud account/sync/photo upload system, shared budgets, additional primary tabs, standalone Gallery product, complicated onboarding, or engagement mechanics.

After WP16 acceptance, changes should be bug fixes, compatibility/security maintenance, or explicitly approved new roadmap work rather than opportunistic feature additions.


## Release operations

SpendWise uses one permanent Android signing identity for all long-term APK updates.
Keep the keystore and its passwords safe. If the key is lost, Android will not allow a future APK signed with a different key to update the existing installation of `com.spendwise.app`.

### Versioning

`version.json` is the single source of truth:

```json
{
  "versionName": "2.0.0",
  "versionCode": 6
}
```

For every future release:

- increment `versionCode` by at least 1;
- change `versionName` to the user-facing version;
- when publishing publicly, create a matching tag such as `v2.0.0`.

Android Gradle and the Settings screen both read this file.

### Current published release

- Release: `v1.4.0`
- Version code: `5`
- Tagged commit: `c0d7522192af7e07cbb1f46c3a00145e8b94a988`
- Official signed APK: `SpendWise-v1.4.0.apk`
- Release pipeline: passed and published on 2026-09-30

Latest public-release metadata was checked on 2026-10-04. Source 2.0.0/build 6
is integrated on `main` at `9be8b8f405a4312b221222517623367ac2b446f2` as a signed
trial; it has not replaced the public v1.4.0 release. Automated acceptance and
remaining manual checks are documented in [testing and acceptance](#tests-and-recorded-acceptance).


### One-time signing key setup

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

### GitHub Actions secrets

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

### Local v2.0 trial APK

Version 2.0.0 (build 6) was integrated as a signed trial. The workflow's
same-repository `wp32/e2e-hardening` PR path produced the candidate using the
existing release key; ordinary PRs/main debug builds do not produce a signed
trial automatically. Public signing/publishing remains tag-triggered.

The signing job checks APK package/version, signature and the prior official
certificate. Its artifact includes `SHA256SUMS`, `signature.txt`,
`apk-badging.txt` and `build-receipt.json` with the exact source/run provenance.
Expected certificate SHA-256:

```text
e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965
```

The trial did not create a public release. Physical-device and TalkBack checks,
This earlier WP32 receipt predates WP33 observability; WP34 production
certification remains a separate future gate.

### Normal CI

PRs, manual dispatches and pushes to `main`/`maintenance/**` run the Node
regression suite, Capacitor sync, `assembleDebug` and debug APK upload.
Deployed Gemini authentication smoke runs only on pushes to `main` or version
tags, not maintenance pushes or PRs. Signing secrets are not needed for debug
verification. The separate E2E workflow runs Playwright and conditionally Maestro;
see [testing and acceptance](#tests-and-recorded-acceptance).

The debug APK is for internal testing/distribution only. For a permanent update path that can reliably replace an installed production build without clearing app data, use the signed tag workflow below.

### Publishing a permanent update

Publish a version tag from `main` only after the final release gate and merged
commit's CI are green. The following is the matching tag for the current metadata;
do not run it merely to build a local trial:

```powershell
git tag v2.0.0
git push origin v2.0.0
```

The tag must exactly match `version.json`. The release job will:

1. verify the version/tag;
2. restore the signing key from GitHub Secrets;
3. build a signed release APK;
4. upload the APK as an Actions artifact;
5. publish the versioned APK (for example `SpendWise-v2.0.0.apk`) on GitHub Releases.

The current workflow publishes the APK to GitHub Releases and keeps verification
receipts/checksums in the Actions artifact. Download and verify the release APK
against that receipt before declaring delivery complete. WP34's SBOM and final
built-artifact review remain planned work.

All future release APKs signed with this same key and a higher `versionCode` can update the existing app in place without clearing its local data.
