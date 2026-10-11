# WP35 private phone-test APK

User-authorized unpublished candidate: version **2.1.1**, Android code **11**.
All three WP35 lanes remain on `codex/wp35-integration`; main remains
`7d00b2dafadf829f63d2b6074b08d08c00ca352d`. No backend deployment or public release occurred.

- Exact APK source: `066d55166a6a6b96aa0d3a7fc4e3d2759ffd0ba8`.
- Build: https://github.com/RyanEid06/SpendWise/actions/runs/38141990211 — successful.
- Private artifact: `SpendWise-WP35-test-066d55166a6a6b96aa0d3a7fc4e3d2759ffd0ba8`.
- Desktop APK: `C:\Users\Administrator\Desktop\SpendWise-WP35-v2.1.1-test.apk`.
- Size: 17,725,842 bytes.
- SHA256: `dd4696f0a49cd613fb7d1df0282952f4f13fa37b34f2a8a91442d9e731610db7`.
- Permanent signer SHA256: `e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965`.
- Desktop checksum: `SpendWise-WP35-v2.1.1-test.apk.sha256`.

Fresh Node22 checks: 505 passed, zero failed, one isolated-DB local skip;
TypeScript/production build passed. Build CI repeated the synthetic regressions
and web/native build; the previously passed Android matrix was intentionally
skipped for this packaging-only dispatch. Combined browser, real PostgreSQL,
API36, encrypted recovery and API34 receipts remain in WP35_INTEGRATION_REVIEW.md.

Independent local Google apksig cryptographic verification passed with the
permanent certificate and v2/v3 signatures. Parsed compiled manifest confirmed
package `com.spendwise.app`, version/code, non-debuggable, backup disabled,
cleartext disabled and non-exported providers. ZIP integrity, embedded source/run
identity, configured HTTPS endpoint, metadata, CycloneDX component version and
artifact hash matched. Desktop copy hash independently matched; no file was
overwritten. Evidence: `artifacts/wp35-private-apk-38141990211/`.

The APK points to `https://spendwise-api-v9sv.onrender.com`, which still runs old
main. Client/visual phone testing is possible; full WP35 backend acceptance needs
the durable authentication-store cutover first. The user has created a Neon
Frankfurt project and reports successful owner-run table creation. Restricted
runtime credentials, complete existing device/revocation preservation, Render
configuration/deployment and physical acceptance remain pending. Expenses,
photos and encrypted drafts stay on the device. No live Google request, physical
installation, tag or public release was performed by this packaging operation.
