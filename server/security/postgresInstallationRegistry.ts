import { randomUUID } from 'node:crypto';
import { Pool, type PoolConfig } from 'pg';
import {
  AuthServiceError, parseInstallationPublicKey, publicKeyFingerprint,
  type InstallationRecord, type InstallationRegistry, type InstallationRegistration,
} from './installationAuth';

/** URL options must never override certificate/hostname validation. */
export function databasePoolOptions(raw: string): PoolConfig {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid auth database configuration.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length <= 1) {
    throw new Error('Invalid auth database configuration.');
  }
  for (const [key, value] of url.searchParams) {
    if (key.startsWith('ssl') && !(key === 'sslmode' && ['require', 'verify-ca', 'verify-full'].includes(value))) {
      throw new Error('Auth database requires verified TLS.');
    }
  }
  url.searchParams.delete('sslmode');
  // pg parses connection options from the URL; allow no transport overrides.
  if ([...url.searchParams.keys()].some(key => !['application_name'].includes(key))) throw new Error('Unsupported auth database option.');
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true }, max: 3,
    connectionTimeoutMillis: 5_000, query_timeout: 5_000, statement_timeout: 5_000,
    idleTimeoutMillis: 10_000, allowExitOnIdle: true };
}

type Database = Pick<Pool, 'query'>;
const columns = 'id, public_key_spki_base64, public_key_fingerprint, created_at, last_seen_at, revoked_at, revoke_reason';
function record(row: any): InstallationRecord {
  return { id: row.id, publicKeySpkiBase64: row.public_key_spki_base64, publicKeyFingerprint: row.public_key_fingerprint,
    createdAt: Number(row.created_at), lastSeenAt: Number(row.last_seen_at),
    revokedAt: row.revoked_at == null ? null : Number(row.revoked_at), revokeReason: row.revoke_reason ?? undefined };
}

export class PostgresInstallationRegistry implements InstallationRegistry {
  constructor(private readonly database: Database) {}
  private async query(sql: string, values: unknown[] = []) {
    try { return await this.database.query(sql, values); }
    catch { throw new AuthServiceError('AUTH_STORE_UNAVAILABLE', 503); }
  }
  async ready(): Promise<void> { await this.query('SELECT id FROM spendwise_installations LIMIT 1'); }
  async register(publicKeySpkiBase64: string, now = Date.now()): Promise<InstallationRegistration> {
    parseInstallationPublicKey(publicKeySpkiBase64);
    const result = await this.query(`INSERT INTO spendwise_installations
      (id, public_key_spki_base64, public_key_fingerprint, created_at, last_seen_at)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (public_key_fingerprint) DO UPDATE
      SET public_key_fingerprint = EXCLUDED.public_key_fingerprint
      RETURNING ${columns}, (xmax = 0) AS created`,
    [randomUUID(), publicKeySpkiBase64, publicKeyFingerprint(publicKeySpkiBase64), now]);
    // Never clear a revocation or change an existing fingerprint's identity/key.
    return { record: record(result.rows[0]), created: result.rows[0].created === true };
  }
  async get(id: string): Promise<InstallationRecord | null> {
    // Old/unknown IDs can be arbitrary strings; don't let a UUID cast look like a DB outage.
    const result = await this.query(`SELECT ${columns} FROM spendwise_installations WHERE id = $1`, [id]);
    return result.rows[0] ? record(result.rows[0]) : null;
  }
  async touch(id: string, now = Date.now()): Promise<void> {
    const result = await this.query('UPDATE spendwise_installations SET last_seen_at = GREATEST(last_seen_at, $2) WHERE id = $1 AND revoked_at IS NULL RETURNING id', [id, now]);
    if (!result.rows.length) throw new AuthServiceError('INSTALLATION_REVOKED', 403);
  }
  async revoke(id: string, reason = 'revoked', now = Date.now()): Promise<boolean> {
    const result = await this.query('UPDATE spendwise_installations SET revoked_at = COALESCE(revoked_at, $2), revoke_reason = COALESCE(revoke_reason, $3) WHERE id = $1 RETURNING id', [id, now, reason.slice(0, 160)]);
    return result.rows.length > 0;
  }
}

export function createPostgresRegistry(url: string): PostgresInstallationRegistry {
  const pool = new Pool(databasePoolOptions(url));
  // Idle connection errors must not print credentials or crash into a file fallback.
  pool.on('error', () => {});
  return new PostgresInstallationRegistry(pool);
}
