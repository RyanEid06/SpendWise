# Deterministic test fixtures

These files are synthetic and non-sensitive. They exist only for executable integration/E2E tests.

- `backup-v1.json`: legacy v1 import fixture with fake expenses/budget.
- `media/wp32-photo-01.jpg` … `media/wp32-photo-09.jpg`: deterministic high-resolution JPEGs used by Android gallery/media E2E. They intentionally avoid sub-400px inputs because the current Capacitor Android gallery stack has an upstream loading-activity race for very small/fast-processing images.

`scripts/wp32-generate-portable-fixtures.ts` creates portable v1/v2/v3 archives in
the ignored `artifacts/` directory. Corruption tests construct their invalid bytes
in memory; they do not require a checked-in corrupt image.

Public test passphrases in test code protect only synthetic fixtures. No real financial data,
private photos, production API secrets, signing material, or release keystores belong in this directory.
