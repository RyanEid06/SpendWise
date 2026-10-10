import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { InstallationAuthService, INSTALLATION_AUTH_ALGORITHM } from '../server/security/installationAuth';
import { PostgresInstallationRegistry, databasePoolOptions } from '../server/security/postgresInstallationRegistry';
import { parseServerConfig } from '../server/config';

test('Render must select durable storage and refuse missing database credentials', () => {
  assert.throws(() => parseServerConfig({ RENDER: 'true' }), /database configuration/i);
  assert.throws(() => parseServerConfig({ RENDER: 'true', SPENDWISE_AUTH_STORE: 'file' }), /durable/i);
  assert.throws(() => parseServerConfig({ SPENDWISE_AUTH_STORE: 'typo' }), /auth store/i);
  const config = parseServerConfig({ RENDER: 'true', SPENDWISE_AUTH_DATABASE_URL: 'postgresql://user:password@db.example/db?sslmode=verify-full' });
  assert.equal(config.authStore, 'postgres');
  assert.equal(config.backendHostProfile, 'render_free');
});

test('Postgres requires verified TLS and a bounded small pool, and refuses insecure URL overrides', () => {
  const options = databasePoolOptions('postgresql://user:password@db.example/db?sslmode=require');
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.equal(new URL(options.connectionString!).searchParams.has('sslmode'), false);
  assert.ok(options.max! <= 3 && options.connectionTimeoutMillis! <= 5000 && Number(options.query_timeout) <= 5000);
  for (const query of ['sslmode=disable', 'sslmode=no-verify', 'sslmode=prefer', 'ssl=false']) assert.throws(() => databasePoolOptions('postgresql://user:password@db.example/db?' + query));
  assert.throws(() => databasePoolOptions('http://db.example/db'));
});

test('database errors fail closed with sanitized 503 for registration, challenge and readiness', async () => {
  const registry = new PostgresInstallationRegistry({ query: async () => { throw new Error('postgresql://secret:password@host signature'); } } as any);
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const service = new InstallationAuthService(registry);
  const error = (e: any) => e.code === 'AUTH_STORE_UNAVAILABLE' && e.httpStatus === 503 && !/secret|password|signature/.test(e.message);
  await assert.rejects(service.register(publicKey, INSTALLATION_AUTH_ALGORITHM), error);
  await assert.rejects(service.issueChallenge('old-id'), error);
  await assert.rejects(registry.ready(), error);
});

const url = process.env.WP35_TEST_DATABASE_URL;
test('real Postgres: concurrent registration, restart, prior ID, proof replay, revocation and deny semantics', { skip: !url }, async () => {
  assert.equal(new URL(url!).hostname, '127.0.0.1', 'Integration uses only isolated loopback CI Postgres.');
  const pool = new Pool({ connectionString: url, max: 3 });
  try {
    await pool.query(readFileSync('server/security/sql/001-installations.sql', 'utf8'));
    const registry = new PostgresInstallationRegistry(pool);
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const service = new InstallationAuthService(registry);
    const registrations = await Promise.all(Array.from({ length: 6 }, () => service.register(publicKey, INSTALLATION_AUTH_ALGORITHM)));
    const id = registrations[0].record.id;
    assert.equal(new Set(registrations.map(r => r.record.id)).size, 1);
    assert.equal(registrations.filter(r => r.created).length, 1);
    const challenge = await service.issueChallenge(id);
    const signature = sign('sha256', Buffer.from(challenge.payload), pair.privateKey).toString('base64');
    const [a, b] = await Promise.allSettled([service.verifyChallenge(id, challenge.challengeId, signature), service.verifyChallenge(id, challenge.challengeId, signature)]);
    assert.equal([a, b].filter(r => r.status === 'fulfilled').length, 1);
    const session = [a, b].find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>;
    assert.equal((await service.validateAccessToken(session.value.accessToken)).id, id);
    const restarted = new InstallationAuthService(new PostgresInstallationRegistry(pool));
    assert.equal((await restarted.register(publicKey, INSTALLATION_AUTH_ALGORITHM)).record.id, id);
    await assert.rejects(restarted.validateAccessToken(session.value.accessToken), (e: any) => e.code === 'INVALID_ACCESS_TOKEN');
    assert.ok((await restarted.issueChallenge(id)).payload.includes(id));
    const denied = new InstallationAuthService(new PostgresInstallationRegistry(pool), { deniedInstallationIds: new Set([id]) });
    await assert.rejects(denied.register(publicKey, INSTALLATION_AUTH_ALGORITHM), (e: any) => e.code === 'INSTALLATION_REVOKED');
    await restarted.revokeInstallation(id, 'test-revocation');
    const afterRestart = new InstallationAuthService(new PostgresInstallationRegistry(pool));
    await assert.rejects(afterRestart.register(publicKey, INSTALLATION_AUTH_ALGORITHM), (e: any) => e.code === 'INSTALLATION_REVOKED');
    await assert.rejects(afterRestart.issueChallenge(id), (e: any) => e.code === 'INSTALLATION_REVOKED');
    // Revocation in another process is enforced for already issued sessions too.
    await assert.rejects(service.validateAccessToken(session.value.accessToken), (e: any) => e.code === 'INSTALLATION_REVOKED');
    assert.equal((await registry.get(id))!.revokeReason, 'test-revocation');
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const active = await service.register(other.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), INSTALLATION_AUTH_ALGORITHM);
    const activeChallenge = await service.issueChallenge(active.record.id);
    const activeSession = await service.verifyChallenge(active.record.id, activeChallenge.challengeId, sign('sha256', Buffer.from(activeChallenge.payload), other.privateKey).toString('base64'));
    await pool.end();
    await assert.rejects(service.validateAccessToken(activeSession.accessToken), (e: any) => e.code === 'AUTH_STORE_UNAVAILABLE' && e.httpStatus === 503);
    await assert.rejects(service.issueChallenge(active.record.id), (e: any) => e.code === 'AUTH_STORE_UNAVAILABLE');
  } finally { if (!(pool as any).ended) await pool.end(); }
});
