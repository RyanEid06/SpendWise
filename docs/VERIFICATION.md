# SpendWise 2.1 automated verification

Release target **2.1.0/code10**, package `com.spendwise.app`.
Final automated application source:
`d6838dc076913801239de74ab92577b6c7beb30c`.
The later documentation cleanup changes current documentation and two documentation
assertions only. Application, dependency lock, Android, workflow, runner and native
fixture inputs retain the tested tree. The published receipt records the final tag SHA.

| Gate | Actual result | Evidence |
| --- | --- | --- |
| Android debug, dependency gates and deployed authenticated Gemini | Passed | [37968566745](https://github.com/RyanEid06/SpendWise/actions/runs/37968566745) |
| Full sequential native + executable web | Passed; 26 retained native JUnit flows, zero failures/errors | [37968599647](https://github.com/RyanEid06/SpendWise/actions/runs/37968599647) |
| Encrypted recovery | 33/33 native flows; at-rest, reboot/keyguard, process death, photo/Edit recovery | [37968604977](https://github.com/RyanEid06/SpendWise/actions/runs/37968604977) |
| Node22/component/Playwright regression | 443/443 Node, 39 components, 48 Playwright | [37968604977](https://github.com/RyanEid06/SpendWise/actions/runs/37968604977) |
| Actual permanent-signed API36 startup/upgrades | 19/19 retained flows, zero failures/errors | [37968610165](https://github.com/RyanEid06/SpendWise/actions/runs/37968610165) |
| API36 FileProvider instrumentation | 3/3, zero failures/errors | [37968610165](https://github.com/RyanEid06/SpendWise/actions/runs/37968610165) |

Both retained signed upgrade receipts passed: populated2.0.1/code7 through actual
2.0.2/code8 installed without launching, then2.1/code10; and populated actual
2.0.2/code9 to2.1/code10. Budget1250 and the exact synthetic expense were read through
production storage after same-certificate updates. This establishes emulator
functionality, not the owner's physical data/phone acceptance.

The tested signed candidate SHA-256 is
`42dde15a5480706f5009ed33993f5ad52945ed9ad5f66e4d0bbc0fc2523c0f6d`.
This is a candidate identity; use the public release `SHA256SUMS` for the final asset.
Independent Google apksig verification confirmed a valid V2 signature and the
permanent certificate. Decoded compiled manifest checks found non-debuggable,
backup-disabled, cleartext-disabled configuration and non-exported providers.
Embedded Capacitor config retained HTTPS/encryption, without a remote server,
WebView debugging or mixed-content override. Native64-bit ELF and ZIP16KiB alignment
passed. Packaged PNG pixel identities match the padded original splash resources.
CycloneDX SBOM and exact source/build receipt are retained with signed artifacts.

The actual Settings screenshot was reviewed: version2.1.0, nine-photo summary,
no build-number row and no clipped Settings rows. Prelaunch Light/Dark videos
were retained and inspected. Light contains visible branding; Dark and other
intervals contain protected black frames. These recordings do not establish a
complete first-second system-splash/no-mask-clipping or no-black-transition visual
pass. No privacy protection was weakened; that visual acceptance remains with
the owner phone trial.

Local Gitleaks8.30.1 binary was verified against publisher checksums. The exact
current source tree had zero findings. Scanning586 historical commits yielded one
false positive, verified from source: a public localStorage metadata namespace,
not an API credential. Hosted Dependabot alerts were disabled and secret-scanning
API permissions were unavailable; those services are not represented as green.
CI enforces production moderate-or-higher and overall high-or-higher npm audit
thresholds. Three development-only moderate findings did not breach those gates.

Native artifact names containing `failure` are historical upload names: the run
above concluded success and its retained26 reports contain no failures/errors.
Generated evidence and complete pre-cleanup Git/file backups are kept locally
under ignored `artifacts/wp34-release-monitor/`, not committed with financial data.

The owner authorized publication followed by phone trial.
[Physical Honor, TalkBack and manual visual acceptance](MANUAL_ACCEPTANCE.md) remain pending.
