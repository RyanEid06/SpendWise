# WP32 acceptance and v2.0 trial APK handoff

Updated 2026-10-04. Read `WP32_ISOLATED_DIAGNOSTIC_REPORT.md` for complete
repair classifications and source/run evidence. This handoff supersedes the
earlier pending diagnostic checkpoints. User approval now includes green
main integration, proven merged-branch cleanup, and signed APK delivery to
Desktop; the original no-merge instruction is superseded. No WP33/WP34.

## Verified WP32 automation

- Source: `253639e561c9ed822ea9ab892b32125d4d81eb4e`.
- All **22/22 isolated native targets** proved. Final targeted data-only restore
  passed run `37219280680`, attempt 2, job `111508850698`.
- Full sequential native: **GREEN: 22/22 passed together**, run `37227530296`, native
  job `111510178359`. First final attempt `37217373384` stopped after 12
  passes on a painted but native-tree-omitted receipt. The renewed run follows
  a reviewed test-only section-reentry repair, preserving every assertion.
- Android Build `37219280661`, job `111486131378`: GREEN, **226 Node tests**,
  dependency audits, TypeScript/Vite verification, Android sync/build/artifact.
- Final-run web `111510178323`: GREEN, **54 tests** (22 Node, 32 Playwright).
- Complete proposed source through the dependency integration and new test
  observation step received independent review with no confirmed defects.

## Version and APK provenance

Version metadata is **2.0.0**, Android code **6**, package `com.spendwise.app`.
Current-version assertions are aligned; legacy v1.4 fixture source and test
payload versions remain frozen. The same-repository WP32 PR signing job checks
out its exact head, builds with the existing release key, verifies signature,
package/version and prior official certificate, and archives SHA256SUMS,
signature/badging output plus the source/run receipt. Publishing stays tag-only;
the user requested a local trial APK, not a new public GitHub Release.

Official v1.4 APK download hash:
`eb641a73b2f5568a9036ce7baea23bc7beda72008b0f918ae12c566fb8525da2`.
Certificate SHA256, also matching v1.3:
`e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965`.
The candidate must match that signing identity before delivery to
`C:/Users/Administrator/Desktop/SpendWise-v2.0.0.apk`.

The first signed candidate run `37229468655` built successfully and apksigner
verified that exact certificate. Its receipt parser failed because SDK37 prints
`V2 Signer: certificate SHA-256 digest:` instead of the older
`Signer #1 certificate SHA-256 digest:` format. The corrected verifier accepts
both formats, rejects every unexpected identity, and has 10 executable workflow
regressions. Candidate artifact verification is required before merge/delivery;
the earlier failed run uploaded no signed artifact.

PR #31 Share/Lucide maintenance is retained in WP32 merge ancestry. Use a merge
commit for PR #30, inspect all PR states, require post-main Build/backend smoke,
then delete only branch tips proven ancestors of accepted main. Exact final
candidate/merge/delivery hashes are recorded in signing and completion receipts.

## Preserved work and remaining manual checks

- Preserve the user's uncommitted `tests/e2e/browser/backup.spec.ts` contrast
  edit and untracked `SpendWise-v1.3.0-release/` folder. The additional unpublished
  light-theme contrast test failed locally; it is not included in the green
  published test count. The dark-theme check passed.
  To satisfy the latest request for matching tracked local/main files, back up
  this unpublished edit first, then restore the tracked file from accepted main.
  Keep the untracked old APK folder and the backup.
- Physical-device installation/use and the manual TalkBack checklist in
  `WP32_TESTING.md` remain separate from automated WP32 acceptance. The tests
  do not prove process-kill recovery, OEM behavior or immediate native status
  announcements. The data-only receipt is required after ordinary reentry.
- Repo stays public as authorized; included private Actions allowance was
  exhausted across the account, and public runners now execute normally.
- Remote work uses the GitHub connector. Local Git can synchronize verified
  objects/ref/index without overwriting user edits; remote Git crashes on this
  machine. CLI `gh api` is the authorized branch-deletion fallback because the
  connector has no delete-branch operation. No computer/UI access is needed.
