# SpendWise AI backend

SpendWise uses an Express backend so the Gemini provider key never ships in the APK.

## Production request flow

Android UI -> authenticated API client -> installation signer -> SpendWise HTTPS backend -> Gemini

Each Android installation owns a P-256 signing key generated in Android Keystore. The private key is non-exportable and never sent to the backend. Registration sends only the SPKI public key. The backend assigns a random installation ID.

Authentication then uses:

1. a cryptographically random 120-second one-time challenge;
2. ECDSA P-256 / SHA-256 proof over the canonical challenge payload;
3. a random 10-minute bearer access token;
4. renewal through a fresh signed challenge.

This prevents copying one permanent APK bearer value between installations. It does **not** prove that a client is official or unmodified; no attestation signal is claimed.

## Backend environment

Required/important production settings:

- `GEMINI_API_KEY` — server-only Gemini key.
- `VITE_API_BASE_URL` — GitHub Actions repository variable used when building the APK; it must be HTTPS in production.
- `ALLOWED_ORIGINS` — comma-separated exact allowed browser/WebView origins.
- `SPENDWISE_INSTALLATION_STORE_PATH` — path on durable server storage for installation public keys and revocation state.
- `NODE_ENV=production`.

Optional controls include model/fallback/timeout settings, registration and AI quota overrides, `SPENDWISE_DENIED_INSTALLATION_IDS`, and `SPENDWISE_TELEMETRY_SALT`.

### Legacy migration

`SPENDWISE_API_TOKEN` is retained only as an isolated compatibility path for pre-WP31 APKs that still send `X-SpendWise-Token`. New builds do not read `VITE_API_ACCESS_TOKEN` and do not send the legacy header.

When the installed-user upgrade window is over:

1. unset `SPENDWISE_API_TOKEN` on the backend;
2. remove any obsolete `VITE_API_ACCESS_TOKEN` GitHub secret;
3. optionally delete the compatibility branch in a later maintenance WP.

`SPENDWISE_LEGACY_AUTH_UNTIL` may be set to an HTTP-date value so legacy responses advertise a Sunset header.

## Abuse resistance

The backend independently limits registration by IP, challenge/proof traffic by installation and IP, AI traffic per installation and IP, daily installation use, and a global daily provider-cost guardrail. Installation IDs can be revoked in the persistent registry or emergency-denied through server configuration.

Security telemetry is metadata-only and hashes scopes. Financial request bodies, images, authorization credentials, signing material, and Gemini provider secrets are not logged.

## Network policy

Production API requests are HTTPS-only. Android explicitly disables cleartext traffic with a Network Security Configuration. The API sets conservative response headers and exact-origin CORS behavior. Certificate/public-key pinning is intentionally not used because a safe rotation + backup-pin design is not currently deployed; platform TLS validation remains the trust boundary.

## Request limits and reliability

Authentication JSON is limited to 64 KiB. Financial JSON routes are limited to 512 KiB after the authenticated 16 MiB parser ceiling. Image payloads retain the existing 12,000,000-character image bound inside a 16 MiB request ceiling.

Gemini execution remains behind `GeminiService`. Existing model fallback, bounded retry, provider timeout, validation, normalized errors, and financial safety behavior are unchanged.

## Health

`GET /api/health` returns only high-level readiness:

- `ok`
- `aiConfigured`
- `authentication`
- `legacyCompatibilityEnabled`

It never returns keys, tokens, installation records, model secrets, or authorization material.

## CI / deployed smoke

The WP31 regression test validates registration, signed proof, replay rejection, expiry, revocation, quotas, malformed/oversized requests, legacy compatibility, logging boundaries, and Android cleartext policy.

On `main`, GitHub Actions runs `scripts/deployed-auth-smoke.mjs`, which performs:

registration -> challenge -> signed proof -> short-lived access token -> live Gemini analyze request.

No private key or access token is printed to CI logs.
