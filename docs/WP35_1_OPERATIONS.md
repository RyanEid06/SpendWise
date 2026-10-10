# WP35.1 review and deployment runbook

WP35.1 only, based on `7d00b2dafadf829f63d2b6074b08d08c00ca352d`.
WP34 PR41 is integrated as `cfc9c954fe51242fbc22f62da9f5b3bfaae8ce49`;
v2.1.0/code10 and automated release verification are on main. Physical HONOR
acceptance remains separately pending in MANUAL_ACCEPTANCE.md.

## Implementation decisions

- User-requested AI calls share an in-flight readiness transaction (90s maximum,
  at most 24 health probes, 65s per probe to permit a 60s first wake). Retries use
  capped exponential backoff and jitter. Nothing polls while idle. A successful
  JSON health response confirms backend/auth-store readiness, never Gemini availability.
- Authentication has a separate 30s whole-transaction bound, including key lookup,
  signing, HTTP bodies, backoff and recovery. Subrequests remain bounded to 15s.
  At most three challenge/proof transactions; idempotent registration at most three
  attempts. Only explicit 404 `UNKNOWN_INSTALLATION` permits one re-registration
  with the same signing key. Invalid proof, generic 401/404, revocation, quotas and
  temporary storage failures never reset identity. A transient proof failure uses
  a new challenge, never replays the consumed proof.
  Native signing keys retain their persisted ID; the existing memory-only browser
  signer keeps its backend ID in memory too, so a reload never signs for an ID
  belonging to a discarded browser key. It does not delete persisted native IDs.
- Each caller can abort its wait; one cancelled caller cannot cancel another.
  The last waiter cancels the shared transport. Uncancellable signing results are
  ignored after cancellation. Existing 30s/45s AI processing limits remain unchanged
  for WP35.2. An explicit middleware token-rejection response allows at most one
  signed refresh and resend; ambiguous network errors never replay AI POSTs.
  Worst-case single call: 90s readiness + two 30s auth transactions + two existing
  processing timeouts (the first send may be rejected before processing). These are
  bounds, not measured latency or an SLA.
- PostgreSQL stores public-key identities, unique fingerprints and revocations.
  Session tokens/challenges remain short-lived process memory; after restart a
  retained installation signs again. Every token validation checks durable
  revocation. Registration conflicts preserve the prior ID/key/revocation. The
  adapter uses parameterized SQL; DB failure returns sanitized 503, never files.
- `pg` and its type definitions are the necessary new dependencies; no ORM.
  Connection pool max3, connect/query/statement bounds5s, verified TLS including
  hostname. Runtime does not create tables or import authentication records.
- `X-Request-ID` is a random operation UUID, accepted only with UUID syntax and
  exposed through the existing exact-origin CORS policy. Readiness/register/
  challenge/verify/AI-dispatch/disconnect logs contain allowlisted phases, error
  classes, durations and IDs, never financial content, signatures, keys or tokens.
  Shared-phase logs use the flight initiator's correlation ID; each dispatch has
  its caller's ID. AI dispatch means HTTP request handling, not provider success.
  Existing bounded server logging may suppress events during high traffic.

## Provider evaluation (checked 2026-10-10)

[Render Free](https://render.com/docs/free) loses local files on restarts and
spin-down, and Free Postgres expires after30days. Neither is a sole durable store.
[Neon's October2 update](https://neon.com/blog/neon-free-plan-1-gb-per-project)
lists1GB storage/project,100CU-hours/project/month and a6-hour restore window.
This is a plausible small identity-registry candidate, subject to owner account,
region, quota and retention confirmation. It is not a production availability SLA.
The short restore window requires separate encrypted backups and tested restore.
[Neon pooling](https://neon.com/docs/connect/connection-pooling) uses transaction
pooling: this adapter has no session-dependent prepared statements. Use the
provider's pooled endpoint with a dedicated limited runtime role; direct admin
credentials are for owner-controlled setup/backup only.
[TLS guidance](https://neon.com/docs/connect/connect-securely) supports verification;
the adapter enforces certificate verification even if the URL says `sslmode=require`.
No `rejectUnauthorized:false`, plaintext or URL TLS override is accepted.

## Approval required before external setup, migration or deployment

No external resource, production variable or authentication data was changed by
this implementation. Obtain explicit owner approval for the following steps.
Do not paste credentials, registry exports or backup contents into chat/CI logs.

1. Confirm Render deployment branch/auto-deploy settings and suspend automatic
   rollout for the maintenance window. Confirm provider/region/free limits and
   that no paid resource will be created. Owner creates the selected database.
2. Before restart/redeploy, securely export the **complete current** local
   registry and the current `SPENDWISE_DENIED_INSTALLATION_IDS`; make an encrypted
   offline copy. Include revoked records and their key fingerprints. Never
   export private installation keys (they stay on devices). If registry/deny
   history is unavailable or ambiguous, STOP: an empty DB and mass re-registration
   cannot reconstruct revocation history. Reconcile before enabling registration.
3. Owner runs `server/security/sql/001-installations.sql` against the new empty
   database with an admin connection. Create a dedicated login role with CONNECT,
   schema USAGE and SELECT/INSERT/UPDATE on `spendwise_installations`; revoke PUBLIC
   schema CREATE if allowed by the provider. Runtime needs no DELETE, DDL,
   superuser or role-management privilege. Use the console's secure password flow;
   do not put passwords in SQL history. Check pooled-host region and TLS chain.
4. Freeze registration/revocation writes during import. Validate **every** exported
   record with `parseInstallationPublicKey`, recompute SHA256(base64-decoded SPKI)
   in base64url, compare its fingerprint, and reject malformed fields/duplicate
   IDs/duplicate fingerprints. Preserve ID, SPKI, fingerprint, timestamps and
   revocation reason exactly. For every denied ID, require its original key record
   and set `revoked_at` if absent. Preserve the environment deny list too. No
   silently skipped rows or cleared revocations. The import is an owner-reviewed
   operation: use an isolated import transaction, lock the destination table,
   require it empty, parameterized INSERTs for all seven columns, compare total
   and revoked counts, COMMIT only after the comparisons. Any conflict rolls back.
   Prepare/review the exact export manifest and import transaction with the owner
   before executing it. No authentication data migration is authorized yet.
5. Keep a pre-cutover encrypted snapshot. Owner sets backend-only secrets/config:

   ```dotenv
   BACKEND_HOST_PROFILE=render_free
   SPENDWISE_AUTH_STORE=postgres
   SPENDWISE_AUTH_DATABASE_URL=<dedicated runtime pooled PostgreSQL URL with verified TLS>
   # Preserve SPENDWISE_DENIED_INSTALLATION_IDS and all existing security settings.
   ```

   Never name the URL `VITE_*`, put it in an APK or commit a real value.
   Render (including later paid hosting) refuses file mode. Non-Render local
   development retains the existing file store. `BACKEND_HOST_PROFILE=always_on`
   later changes hosting classification, not durable storage or security.
6. Deploy only after review approval. Health must return JSON2xx with ready store.
   Test a retained installation ID, real challenge/signature/verification, one
   authenticated AI call, revoked installation denial and database-unavailable503.
   Restart backend and repeat retained-ID/revocation tests; no mass registration.
   Capture sanitized correlation IDs/durations only. Run an actual15+minute
   idle-to-request test only after checking external health monitors are not
   keeping Render awake. Distinguish backend readiness from Gemini completion.
7. Arrange encrypted `pg_dump` backups outside the service, including revoked
   records, and test restore to an isolated database. After any older restore,
   reconcile all subsequent revocations before reopening registration/access.
   Retain deny-list/audit evidence and rotate compromised runtime credentials
   through the owner's secret manager. Never clear identity history to repair AI.

## Rollback

Keep registration disabled during any rollback/data reconciliation. Roll back app
code only to a revision that understands the same durable store, or keep API
unavailable until that revision exists. **Do not** roll back to pre-WP35 ephemeral
storage on Render. Preserve DB/schema/rows, deny list and encrypted backups; do not
delete or recreate identity data. Client can return to the prior signed build
without deleting local keys, data or backups; the durable backend remains. A DB
outage is a503, never a reason to enable unauthenticated or legacy access.

## Review evidence and outstanding acceptance

Use `npm run test:wp35` plus the existing full Node, WP32 and WP33 gates. The new
WP35 workflow runs real isolated PostgreSQL17 on loopback with synthetic keys;
TLS options are unit-tested separately (CI loopback is not live TLS validation).
It tests parallel registration, prior ID after auth-service restart, proof replay,
revocation across services and denied fingerprint registration. Local runs without
`WP35_TEST_DATABASE_URL` explicitly skip this integration test.

Pending external acceptance: credential/role/TLS verification, complete migration,
real Render idle/restart with external DB, DB outage/recovery, authenticated live
Gemini and physical Android. Gemini routing/models/thinking and UI/safe-area changes
are deferred; this branch does not establish Google AI Studio tier availability.
No merge, tag, production deploy or official APK publication is authorized here.
