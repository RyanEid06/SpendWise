# WP38 execution ledger

Plan: [WP38_PLAN.md](WP38_PLAN.md). Baseline: `16ea6870243d67daa28cfbc6e5d0e1126416fe47`, verified against remote main on 2026-10-14. Clean before branch creation. Branch: `codex/wp38-auth-gemini-reliability`.

## Authorization and rulings

- Owner authorized implementation, required file updates, private signed 2.1.4/code14 APK and GitHub verification. No merge, public release, branch deletion, production deployment or Render changes. Phone acceptance and Render checks are deferred to the owner. Use normal Windows GitHub credentials outside the sandbox; idle during long CI.
- Ruling: reuse the clean current checkout on the dedicated branch; no extra worktree or user questions. This meets the requested isolation without adding a checkout.
- Ruling: necessary private build workflow metadata/branch changes are delivery plumbing within WP38. Preserve immutable-source, package, endpoint and permanent certificate guards.
- Ruling: Home/cancel must invalidate the interrupted authentication; fresh foreground authentication and established nonzero lock timeouts remain supported.
- Ruling: candidate readiness, automated verification, physical acceptance and effective production routing are reported separately. Missing phone/Render evidence is not a green claim.
- Pre-flight: A/B share prompt copy and lock presentation; keep semantic security-operation titles distinct. C is independent of A/B; Gemini validation and existing deadline/attempt contracts remain binding.

## Work checklist

- [ ] A: native prompt routing, terminal cleanup, stale callback rejection, safe bounded recovery, protected-key verification, diagnostics and regression tests.
- [ ] B: exact Arabic copy, RTL/brand isolation, unchanged EN/FR design and regressions.
- [ ] C: bounded invalid-response alternate, quota controls/handlers, protected fallback cleanup and regressions. Render/live checks deferred.
- [ ] Delivery: 2.1.4/code14, guarded private workflow, documentation, full relevant automated checks, final Luna High review, exact-source CI/private APK and independent artifact verification.

## Evidence

- Before-state: local fallback preparation precedes try/finally in Analysis/Statistics; invalid JSON/schema is terminal; main AI buttons can bypass quota Retry suppression. Native cancellation retains pending/cancelling markers beyond active-session cleanup; exact phone symptom remains unverified without logcat.
- Locked dependencies restored. Installed host runtime is Node24 (project/CI requires Node22); authoritative CI uses Node22. No dependency versions changed.
- Targeted clean-baseline tests: 70 passed, 0 failed. Sandbox TypeScript completed but Vite/esbuild failed with directory access denied; normal Windows `npm run verify` passed (existing bundle-size warning only).
- Arabic native brand isolation regression failed on the original unisolated title, then passed with all 20 existing WP37 authentication tests (21/21). Arabic narrow browser regression reproduced missing root RTL; concurrent test server lifetime interrupted EN/FR cases, to rerun sequentially.
- Private build workflow now permits the dedicated WP38 branch and enforces 2.1.4/code14 metadata. Permanent signer/package/source/HTTPS guards retained. Artifact execution and independent verification remain pending.
- Native pinned-library evidence: official AndroidX biometric1.1.0 sources downloaded to ignored artifacts. Both Fragment and Activity constructors use an Activity-scoped BiometricViewModel; new per-fragment prompt owners alone cannot isolate stale callbacks. Authentication implementation must isolate the entire attempt owner.
