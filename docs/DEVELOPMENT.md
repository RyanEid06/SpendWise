# Development and maintenance

## Product constraints

Release scope is frozen for 2.1.

- Four primary destinations: Home, History, AI Insights and Statistics.
- Settings is secondary, reached through the top app bar and returning to the previous screen.
- Add Expense stays manual-first; AI suggestions never save without an explicit action.
- Dashboard owns editing; History and Statistics use read-only details. History retains delete/Undo.
- Media stays private/local. Preserve eight-photo limits, warnings, ownership and repair checks.
- Preserve the compact phone layout, 48dp targets, visible focus, reduced motion and EN/FR/AR/RTL.
- Android Back closes the nearest overlay before returning through navigation.
- No social/accounts system or added product expansion is part of the completed release.

## Local runtime

Use Node.js 22 and `npm ci`. `npm run dev` starts the Express API with Vite middleware
at `http://localhost:3000`. `npm run verify` performs TypeScript and production Vite
verification. `npm run preview` serves only the frontend. To serve built `dist/`
with the backend, set `NODE_ENV=production` before `npm start`.

Copy `.env.example` to `.env`; actual defaults and bounds live in `server/config.ts`.

| Setting | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-only provider credential |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_TIMEOUT_MS` | Provider/reliability controls |
| `VITE_API_BASE_URL` | Same-origin locally; deployed HTTPS API for Android |
| `ALLOWED_ORIGINS` | Exact origins; browser `http://localhost:3000`, Android `https://localhost` |
| `SPENDWISE_INSTALLATION_STORE_PATH` | Durable installation public-key/revocation registry |
| `SPENDWISE_DENIED_INSTALLATION_IDS` | Emergency deny-list |
| `SPENDWISE_TELEMETRY_SALT` | Optional server-only scope hash salt |
| `SPENDWISE_API_TOKEN`, `SPENDWISE_LEGACY_AUTH_UNTIL` | Explicitly expiring legacy compatibility only |

Native installations use a non-exportable P-256 Keystore key, one-time backend
challenge and ECDSA proof to obtain short-lived tokens. Browser signing has lower
assurance. Key possession does not attest official-client identity. Persist the
installation registry across backend restarts. Never ship keys in `VITE_*` values.
Origin checks, bounded requests and installation/IP/global quotas remain mandatory.
`scripts/deployed-auth-smoke.mjs` exercises registration, proof and Gemini analysis
on main/tag pushes without printing credentials. Ordinary E2E uses synthetic AI.

## Android and tests

Use JDK 21, Android SDK 36 (minimum 24), `npm run verify`, then `npm run android:sync`.
From `android`, use `.\gradlew.bat assembleDebug` on Windows or `./gradlew assembleDebug` on Unix.

| Coverage | Entry point |
| --- | --- |
| All Node regressions | `node --import tsx --test tests/*.test.ts tests/*.test.cjs` |
| Web/components/accessibility/layout | `npm run test:wp32` |
| Browser performance | `npm run test:wp33:browser` |
| Native full sequence | `wp32-e2e.yml`, manual `native_phase=full` |
| Native affected tail | `native_phase=wp34-tail`; does not replace full acceptance |
| Isolated phase debugging | `wp32-isolated-gates.yml` / `run-wp32-isolated-gate.sh` |
| Encrypted draft recovery | `wp33-5-05-recovery.yml` |
| Signed startup/upgrades and debug FileProvider | `wp33-5-06-candidate.yml` |
| Signature/provenance rejection cases | `tests/apk-signing-verification.test.cjs` |

Native runs require disposable emulators, adb, prepared current/legacy APKs and
pinned Maestro 2.11.0. Emulator mutation guards must reject physical devices.
Harness tests use Git Bash on Windows (`WP32_BASH` can override its path).
Benchmark gates require Node22. Portable archives use the emulator month or an
explicit `WP32_FIXTURE_MONTH=YYYY-MM`.

Inspect logs, accessibility trees, artifacts and history before changing behavior.
Run an affected phase after a minimal repair; retain precisely scoped green
evidence. Final release certification uses full coverage on the final application
inputs. Do not weaken assertions, key failure handling or privacy surfaces.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/`, `server/` | React app, repositories/security and backend |
| `android/` | Native app, Gradle project and instrumentation |
| `tests/`, `.maestro/` | Active regressions, synthetic fixtures and native flows |
| `scripts/`, `.github/` | Build, test, benchmark and release orchestration |
| `docs/` | Current maintenance, security, release and acceptance documentation |

Keep tests and source fixtures even when their names refer to completed packets.
Generated APKs, screenshots, traces, runtime state and secrets belong outside Git.
