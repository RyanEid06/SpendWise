# SpendWise AI backend

SpendWise uses a small Express backend so the Gemini API key never ships inside the APK.

## Request flow

Android/Web UI -> SpendWise HTTPS backend -> Gemini Developer API

The app sends bounded structured financial data. The server builds the Gemini prompts. Clients no longer submit arbitrary prompts.

## Backend environment

Set these on the deployed backend:

- `GEMINI_API_KEY` — Gemini Developer API key. Server-only.
- `SPENDWISE_API_TOKEN` — long random access token required by production AI endpoints.
- `ALLOWED_ORIGINS` — comma-separated exact origins. Include `https://localhost` for the Capacitor Android app.
- `GEMINI_MODEL` — optional. Defaults to `gemini-3.8-flash`.
- `GEMINI_FALLBACK_MODELS` — optional comma-separated list. Defaults to `gemini-3.7-flash,gemini-3.5-flash-lite`. The legacy singular `GEMINI_FALLBACK_MODEL` is also accepted.
- `GEMINI_TIMEOUT_MS` — optional provider timeout in milliseconds. Defaults to `22000` and is clamped to 5-40 seconds.
- `NODE_ENV=production`

Do not use a `VITE_` prefix for the Gemini key.

## Build and start

```text
npm ci
npm run build
npm start
```

`npm start` runs `tsx server.ts`. In production the server serves `dist/` and the `/api/*` endpoints.

Health check:

```text
GET /api/health
```

The health response never returns secrets. It reports only high-level readiness plus the configured AI timeout.

## APK / GitHub Actions configuration

Set:

Repository variable:
- `VITE_API_BASE_URL` = deployed backend HTTPS URL

Repository secret:
- `VITE_API_ACCESS_TOKEN` = same value as backend `SPENDWISE_API_TOKEN`

The Android workflow injects these at Vite build time.

`VITE_API_ACCESS_TOKEN` is embedded in the APK and can be extracted. It is only a lightweight access gate suitable for this small personal deployment. The Gemini key remains protected on the server. The backend also applies exact-origin CORS checks, bounded request validation, and an in-memory per-IP request limit.

## Multilingual behavior

Gemini is instructed to understand:

- English
- French
- Arabic
- Lebanese Arabic
- Arabizi/transliterated Lebanese Arabic
- mixed/code-switched descriptions

Examples include `2ahwe`, `benzine`, `dawa lal mama`, `taxi 3al jem3a`, and mixed French/Arabic merchant descriptions.

AI prose is requested in the currently selected SpendWise language (`en`, `fr`, or `ar`).

## Deployment notes

Any small Node.js HTTPS host is sufficient. Keep the backend URL stable after it is placed in the APK. If only the Gemini key, model, or server-side prompt changes later, the APK does not need to be rebuilt.

If `SPENDWISE_API_TOKEN` changes, the APK must be rebuilt because the matching client access token is baked in at build time.


## Reliability behavior

All Gemini endpoints use one bounded execution path. Provider requests use the official SDK HTTP timeout, structured JSON schemas, and server-side validation/sanitization. SpendWise performs at most one application-level retry, only for transient transport/provider-unavailable failures. Provider or SpendWise rate limits, authentication/configuration failures, timeouts, malformed model output, and invalid requests are not retried blindly.

AI errors use a small machine-readable JSON contract such as `AI_TIMEOUT`, `AI_RATE_LIMITED`, `AI_TEMPORARILY_UNAVAILABLE`, and `AI_INVALID_RESPONSE`. Provider stack traces, request bodies, images, financial datasets, and secrets are never returned to clients or written by the AI failure logger.


## Model fallback

SpendWise tries the configured primary Gemini model first. If it is temporarily unavailable or rate-limited, the backend advances through the configured fallback models. A 429 is returned only after every configured model is rate-limited. Authentication/configuration failures, timeouts, invalid responses, and invalid requests do not silently switch models.
