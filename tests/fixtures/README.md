# WP32 deterministic fixtures

These files are synthetic and non-sensitive. They exist only for executable integration/E2E tests.

- `backup-v1.json`: legacy v1 import fixture with fake expenses/budget.
- `wp32-photo.jpg`: tiny deterministic JPEG used by Android gallery/media E2E.
- `corrupt-image.jpg`: intentionally invalid image bytes for corruption handling.

Public test passphrases in WP32 test code protect only synthetic fixtures. No real financial data,
private photos, production API secrets, signing material, or release keystores belong in this directory.
