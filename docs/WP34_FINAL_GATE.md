# WP34 — UI polish and production release certification

## Scope and version

This patch addresses four owner-approved UI issues only: properly padded original
light/dark Android system splash icons; capitalized English Photos labels;
History-style All / Day / Category filtering in Media Library with warnings and
repair retained; and removal of the normal Settings build-number display.

The approved secure lock screen, device authentication, native lifecycle, media
integrity implementation, encryption and backup formats must not change.

**Release target:** SpendWise **2.1.0 / Android versionCode 10** (higher than the
existing 2.0.2/code 9). Do not bump version or publish until all relevant gates
below pass on the exact final commit. The older WP33.5-06 candidate workflow is
hard-coded for 2.0.2 and is historical, not the 2.1.0 release workflow.

## Gates; evidence still required

- [ ] Baseline commit verified to contain the Honor startup/lifecycle repairs.
- [ ] `npm ci`, `npm run verify`, regressions including WP34, and dependency audits.
- [ ] Android Capacitor sync, Gradle debug build and applicable static checks.
- [ ] Web E2E and full native suite with `wp32-final-native` PR label.
      For freeze-branch repairs, the owner authorized `wp34-tail`: restore the
      established encrypted two-expense/nine-photo fixture, check WP34 UI, then
      run every remaining backup, compatibility, benchmark, lock and upgrade phase.
      Earlier green phases retain their recorded source evidence. This targeted
      run is not full-native acceptance; run `native_phase=full` on final main
      before release. Main and other PRs default to the full sequence.
- [ ] Maestro WP34 accessibility/UI behavior checked and non-sensitive Settings screenshot inspected.
      Media Library is FLAG_SECURE and intentionally cannot be screenshot-captured;
      do not weaken this privacy protection for visual tests.
- [ ] Real first-second system splash frames reviewed in Light and Dark with
      ADB screen recording begun **before** cold launch (`scripts/wp34-record-splash.sh`); no mask clipping.
      Repeat after selecting Dark mode for the second theme.
- [ ] Cold/warm starts and lock/cancel/retry on emulator; physical device later.
- [ ] Corrupted-media warning and repair remain reachable; healthy card hidden.
- [ ] 2.1.0 / code 10 bump in `version.json` and `package.json` after tests,
      plus coordinated adjustment of hard-coded version assertions in regressions.
- [ ] Current signing identity and installed-user-data upgrade verified.
- [ ] Release APK manifest, non-debuggable/WebView restrictions, no cleartext,
      key/provider/file export paths and embedded artifacts audited.
- [ ] Dependency alerts, secret scanning, SBOM, provenance and APK SHA-256 receipt.
- [ ] Offline/network/backend/auth and v1.4/v1/v2/v3 compatibility smoke checks.
- [ ] Manual EN/FR/AR, Light/Dark/System, landscape/narrow UI and TalkBack.
- [ ] Owner signs off the signed APK on Honor without uninstalling app.
- [ ] Only then merge, tag `v2.1.0` and publish using normal `android-build.yml`.

A test not executed or a visual not inspected must be marked **unverified**,
not green. Signing credentials and real data must never be included in test ZIPs.
