import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { parseServerConfig } from '../server/config';

test('sample environment starts locally and still requires durable storage on Render', () => {
  const sample = parseEnv(readFileSync('.env.example', 'utf8'));
  const local = parseServerConfig(sample);
  assert.equal(local.backendHostProfile, 'always_on');
  assert.equal(local.authStore, 'file');
  assert.equal(local.geminiOperationBudgetMs, 90_000);
  assert.throws(() => parseServerConfig({ ...sample, RENDER: 'true' }), /database configuration/i);
  assert.throws(() => parseServerConfig({ ...sample, RENDER: 'true', SPENDWISE_AUTH_STORE: 'file' }), /durable/i);
});

// Catches integration dropping durable-store enforcement when adding host/runtime profiles.
for (const profile of ['render_free', 'always_on']) {
  test(`Render ${profile} refuses ephemeral auth and requires durable configuration`, () => {
    assert.throws(() => parseServerConfig({ RENDER: 'true', BACKEND_HOST_PROFILE: profile, SPENDWISE_AUTH_STORE: 'file' }), /durable/i);
    assert.throws(() => parseServerConfig({ RENDER: 'true', BACKEND_HOST_PROFILE: profile }), /database configuration/i);
    const config = parseServerConfig({ RENDER: 'true', BACKEND_HOST_PROFILE: profile,
      SPENDWISE_AUTH_DATABASE_URL: 'postgresql://synthetic:synthetic@db.example/isolated' });
    assert.equal(config.authStore, 'postgres');
    assert.equal(config.backendHostProfile, profile);
    assert.ok(config.geminiOperationBudgetMs < 115_000, 'server must stop before the client processing bound');
    assert.equal(config.geminiOperationBudgetMs, 90_000);
    assert.equal(config.geminiMaxAttempts, 2);
    assert.deepEqual(config.geminiTaskRoutes, {});
  });
}
