import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSign,
  generateKeyPairSync,
  KeyObject,
} from 'node:crypto';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'test';
process.env.SPENDWISE_INSTALLATION_STORE_PATH = ':memory:';
process.env.SPENDWISE_API_TOKEN = 'wp31-legacy-compat-test-token';
process.env.SPENDWISE_LEGACY_AUTH_UNTIL = '2099-01-01T00:00:00Z';

const {
  ACCESS_TOKEN_TTL_MS,
  AuthServiceError,
  CHALLENGE_TTL_MS,
  FileInstallationRegistry,
  INSTALLATION_AUTH_ALGORITHM,
  InstallationAuthService,
} = await import('../server/security/installationAuth');
const { consumeRateLimit } = await import('../server/middleware/rateLimit');
const { parsedBodyByteLength } = await import('../server/middleware/requestLimits');
const { parseServerConfig } = await import('../server/config');
const { createServerApp } = await import('../server/app');

function identity() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKeyBase64: pair.publicKey
      .export({ type: 'spki', format: 'der' })
      .toString('base64'),
    privateKey: pair.privateKey,
  };
}

function sign(
  privateKey: KeyObject,
  payload: string,
  dsaEncoding: 'der' | 'ieee-p1363' = 'der'
): string {
  const signer = createSign('SHA256');
  signer.update(payload);
  signer.end();
  return signer
    .sign({ key: privateKey, dsaEncoding })
    .toString('base64');
}

function expectAuthError(
  fn: () => unknown,
  expectedCode: string
) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof AuthServiceError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test('WP31 constants match the approved short-lived authentication contract', () => {
  assert.equal(CHALLENGE_TTL_MS, 120_000);
  assert.equal(ACCESS_TOKEN_TTL_MS, 10 * 60_000);
  assert.equal(INSTALLATION_AUTH_ALGORITHM, 'ECDSA_P256_SHA256');
});

test('unknown installation cannot obtain a challenge', () => {
  const service = new InstallationAuthService(
    new FileInstallationRegistry(null)
  );
  expectAuthError(
    () => service.issueChallenge('unknown-installation', 1_000),
    'UNKNOWN_INSTALLATION'
  );
});

test('valid registration is bounded to P-256 and is idempotent by public key', () => {
  const service = new InstallationAuthService(
    new FileInstallationRegistry(null)
  );
  const firstIdentity = identity();
  const first = service.register(
    firstIdentity.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );
  const second = service.register(
    firstIdentity.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    2_000
  );

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.record.id, first.record.id);

  const wrongCurve = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  const wrongKey = wrongCurve.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  expectAuthError(
    () =>
      service.register(
        wrongKey,
        INSTALLATION_AUTH_ALGORITHM,
        3_000
      ),
    'INVALID_PUBLIC_KEY'
  );
});

test('valid signed challenge issues an installation-scoped short-lived token', () => {
  const service = new InstallationAuthService(
    new FileInstallationRegistry(null)
  );
  const key = identity();
  const registration = service.register(
    key.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );
  const challenge = service.issueChallenge(
    registration.record.id,
    1_100
  );
  const session = service.verifyChallenge(
    registration.record.id,
    challenge.challengeId,
    sign(key.privateKey, challenge.payload),
    1_200
  );

  assert.equal(session.tokenType, 'Bearer');
  assert.ok(session.accessToken.length >= 32);
  assert.equal(
    service.validateAccessToken(session.accessToken, 1_300).id,
    registration.record.id
  );
});

test('challenge proof is one-time and replay is rejected', () => {
  const service = new InstallationAuthService(
    new FileInstallationRegistry(null)
  );
  const key = identity();
  const registration = service.register(
    key.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );
  const challenge = service.issueChallenge(
    registration.record.id,
    1_100
  );
  const signature = sign(key.privateKey, challenge.payload);

  service.verifyChallenge(
    registration.record.id,
    challenge.challengeId,
    signature,
    1_200
  );
  expectAuthError(
    () =>
      service.verifyChallenge(
        registration.record.id,
        challenge.challengeId,
        signature,
        1_300
      ),
    'INVALID_CHALLENGE'
  );
});

test('expired challenge is rejected and consumed', () => {
  const service = new InstallationAuthService(
    new FileInstallationRegistry(null),
    { challengeTtlMs: 100 }
  );
  const key = identity();
  const registration = service.register(
    key.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );
  const challenge = service.issueChallenge(
    registration.record.id,
    1_000
  );

  expectAuthError(
    () =>
      service.verifyChallenge(
        registration.record.id,
        challenge.challengeId,
        sign(key.privateKey, challenge.payload),
        1_100
      ),
    'CHALLENGE_EXPIRED'
  );
  expectAuthError(
    () =>
      service.verifyChallenge(
        registration.record.id,
        challenge.challengeId,
        sign(key.privateKey, challenge.payload),
        1_101
      ),
    'INVALID_CHALLENGE'
  );
});

test('invalid signature and a signature from the wrong installation are rejected', () => {
  const service = new InstallationAuthService(
    new FileInstallationRegistry(null)
  );
  const firstKey = identity();
  const secondKey = identity();
  const first = service.register(
    firstKey.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );
  service.register(
    secondKey.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );

  const invalid = service.issueChallenge(first.record.id, 1_100);
  expectAuthError(
    () =>
      service.verifyChallenge(
        first.record.id,
        invalid.challengeId,
        sign(firstKey.privateKey, invalid.payload + '-tampered'),
        1_200
      ),
    'INVALID_SIGNATURE'
  );

  const wrongInstallation = service.issueChallenge(
    first.record.id,
    1_300
  );
  expectAuthError(
    () =>
      service.verifyChallenge(
        first.record.id,
        wrongInstallation.challengeId,
        sign(secondKey.privateKey, wrongInstallation.payload),
        1_400
      ),
    'INVALID_SIGNATURE'
  );
});

test('browser P-256 raw signature encoding is normalized safely', () => {
  const service = new InstallationAuthService(
    new FileInstallationRegistry(null)
  );
  const key = identity();
  const registration = service.register(
    key.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );
  const challenge = service.issueChallenge(
    registration.record.id,
    1_100
  );
  const session = service.verifyChallenge(
    registration.record.id,
    challenge.challengeId,
    sign(key.privateKey, challenge.payload, 'ieee-p1363'),
    1_200
  );
  assert.equal(
    service.validateAccessToken(session.accessToken, 1_300).id,
    registration.record.id
  );
});

test('expired access token and revoked installation are rejected', () => {
  const registry = new FileInstallationRegistry(null);
  const service = new InstallationAuthService(registry, {
    accessTokenTtlMs: 100,
  });
  const key = identity();
  const registration = service.register(
    key.publicKeyBase64,
    INSTALLATION_AUTH_ALGORITHM,
    1_000
  );

  const firstChallenge = service.issueChallenge(
    registration.record.id,
    1_000
  );
  const firstSession = service.verifyChallenge(
    registration.record.id,
    firstChallenge.challengeId,
    sign(key.privateKey, firstChallenge.payload),
    1_001
  );
  expectAuthError(
    () => service.validateAccessToken(firstSession.accessToken, 1_101),
    'ACCESS_TOKEN_EXPIRED'
  );

  const secondChallenge = service.issueChallenge(
    registration.record.id,
    1_200
  );
  const secondSession = service.verifyChallenge(
    registration.record.id,
    secondChallenge.challengeId,
    sign(key.privateKey, secondChallenge.payload),
    1_201
  );
  assert.equal(
    service.revokeInstallation(registration.record.id, 'test', 1_202),
    true
  );
  expectAuthError(
    () => service.validateAccessToken(secondSession.accessToken, 1_203),
    'INVALID_ACCESS_TOKEN'
  );
  expectAuthError(
    () => service.issueChallenge(registration.record.id, 1_204),
    'INSTALLATION_REVOKED'
  );
});

test('rate-limit primitive enforces per-install, IP, and registration-style quotas', () => {
  const perInstall = new Map();
  assert.equal(
    consumeRateLimit(perInstall, 'install-a', 1_000, 60_000, 2).allowed,
    true
  );
  assert.equal(
    consumeRateLimit(perInstall, 'install-a', 1_001, 60_000, 2).allowed,
    true
  );
  assert.equal(
    consumeRateLimit(perInstall, 'install-a', 1_002, 60_000, 2).allowed,
    false
  );

  const perIp = new Map();
  consumeRateLimit(perIp, '203.0.113.10', 1_000, 60_000, 1);
  assert.equal(
    consumeRateLimit(perIp, '203.0.113.10', 1_001, 60_000, 1).allowed,
    false
  );

  const registration = new Map();
  for (let index = 0; index < 5; index += 1) {
    assert.equal(
      consumeRateLimit(
        registration,
        '203.0.113.20',
        1_000 + index,
        60 * 60_000,
        5
      ).allowed,
      true
    );
  }
  assert.equal(
    consumeRateLimit(
      registration,
      '203.0.113.20',
      2_000,
      60 * 60_000,
      5
    ).allowed,
    false
  );
});

test('legacy compatibility is unusable without an explicit valid sunset', () => {
  const withoutSunset = parseServerConfig({
    SPENDWISE_API_TOKEN: 'legacy-token',
  });
  assert.equal(withoutSunset.legacyApiToken, null);
  assert.equal(withoutSunset.legacyCompatibilityUntilMs, null);

  const withSunset = parseServerConfig({
    SPENDWISE_API_TOKEN: 'legacy-token',
    SPENDWISE_LEGACY_AUTH_UNTIL: '2099-01-01T00:00:00Z',
  });
  assert.equal(withSunset.legacyApiToken, 'legacy-token');
  assert.ok((withSunset.legacyCompatibilityUntilMs ?? 0) > 0);
});

test('production quota and request-size defaults are bounded', () => {
  const config = parseServerConfig({});
  assert.equal(config.registrationHourlyLimit, 5);
  assert.equal(config.registrationDailyLimit, 20);
  assert.equal(config.aiPerInstallationLimit, 30);
  assert.equal(config.aiPerIpLimit, 60);
  assert.equal(config.maxAuthJsonBodyBytes, 64 * 1024);
  assert.equal(config.maxFinancialJsonBodyBytes, 512 * 1024);
  assert.equal(config.maxImageBase64Length, 12_000_000);
  assert.ok(
    parsedBodyByteLength({ value: 'x'.repeat(1024) }) > 1024
  );
});

test('HTTP boundary rejects unauthenticated AI, malformed JSON, oversized JSON/image, and preserves legacy transition', async () => {
  const app = createServerApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const address = server.address() as AddressInfo;
    const base = 'http://127.0.0.1:' + address.port;

    const unauthenticated = await fetch(base + '/api/gemini/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(unauthenticated.status, 401);

    const malformed = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'INVALID_JSON');

    const authOversized = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(70 * 1024) }),
    });
    assert.equal(authOversized.status, 413);

    const key = identity();
    const registrationResponse = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: key.publicKeyBase64,
        algorithm: INSTALLATION_AUTH_ALGORITHM,
      }),
    });
    assert.ok(
      registrationResponse.status === 200 ||
        registrationResponse.status === 201
    );
    const registration = await registrationResponse.json() as {
      installationId: string;
    };

    const challengeResponse = await fetch(base + '/api/auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installationId: registration.installationId,
      }),
    });
    assert.equal(challengeResponse.status, 200);
    const challenge = await challengeResponse.json() as {
      challengeId: string;
      payload: string;
    };

    const proofResponse = await fetch(base + '/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installationId: registration.installationId,
        challengeId: challenge.challengeId,
        signature: sign(key.privateKey, challenge.payload),
      }),
    });
    assert.equal(proofResponse.status, 200);
    const session = await proofResponse.json() as { accessToken: string };
    const authorization = 'Bearer ' + session.accessToken;

    const oversizedFinancial = await fetch(
      base + '/api/gemini/analyze',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({ padding: 'x'.repeat(600 * 1024) }),
      }
    );
    assert.equal(oversizedFinancial.status, 413);

    const oversizedImage = await fetch(
      base + '/api/gemini/smart-capture',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify({
          imageBase64: 'A'.repeat(12_000_001),
          mimeType: 'image/jpeg',
          language: 'en',
          currencyCode: 'USD',
        }),
      }
    );
    assert.equal(oversizedImage.status, 400);

    const legacy = await fetch(base + '/api/gemini/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SpendWise-Token': 'wp31-legacy-compat-test-token',
      },
      body: '{}',
    });
    assert.equal(legacy.status, 400);
    assert.equal(legacy.headers.get('X-SpendWise-Legacy-Auth'), 'deprecated');

    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    const healthBody = await health.json() as Record<string, unknown>;
    assert.equal(healthBody.authentication, 'installation-signature-v1');
    for (const forbidden of [
      'model',
      'fallbackModel',
      'fallbackModels',
      'apiKey',
      'token',
      'accessToken',
    ]) {
      assert.equal(forbidden in healthBody, false);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('client no longer embeds or sends the legacy static APK credential', () => {
  const api = readFileSync('src/utils/api.ts', 'utf8');
  const viteEnv = readFileSync('src/vite-env.d.ts', 'utf8');
  const client = readFileSync(
    'src/security/AuthenticatedApiClient.ts',
    'utf8'
  );
  assert.doesNotMatch(api, /VITE_API_ACCESS_TOKEN|X-SpendWise-Token/);
  assert.doesNotMatch(viteEnv, /VITE_API_ACCESS_TOKEN/);
  assert.match(client, /Authorization.*Bearer/);
  assert.match(client, /\/api\/auth\/challenge/);
  assert.match(client, /\/api\/auth\/verify/);
  assert.doesNotMatch(
    client,
    /localStorage.*accessToken|setItem\([^\n]*accessToken/i
  );
});

test('Android identity is Keystore-backed and production cleartext is disabled', () => {
  const native = readFileSync(
    'android/app/src/main/java/com/spendwise/app/SpendWiseSecurityPlugin.java',
    'utf8'
  );
  const manifest = readFileSync(
    'android/app/src/main/AndroidManifest.xml',
    'utf8'
  );
  const network = readFileSync(
    'android/app/src/main/res/xml/network_security_config.xml',
    'utf8'
  );

  assert.match(native, /spendwise\.installation-identity\.v1/);
  assert.match(native, /KeyPairGenerator\.getInstance/);
  assert.match(native, /AndroidKeyStore/);
  assert.match(native, /secp256r1/);
  assert.match(native, /SHA256withECDSA/);
  assert.match(native, /PURPOSE_SIGN/);
  assert.doesNotMatch(native, /getPrivate\(\)\.getEncoded/);

  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /@xml\/network_security_config/);
  assert.match(network, /cleartextTrafficPermitted="false"/);
});

test('security logging and errors cannot accept financial bodies or authorization secrets', () => {
  const securityLogging = readFileSync(
    'server/logging/securityLogging.ts',
    'utf8'
  );
  const aiLogging = readFileSync(
    'server/logging/aiLogging.ts',
    'utf8'
  );
  const errors = readFileSync(
    'server/middleware/errors.ts',
    'utf8'
  );

  assert.doesNotMatch(
    securityLogging,
    /(?:description|amount|budget|receipt|imageBase64|accessToken)\s*:/i
  );
  assert.doesNotMatch(
    aiLogging,
    /description|amount|budget|receipt|imageBase64|PIN|apiKey|token/i
  );
  assert.doesNotMatch(errors, /console\.(?:warn|error)\([^\n]*error\b/);
});

test('CI deployed smoke uses registration, challenge, proof and bearer access without static APK token', () => {
  const workflow = readFileSync(
    '.github/workflows/android-build.yml',
    'utf8'
  );
  const smoke = readFileSync(
    'scripts/deployed-auth-smoke.mjs',
    'utf8'
  );

  assert.match(workflow, /npm run test:wp31/);
  assert.match(workflow, /deployed-auth-smoke\.mjs/);
  assert.doesNotMatch(workflow, /VITE_API_ACCESS_TOKEN/);
  assert.match(smoke, /\/api\/auth\/register/);
  assert.match(smoke, /\/api\/auth\/challenge/);
  assert.match(smoke, /\/api\/auth\/verify/);
  assert.match(smoke, /Authorization: 'Bearer '/);
  assert.doesNotMatch(smoke, /console\.log\([^\n]*(?:accessToken|privateKey)/i);
});

test('WP31 stays in scope and keeps version/release frozen', () => {
  const packageJson = JSON.parse(
    readFileSync('package.json', 'utf8')
  ) as { version: string };
  const versionJson = JSON.parse(
    readFileSync('version.json', 'utf8')
  ) as { versionName: string; versionCode: number };
  const changedSecurity = [
    readFileSync('server/security/installationAuth.ts', 'utf8'),
    readFileSync('src/security/AuthenticatedApiClient.ts', 'utf8'),
    readFileSync('src/security/InstallationIdentityService.ts', 'utf8'),
  ].join('\n');

  assert.equal(packageJson.version, '1.4.0');
  assert.equal(versionJson.versionName, '1.4.0');
  assert.equal(versionJson.versionCode, 5);
  assert.doesNotMatch(
    changedSecurity,
    /SQLCipher|Backup v3|passphrase|Play Integrity|certificate pin/i
  );
});
