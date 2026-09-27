# SpendWise AI backend

SpendWise uses a small Express backend so the Gemini API key never ships inside the APK.

## Request flow

Android/Web UI -> SpendWise HTTPS backend -> Gemini Developer API

The app sends bounded structured financial data. The server builds the Gemini prompts. Clients no longer submit arbitrary prompts.

## Backend environment

Set these on the deployed backend:

- `GEMINI_API_KEY` â€” Gemini Developer API key. Server-only.
- `SPENDWISE_API_TOKEN` â€” long random access token required by production AI endpoints.
- `ALLOWED_ORIGINS` â€” comma-separated exact origins. Include `https://localhost` for the Capacitor Android app.
- `GEMINI_MODEL` â€” optional. Defaults to `gemini-3.8-flash`.
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

The health response never returns secrets.

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
