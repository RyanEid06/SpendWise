# WP33 validation record

Approved design and seven-task plan were executed inline on
`wp33/observability-performance`. Base/main inspected at
`5ed7acdf2ce84e11200f3cc6f67eae76088a2610`; its Android Build was green before
implementation. Version 2.0.0, Android code 6, schema 1 and Backup v3 are retained.
WP34, automatic merge, release publication and branch deletion are excluded.

## Reviewed implementation

Client diagnostics use runtime allowlists at recording, reload and export;
bounded failures/fallbacks and fixed success aggregates; explicit local controls;
best-effort integration that preserves operation outcomes. Backend observation
uses finite labels, saturating counters, bounded latency windows and rate-limited
technical logging with teardown. No analytics SDK or remote diagnostics upload
was added. Financial values, media contents, credentials and arbitrary error
strings are excluded.

The benchmark runs all 25 operations at all five sizes with deterministic
synthetic fixtures, real production archive/crypto code and assertions for every
sample. Separate browser and full-media receipts retain their environment and
measurement limits. Restore indexes and bounded Intl formatter caches have
independent equivalence references. Measured budgets reject missing/invalid
coverage even when timing environments differ. ROADMAP contains all operation
medians, measured envelopes, thresholds and the unchanged WP34 remainder.

Independent whole-branch review found no critical/privacy issue. Its important
full-media coverage finding was fixed with actual archive/decrypt/checksum/restore
measurements and byte comparisons. Native fixture provenance and non-finite
budget rejection were fixed and reviewed. No actionable finding remains from
the follow-up reviews; no minor finding was deferred.

## Evidence on implementation head

Implementation head: `64093bf0b862cfce1c0dfae673eec40928638817`.
Checkout logs explicitly show this source SHA rather than a PR merge ref.

- [Android Build 37318059276](https://github.com/RyanEid06/SpendWise/actions/runs/37318059276):
  all 310 Build Node checks passed, including 74 WP33 and ten signing-verifier
  checks; actual five-size/25-operation and full-media benchmark gates passed.
  TypeScript/Vite, production audit, full high-severity audit, Capacitor sync,
  debug APK and deployed installation-authenticated Gemini smoke passed.
  Smoke completed at 2026-10-05T13:41:26Z. Production audit has zero findings;
  three moderate development-only Capacitor CLI/xcode/uuid findings remain below
  the established full-audit high-severity gate. Signed release is intentionally
  skipped on this WP33 PR.
- [Web E2E 37318059277](https://github.com/RyanEid06/SpendWise/actions/runs/37318059277):
  22 WP32 Node checks (11 already counted in Build), 37 executable web checks
  (15 component, 11 browser, three accessibility, eight visual), and ten
  five-sample large-ledger performance cases passed. Unique full Node total:
  321. Linux timing comparisons explicitly warn about environment mismatch;
  correctness and coverage still block failures.
- [Isolated native gates 37318059229](https://github.com/RyanEid06/SpendWise/actions/runs/37318059229):
  both `clear-before-v3-data` and retained `import-v3-data` passed. The clear
  checkpoint passed normal onboarding, full v3 restore and all original
  confirmation, completion-feedback and absent-expense assertions.
- [Full native 37339897535](https://github.com/RyanEid06/SpendWise/actions/runs/37339897535):
  all 22 sequential flows passed on the implementation head, including clear,
  encrypted-media corruption, v1/v2/v3 recovery, App Lock and v1.4 migration.
  The timing artifact hash was verified, but its cumulative counts (2/3/3) and
  repeated final snapshot invalidate the claimed fresh startup measurements.
  This is a benchmark-collector bug, not a native application-flow failure.
  The repair requires a changed PID and one new successful init/open/read
  completion, computes per-boot durations with rounding bounds, and preserves
  diagnostics. Device-clock sanitization preserves new failures despite host
  clock drift. An isolated synthetic v2-full startup checkpoint precedes the
  next full run. The corrected isolated evidence is recorded below. Final
  documentation commits are accepted only after exact-head checks in
  [PR #33](https://github.com/RyanEid06/SpendWise/pull/33) pass; the final delivery
  report records their SHA and run IDs without a self-referential commit cycle.

Corrected native collector head: `e6d2f07a731dad8f46a743123e9ea8d7c5d4226c`.
All 82 WP33 contracts pass; the helper, isolated composition, new-failure and
device-clock regressions had valid failing runs before repair. Independent
review identified and verified the fresh-failure fix, then found no remaining
actionable issue. Harness typecheck, bundle and shell syntax pass.

On the corrected head, [Build 37345597030](https://github.com/RyanEid06/SpendWise/actions/runs/37345597030)
and [web 37345596981](https://github.com/RyanEid06/SpendWise/actions/runs/37345596981)
pass 329 unique Node checks (318 Build + 11 additional WP32), 37 web checks,
ten performance cases, actual benchmark/full-media gates, audits, sync, debug
APK and deployed authenticated Gemini smoke. The first Build attempt failed
at `packageDebug` with an unspecified IncrementalSplitterRunnable exception;
the isolated job built the same-head APK successfully. Only the failed Build
job was retried, then passed with no source change. The failure is
non-reproducible; its underlying packaging-worker cause is unproven.

The isolated startup job 111883254732 in run 37345596952 passed the original
v2-full restore and three fresh process restarts. Downloaded artifact 11361145196
was verified against SHA-256
`f16522e58759dccf8c0effd71870393b6b875655e3766ef520c0810cfd5a5d6b`.
The retained compact v2 receipt under
`scripts/wp33/baselines/native-api34-first-measurement.json` proves counters
1→2→3→4 for each operation, all encrypted readiness flags and per-boot rounding
bounds 0.02/0.03/0.04 ms. Median protected-storage init/open/read timings are
1,943.61/933.81/12.39 ms on the one-expense/one-photo API-34 synthetic debug
emulator. These exclude process launch/UI render; three samples provide an
initial observational baseline, not a stable hard native budget or physical
device certification.

The downloaded implementation-head Node/full-media artifact (11348254121) was
verified against GitHub's SHA-256
`716efcf53e6c3316739510e4bc28fda272044827faf45ad9625abf9c0e5cded4`.
Both reports identify the implementation SHA; all five datasets contain 25
operations with five samples. Both budget receipts contain zero failures and
explicit Linux-versus-Windows timing mismatch warnings. These are synthetic
correctness receipts, not a matching-platform timing certification.

The first full native failure was a navigation assumption: Clear App Data
existed below the longer Settings viewport. Scrolling was added without removing
assertions. The next isolated failure was a real feedback regression: clear
completed but its success message stayed above the viewport. A browser viewport
assertion reproduced it before the clear-only focus/scroll repair. Affected
52 Node and three clear/Backup v3 browser checks passed; subsequent isolated
native proof passed. Full native execution was restored only after that proof.

## Acceptance audit

| Requirement | Evidence/status |
| --- | --- |
| 1–2 Diagnostics and forbidden-data prevention | Diagnostic store/integration tests and EN/FR/AR browser controls pass. |
| 3 Useful bounded backend aggregates | Aggregate, request lifecycle, logging suppression, auth/provider and teardown tests pass. |
| 4–5 Deterministic required-size fixtures/benchmarks | Five sizes × 25 operations, one warmup/five samples, every result validated; normal Build gate passes. |
| 6 Large History/Statistics correctness | Independent reference tests and ten real React/browser cases pass. |
| 7 Backup/media reproducible baseline | Two measured Node runs and two full-media runs; archive round trips and every restored media byte checked. |
| 8 Measured budgets | Committed measured envelopes and warning/severe policy; invalid coverage/non-finite/mismatch tests pass. |
| 9 Retained WP25–WP32 regressions | Full Build/web/isolated checks and all 22 native flows pass on implementation head; corrected collector passes the original v2-full restore/startup checkpoint. Final exact-head suite is required through PR checks. |
| 10 TypeScript/Vite | Actual Build and E2E verify steps pass. |
| 11 Dependency audits | Established production and full high-severity gates pass; moderate development findings disclosed. |
| 12 Capacitor sync | Actual Build sync passes. |
| 13 Debug APK | Actual JDK21/Gradle debug build passes. |
| 14 Deployed authenticated Gemini smoke | Actual deployed smoke passes on implementation head. |
| 15 Exact final-head green CI | Completion requires successful Build, web/full native and isolated checks on the final SHA; inspect source checkout logs and PR #33 checks before issuing the final delivery report. |
| 16 No WP34 | Diff preserves version/release boundary; WP34 remains the documented future gate. |

## Rulings I made

1. Reused the existing isolated WP33 worktree; created the plan-owned ignored
   workspace with PowerShell after the Bash helper lacked `basename`. Cost if
   wrong: isolation or plan ownership could be confused. Existing branch/root
   and the ledger ownership marker were verified.
2. Executed independent backend work while the pinned Chromium download was
   live; held client integration uncommitted until its focused browser gate.
   Cost if wrong: shared interfaces could diverge. Joint integration tests passed.
3. Observed MediaService/StorageManager instead of adding attachment-storage
   reads during startup. Cost if wrong: lower-level failures might lack context.
   Failure propagation and sanitized operation diagnostics were tested.
4. Used the unchanged planner as a green correctness reference before indexing;
   the measured slow baseline supplied performance evidence rather than a
   brittle wall-clock failing test. Cost if wrong: a copied-reference blind spot
   could persist. Independent large-ledger and adversarial equivalence tests pass.
5. Disabled tracing only in the WP33 performance harness after full-DOM snapshots
   perturbed 25k measurements; retained profiler correctness, failure screenshots
   and all WP32 traces. Included measured per-row formatter reuse with independent
   equivalence checks. Cost if wrong: performance-only trace context is reduced
   or output equivalence could drift. All ten browser cases and locale/DST tests
   pass; formatter caches contain no formatted financial values.

Deferred minors: none.

No physical-device, large-native-ledger, retained-heap or production-security
certification is claimed. The concentrated 25k History DOM remains expensive.
External host log retention remains an operator responsibility.
