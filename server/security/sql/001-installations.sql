-- Owner-run schema setup only. Runtime never creates tables or migrates records.
CREATE TABLE IF NOT EXISTS spendwise_installations (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 80),
  public_key_spki_base64 text NOT NULL CHECK (length(public_key_spki_base64) BETWEEN 80 AND 1024),
  public_key_fingerprint text UNIQUE NOT NULL,
  created_at bigint NOT NULL CHECK (created_at >= 0),
  last_seen_at bigint NOT NULL CHECK (last_seen_at >= 0),
  revoked_at bigint CHECK (revoked_at IS NULL OR revoked_at >= 0),
  revoke_reason text CHECK (revoke_reason IS NULL OR length(revoke_reason) <= 160)
);
