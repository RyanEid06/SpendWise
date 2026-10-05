# WP33 design for review

Status: approved design, implemented and accepted in PR #33 on `e10e959`, then
merged at `dc60070`. The original design and starting-point observations below
are historical; current delivery/release status is in [ROADMAP](../../../ROADMAP.md)
and [validation](../plans/2026-10-05-wp33-validation.md).
Scope: Privacy-Safe Observability + Performance Baselines only.
User specification: the supplied `goal-objective.md`, Parts A-H and acceptance 1-16.
Original execution branch: `wp33/observability-performance`; the original scope
excluded merge/deletion. After completion the user authorized both, conditional
on green merged-main CI. The branch is removed; its history and PR are retained.

## Intent and verified starting point

Diagnose technical failures without collecting financial content or user behavior,
and measure whether existing ledger operations remain responsive at scale.
There are no accounts, sync, advertising, analytics SDKs, session replay,
screenshots, remote financial diagnostics, product features or UI redesign.
WP34 production certification and release work are excluded.

On 2026-10-05, fetch and the live GitHub branch query both identified main as
`5ed7acdf2ce84e11200f3cc6f67eae76088a2610`. The clean worktree matched it.
[Android Build 37234446017](https://github.com/RyanEid06/SpendWise/actions/runs/37234446017)
succeeded on that exact commit. Job-step inspection confirmed audits,
TypeScript/Vite, all retained Build regressions, APK-verifier checks,
Capacitor sync, debug APK and deployed installation-authenticated Gemini smoke.
The roadmap separately records WP32's earlier 22/22 native and 54 web checks;
these are historical receipts, not new executions on this worktree.

Current architecture has suitable integration boundaries: `src/main.tsx`,
`LocalDataStoreImpl`, `NativeEncryptedDatabaseService`, `AttachmentStorage`,
`BackupService`, `AuthenticatedApiClient`, and the Express middleware/service
composition. Existing cryptography and authentication remain authoritative.
Database schema is version 1; portable backup is version 3; app is 2.0.0/code 6.

## Approach and alternatives

Recommend an internal, runtime-validated diagnostics module, bounded backend
aggregates, and synthetic benchmark tooling using existing dependencies.
Console-only diagnostics would be harder for users to inspect/export and would
not establish a reusable privacy boundary. An external observability SDK would
add collection/consent and provider dependencies beyond this package's needs.

## Client diagnostics privacy boundary

Add a focused diagnostics service under `src/services/` with no dependency on
expense objects, backup contents, request bodies, credentials or binary media.
Use runtime allowlists, not merely TypeScript types or string truncation.

Allowed report fields:

- Constant report format/version and app version/build.
- Platform enum; Android version only when safely available through an existing
  supported API. Report unavailable explicitly rather than parse user-agent data.
- Database schema and allowlisted migration phase; storage/media initialization
  status and capability booleans already obtained by normal initialization.
- Backup format 3 and technical crypto/capability availability.
- Stable operation/error enums, coarse HTTP status class, sanitized authentication
  failure category, retry/fallback booleans, internally generated timestamps and
  finite bounded durations.
- Aggregate media/integrity counts when obtained during existing work or an
  explicit support action. No filenames, paths, attachment/expense identifiers,
  category/kind timelines, or financial totals.

No generic context dictionary is accepted. Unknown strings become a constant
unknown code or are omitted. Never serialize error messages, stacks, provider
errors, object spreads, or arbitrary input. The exporter constructs a fresh
allowlisted report and sanitizes persisted input again. This rejects tampered
storage and prevents an unsafe future caller from bypassing export validation.
Diagnostics recording/export failure must never fail ledger initialization,
authentication, persistence, backup, Undo, or media operations.

Keep at most 128 technical failure/recovery records, expire records after seven
days, and cap serialized persisted diagnostics at 64 KiB. Retain safe startup
state and bounded aggregate timings separately. Persist technical records in a
dedicated local key so a process restart does not erase the previous failure;
exclude this key from every backup/CSV format. Clear corrupt/unrecognized
diagnostic state independently of financial state. No recurring background scan.
Do not record a chronological feed of expense CRUD, searches, categories,
navigation, authentication successes or other user activity.

Instrument secure bootstrap, protected storage open/schema/migration, encrypted
media initialization/integrity failures, Backup v3 failures, normalized API/auth
failures and local AI fallback. Operation success timing is a bounded technical
aggregate, not a retained user-action event.

Replace the raw Undo commit `console.error(..., error)` with a constant safe
diagnostic code, preserving rollback and the existing user-visible error.

Provide a small support action in the existing Settings information area:
inspect the technical report, export it explicitly, and clear diagnostics.
Localize explanation/actions for EN/FR/AR. The export is named
`SpendWise-technical-diagnostics-<date>.json`, uses the existing file export
boundary, and never uploads automatically. Explain that the file contains only
technical diagnostics; the user chooses whether and where to share it.
Keep support data available without opening damaged financial data where the
existing startup failure surface permits a narrowly scoped export action.

## Backend aggregates and safe logging

Add an observability module with fixed route, failure, status and model-role
dimensions. An outer `/api` middleware starts before HTTPS/CORS/auth/body parsing
so rejected requests count too. Completion/abort handling must count each
request once and detach listeners. Unknown routes use a constant other label;
never store or print path/query strings supplied by clients.

Collect request count/success/error/status class/429/abort and request latency;
sanitized auth/challenge/proof failures; malformed JSON, invalid payload and
oversize rejection; quota rejection categories; provider attempts/success/failure,
attempt latency, retry and fallback-model use. Capture provider attempts through
the existing Gemini reliability/service boundary without touching prompts,
images, responses, validation results or provider error messages.

Latency retains at most 512 samples per fixed operation. Snapshot p50/p95/p99
are explicitly approximate percentiles of this recent sample window, while
counters describe the process lifetime and reset on restart. Saturate counters
at safe integer bounds. No maps keyed by arbitrary user strings or model names.
Models use primary/fallback position labels; no secrets/config dumps.

Use existing salted `securityScopeHash` only if an existing security log needs
a scope. Aggregates require no installation/IP grouping and retain no identifiers.
Sanitize existing AI/security/API log boundaries using the same fixed enums.
The existing `req.path` unhandled-error log is replaced by a safe route label.
Rate-bound repeated error output and report suppressed counts; export a bounded
summary at a low fixed cadence from the server lifecycle. Clean up any timer on
shutdown and avoid holding the process open for observability.

Operators inspect structured stdout summaries. No new public diagnostic or
metrics endpoint; `/api/health` keeps its existing four-field public contract.
No growing log files or diagnostics history is created. Host stdout retention
remains an infrastructure limitation that must be documented.

Expose provider-call counts and configured daily admission bounds, with the
existing model-count/two-attempt ceiling distinguished from admitted API calls.
Do not present admission quota as an exact token spend or dollar estimate.

## Deterministic benchmark and correctness fixtures

Generate fixtures at 0, 100, 1,000, 10,000 and 25,000 expenses from a fixed seed
and fixed calendar range. Include representative category distribution, cents,
ties, repeated descriptions/notes and ID-conflict/duplicate restore cases.
Also exercise a concentrated single-month ledger for History rendering.
Freeze the benchmark clock and record timezone. Do not patch production clocks.
Fixtures and correctness references are test/tool code, never a production bypass.

Benchmark existing operations, consuming and checking outputs:

| Area | Measurements |
| --- | --- |
| Storage/startup | Isolated web persistence/init, financial validation/cloning/read; native encrypted open/read and migration only in an actual Android run |
| History | Initial selection/preparation, search, category/day filtering, sorting, day/category grouping |
| Statistics | Monthly ledger, all period totals, category totals/ranking/trends/detail preparation, largest-expense ranking |
| Local AI | Deterministic historical summary and local statistics/trend explanation |
| Backup | Real v2 ZIP payload + v3 Argon2id/AES-GCM creation, bounded header validation, decrypt/parse, replace/merge planning and adapter-backed restore |
| Media | Inventory/integrity analysis at useful scales and real authenticated codec work on bounded generated bytes; representative full-media backup separately |
| Browser | Actual History/Statistics preparation/render/search on synthetic fixtures; report browser environment separately |

Node restore uses fresh in-memory financial/media adapters for every sample.
Web persistence uses an isolated KeyValueStore. Browser runs use a separate test
context. Android measurements use a dedicated emulator containing only fixtures;
do not reset, seed or benchmark a user's physical device or existing data.
Native measurements retain SQLCipher/Keystore protections. No crypto shortcut,
lower KDF cost, auth bypass, or production test endpoint is introduced.

Do not label Node persistence, AES-GCM byte work or mocked adapters as native
SQLCipher, native media enumeration, real JPEG decoding or end-to-end restore.
Distinguish pure preparation from actual rendering. Capture native startup/open
when reproducible using existing native harness infrastructure; if unavailable,
report that gap and the reproducible alternative without claiming equivalence.

Use warmup followed by repeated independent samples, median, spread and sample
count; expensive crypto samples may use fewer repetitions with that count shown.
Separate fixture setup from measured work, but include allocation/serialization
that belongs to the operation. Report environment, Node/browser/toolchain,
source SHA, dataset/operation and approximate resource measurements with limits.
Generated large archives/media stay under ignored `artifacts/wp33/`.
Commit only compact baseline summaries and generated fixture code.

Large-ledger correctness compares results with independent reference calculations,
not functions calling themselves. Check integer-cent references within current
currency rounding semantics, input immutability, stable ordering/ties, filters,
category/month totals, local AI summaries, backup round-trip/merge deduplication,
currency mismatch rejection, persistence restart and staged delete/Undo behavior.
Run existing WP29 native encrypted-persistence assertions as well; do not infer
encrypted native correctness solely from a Node/web round trip.

## Measurement-derived budgets and optimization

Measure before selecting any timing threshold. Preserve pre-optimization
measurements for the same fixtures/environment. Budget generation records the
reference median, variation, dataset/operation, threshold, severity and rationale.
Runner/environment mismatches produce a clear incomparable/warning result and
do not silently certify a regression budget.

Use warning thresholds for noisy, browser/native startup and cross-environment
timings. CI-block severe repeated regressions only where measurements show a
stable operation and relative comparison is defensible. Keep deterministic
correctness, bounded-state, benchmark completeness and budget validation failures
hard blocking independently of timing. Never refresh a baseline during the gate,
silently skip required sizes/operations, or lower an assertion after failure.

The inspected backup merge planner uses growing-array duplicate/conflict scans,
creating a clear quadratic path. If measurements justify indexing it, preserve
both duplicate predicates, normalization, strict `abs(amount difference) < 0.001`,
createdAt/date behavior, import order and ID reassignment. Add boundary and
collision regressions plus comparison with the original reference algorithm
before the optimization. A rounded-amount fingerprint alone is not equivalent.
History's repeated sorts and Statistics' per-category month lookup are measurement
candidates, not automatic reasons to refactor. No unrelated cleanup.

## Tests, CI and delivery sequence

1. Add failing focused privacy/bounds and backend aggregate tests, implement their
   safe contracts, then instrument existing boundaries and Settings support.
2. Add deterministic fixture/reference correctness checks and benchmark execution.
   Collect baseline evidence before timing budgets or optimization.
3. Make only evidenced scaling fixes, verify equivalence and remeasure.
4. Implement/test budget validation, comparison, warning/failure behavior and
   baseline environment rules. Retain the measurements and explanations.
5. Add `npm run test:wp33` to Android Build after WP32 harness/signing regressions
   and before Capacitor sync/build. Retain every existing gate. Preserve artifacts
   needed to inspect budget warnings without including financial data.
6. Run the complete normal CI-equivalent suites once focused changes are stable:
   retained Node suites, all WP32 web suites, WP33, TypeScript/Vite, both audit
   gates, sync, debug APK, deployed authenticated Gemini smoke. Verify native
   acceptance on the final head through existing workflows when needed by the
   touched storage/backup/auth flows. No retries concealing deterministic failures.
7. Update ROADMAP with actual diagnostics, methodology, per-size measurements,
   thresholds, CI receipts, bottlenecks/fixes and known limitations. WP34 retains
   its production release/security/device/TalkBack gates.
8. Commit/push only the WP33 branch with explicit staging. Obtain green CI on the
   exact head, and provide the requested 13-item final report and merge YES/NO.
   Do not merge, publish a release, change app version, or delete the branch.

Privacy regressions inject unique forbidden sentinels in amounts/budgets,
descriptions/notes/merchant/receipt/category data, media/file names, backup/CSV,
PIN/passphrase/key/token/challenge/signature/installation ID, provider prompt and
response/error fields. Exercise runtime recorder, persisted-data reload, report
construction/export and actual console boundaries, including unknown routes.
Test bounded history/bytes/expiry, poisoned records, storage write failures,
request abort/double completion, fixed cardinality, percentile window and timer
cleanup. Ensure malformed/oversize/quota/auth/provider paths update the intended
aggregate and health responses expose neither aggregates nor secrets.

## Current verification limits

The starting CI is verified; there is no local WP33 implementation or benchmark
result yet. This worktree has no installed node_modules. Its default Node is
24.18.0, whereas package/CI requires Node 22; use a supported Node 22 runtime for
comparable local evidence. No physical-device performance measurement or
production certification is claimed. Unavailable runtime/emulator/deployed smoke
capacity must be reported explicitly, never converted into a passing gate.
