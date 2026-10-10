import {
  KeyObject,
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify as verifySignature,
} from 'crypto';
import fs from 'fs';
import path from 'path';

export const INSTALLATION_AUTH_ALGORITHM = 'ECDSA_P256_SHA256' as const;
export const CHALLENGE_TTL_MS = 120_000;
export const ACCESS_TOKEN_TTL_MS = 10 * 60_000;

export interface InstallationRecord {
  id: string;
  publicKeySpkiBase64: string;
  publicKeyFingerprint: string;
  createdAt: number;
  lastSeenAt: number;
  revokedAt: number | null;
  revokeReason?: string;
}

export interface InstallationRegistration {
  record: InstallationRecord;
  created: boolean;
}

export interface InstallationRegistry {
  register(publicKeySpkiBase64: string, now?: number): InstallationRegistration | Promise<InstallationRegistration>;
  get(id: string): InstallationRecord | null | Promise<InstallationRecord | null>;
  touch(id: string, now?: number): void | Promise<void>;
  revoke(id: string, reason?: string, now?: number): boolean | Promise<boolean>;
  ready(): void | Promise<void>;
}

export function publicKeyFingerprint(publicKeySpkiBase64: string): string {
  return createHash('sha256')
    .update(Buffer.from(publicKeySpkiBase64, 'base64'))
    .digest('base64url');
}

export function parseInstallationPublicKey(publicKeySpkiBase64: string): KeyObject {
  if (
    typeof publicKeySpkiBase64 !== 'string' ||
    publicKeySpkiBase64.length < 80 ||
    publicKeySpkiBase64.length > 1024 ||
    !/^[A-Za-z0-9+/=]+$/.test(publicKeySpkiBase64)
  ) {
    throw new AuthServiceError('INVALID_PUBLIC_KEY', 400);
  }

  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeySpkiBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });

    if (publicKey.asymmetricKeyType !== 'ec') {
      throw new AuthServiceError('INVALID_PUBLIC_KEY', 400);
    }

    const curve = publicKey.asymmetricKeyDetails?.namedCurve;
    if (curve !== 'prime256v1' && curve !== 'P-256') {
      throw new AuthServiceError('INVALID_PUBLIC_KEY', 400);
    }

    return publicKey;
  } catch (error) {
    if (error instanceof AuthServiceError) throw error;
    throw new AuthServiceError('INVALID_PUBLIC_KEY', 400);
  }
}

function normalizeRecord(value: unknown): InstallationRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<InstallationRecord>;
  if (
    typeof record.id !== 'string' ||
    typeof record.publicKeySpkiBase64 !== 'string' ||
    typeof record.publicKeyFingerprint !== 'string' ||
    typeof record.createdAt !== 'number' ||
    typeof record.lastSeenAt !== 'number'
  ) {
    return null;
  }

  try {
    parseInstallationPublicKey(record.publicKeySpkiBase64);
  } catch {
    return null;
  }

  return {
    id: record.id,
    publicKeySpkiBase64: record.publicKeySpkiBase64,
    publicKeyFingerprint: record.publicKeyFingerprint,
    createdAt: record.createdAt,
    lastSeenAt: record.lastSeenAt,
    revokedAt: typeof record.revokedAt === 'number' ? record.revokedAt : null,
    revokeReason:
      typeof record.revokeReason === 'string'
        ? record.revokeReason.slice(0, 160)
        : undefined,
  };
}

export class FileInstallationRegistry implements InstallationRegistry {
  private readonly records = new Map<string, InstallationRecord>();
  private loadFailed = false;

  constructor(private readonly filePath: string | null) {
    this.load();
  }

  ready(): void {
    if (this.loadFailed) throw new AuthServiceError('AUTH_STORE_UNAVAILABLE', 503);
  }

  private load() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const value of parsed) {
        const record = normalizeRecord(value);
        if (record) this.records.set(record.id, record);
      }
    } catch {
      this.loadFailed = true;
    }
  }

  private persist() {
    if (!this.filePath) return;
    if (this.loadFailed) {
      throw new Error('Installation registry is unreadable; refusing to overwrite it.');
    }
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = this.filePath + '.tmp';
    fs.writeFileSync(
      temporary,
      JSON.stringify([...this.records.values()], null, 2),
      { encoding: 'utf8', mode: 0o600 }
    );
    fs.renameSync(temporary, this.filePath);
  }

  register(publicKeySpkiBase64: string, now = Date.now()): InstallationRegistration {
    parseInstallationPublicKey(publicKeySpkiBase64);
    const fingerprint = publicKeyFingerprint(publicKeySpkiBase64);
    const existing = [...this.records.values()].find(
      (record) => record.publicKeyFingerprint === fingerprint
    );

    if (existing) {
      return { record: { ...existing }, created: false };
    }

    const record: InstallationRecord = {
      id: randomUUID(),
      publicKeySpkiBase64,
      publicKeyFingerprint: fingerprint,
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null,
    };
    this.records.set(record.id, record);
    this.persist();
    return { record: { ...record }, created: true };
  }

  get(id: string): InstallationRecord | null {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  touch(id: string, now = Date.now()): void {
    const record = this.records.get(id);
    if (!record || record.revokedAt != null) return;
    record.lastSeenAt = now;
    this.persist();
  }

  revoke(id: string, reason = 'revoked', now = Date.now()): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.revokedAt = now;
    record.revokeReason = reason.slice(0, 160);
    this.persist();
    return true;
  }
}

interface ChallengeRecord {
  challengeId: string;
  installationId: string;
  nonce: string;
  expiresAt: number;
}

interface SessionRecord {
  installationId: string;
  expiresAt: number;
}

export class AuthServiceError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number
  ) {
    super(code);
    this.name = 'AuthServiceError';
  }
}

export function canonicalChallengePayload(input: ChallengeRecord): string {
  return [
    'spendwise-auth-v1',
    input.installationId,
    input.challengeId,
    input.nonce,
    String(input.expiresAt),
  ].join('\n');
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

function rawP256SignatureToDer(signature: Buffer): Buffer {
  if (signature.length !== 64) return signature;

  const encodeInteger = (value: Buffer) => {
    let offset = 0;
    while (offset < value.length - 1 && value[offset] === 0) offset += 1;
    let normalized = value.subarray(offset);
    if ((normalized[0] & 0x80) !== 0) {
      normalized = Buffer.concat([Buffer.from([0]), normalized]);
    }
    return Buffer.concat([
      Buffer.from([0x02, normalized.length]),
      normalized,
    ]);
  };

  const r = encodeInteger(signature.subarray(0, 32));
  const s = encodeInteger(signature.subarray(32));
  const body = Buffer.concat([r, s]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

export class InstallationAuthService {
  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    readonly registry: InstallationRegistry,
    private readonly options: {
      challengeTtlMs?: number;
      accessTokenTtlMs?: number;
      deniedInstallationIds?: Set<string>;
    } = {}
  ) {}

  private async getActiveInstallation(id: string): Promise<InstallationRecord> {
    if (this.options.deniedInstallationIds?.has(id)) {
      throw new AuthServiceError('INSTALLATION_REVOKED', 403);
    }
    const record = await this.registry.get(id);
    if (!record) throw new AuthServiceError('UNKNOWN_INSTALLATION', 404);
    if (record.revokedAt != null) {
      throw new AuthServiceError('INSTALLATION_REVOKED', 403);
    }
    return record;
  }

  async register(
    publicKeySpkiBase64: string,
    algorithm: string,
    now = Date.now()
  ): Promise<InstallationRegistration> {
    if (algorithm !== INSTALLATION_AUTH_ALGORITHM) {
      throw new AuthServiceError('UNSUPPORTED_SIGNING_ALGORITHM', 400);
    }
    const registration = await this.registry.register(publicKeySpkiBase64, now);
    if (registration.record.revokedAt != null || this.options.deniedInstallationIds?.has(registration.record.id)) {
      throw new AuthServiceError('INSTALLATION_REVOKED', 403);
    }
    return registration;
  }

  async issueChallenge(installationId: string, now = Date.now()) {
    await this.getActiveInstallation(installationId);
    this.cleanup(now);
    const challenge: ChallengeRecord = {
      challengeId: randomUUID(),
      installationId,
      nonce: randomBytes(32).toString('base64url'),
      expiresAt: now + (this.options.challengeTtlMs ?? CHALLENGE_TTL_MS),
    };
    this.challenges.set(challenge.challengeId, challenge);
    return {
      challengeId: challenge.challengeId,
      nonce: challenge.nonce,
      expiresAt: challenge.expiresAt,
      payload: canonicalChallengePayload(challenge),
    };
  }

  async verifyChallenge(
    installationId: string,
    challengeId: string,
    signatureBase64: string,
    now = Date.now()
  ) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.installationId !== installationId) {
      throw new AuthServiceError('INVALID_CHALLENGE', 401);
    }

    // Consume before signature verification so every proof attempt is one-shot.
    this.challenges.delete(challengeId);

    if (now >= challenge.expiresAt) {
      throw new AuthServiceError('CHALLENGE_EXPIRED', 401);
    }

    if (
      typeof signatureBase64 !== 'string' ||
      signatureBase64.length < 40 ||
      signatureBase64.length > 512 ||
      !/^[A-Za-z0-9+/=]+$/.test(signatureBase64)
    ) {
      throw new AuthServiceError('INVALID_SIGNATURE', 401);
    }

    const installation = await this.getActiveInstallation(installationId);
    const publicKey = parseInstallationPublicKey(
      installation.publicKeySpkiBase64
    );
    const suppliedSignature = Buffer.from(signatureBase64, 'base64');
    const valid = verifySignature(
      'sha256',
      Buffer.from(canonicalChallengePayload(challenge), 'utf8'),
      publicKey,
      rawP256SignatureToDer(suppliedSignature)
    );

    if (!valid) throw new AuthServiceError('INVALID_SIGNATURE', 401);

    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt =
      now + (this.options.accessTokenTtlMs ?? ACCESS_TOKEN_TTL_MS);
    await this.registry.touch(installationId, now);
    this.sessions.set(tokenHash(accessToken), { installationId, expiresAt });

    return { accessToken, expiresAt, tokenType: 'Bearer' as const };
  }

  async validateAccessToken(accessToken: string, now = Date.now()): Promise<InstallationRecord> {
    if (
      typeof accessToken !== 'string' ||
      accessToken.length < 32 ||
      accessToken.length > 512
    ) {
      throw new AuthServiceError('INVALID_ACCESS_TOKEN', 401);
    }

    const hash = tokenHash(accessToken);
    const session = this.sessions.get(hash);
    if (!session) throw new AuthServiceError('INVALID_ACCESS_TOKEN', 401);
    if (now >= session.expiresAt) {
      this.sessions.delete(hash);
      throw new AuthServiceError('ACCESS_TOKEN_EXPIRED', 401);
    }

    return this.getActiveInstallation(session.installationId);
  }

  async revokeInstallation(id: string, reason = 'revoked', now = Date.now()): Promise<boolean> {
    const revoked = await this.registry.revoke(id, reason, now);
    if (!revoked) return false;
    for (const [hash, session] of this.sessions) {
      if (session.installationId === id) this.sessions.delete(hash);
    }
    for (const [challengeId, challenge] of this.challenges) {
      if (challenge.installationId === id) this.challenges.delete(challengeId);
    }
    return true;
  }

  cleanup(now = Date.now()) {
    for (const [challengeId, challenge] of this.challenges) {
      if (now >= challenge.expiresAt) this.challenges.delete(challengeId);
    }
    for (const [hash, session] of this.sessions) {
      if (now >= session.expiresAt) this.sessions.delete(hash);
    }
  }
}
