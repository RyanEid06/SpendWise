import test from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticStore, DIAGNOSTIC_STORAGE_KEY } from '../src/services/diagnostics/DiagnosticStore';
import { MAX_DIAGNOSTIC_BYTES, MAX_DIAGNOSTIC_RECORDS, DIAGNOSTIC_RETENTION_MS } from '../src/services/diagnostics/contract';

const now = 1_800_000_000_000;
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
}
const secrets = ['expense-description-private', 'merchant-private', 'receipt-private', 'pin-private', 'passphrase-private', 'encryption-key-private', 'token-private', 'signature-private', 'installation-private', 'photo-private', 'prompt-private', 'response-private'];

test('partial technical state updates preserve known platform and migration', () => {
  const store = new DiagnosticStore(null, () => now);
  store.setState({ platform: 'android', migration: 'complete' }); store.setState({ databaseOpen: true }); store.setState({ integrityIssueCount: 2 });
  assert.equal(store.report().state.platform, 'android'); assert.equal(store.report().state.migration, 'complete'); assert.equal(store.report().state.databaseOpen, true);
});

test('WP33 diagnostics construct only allowlisted fields at runtime', () => {
  const storage = memory(); const store = new DiagnosticStore(storage, () => now);
  for (const secret of secrets) store.record({ operation: 'storage.open', code: 'STORAGE_OPEN_FAILED', outcome: 'failure', durationMs: 10, amount: 12345.67, budget: 998877, description: secret, note: secret, image: secret, error: new Error(secret), request: secret, extra: { token: secret } });
  const output = JSON.stringify(store.report());
  for (const secret of secrets) assert.ok(!output.includes(secret), secret);
  assert.ok(!output.includes('12345.67')); assert.ok(!output.includes('998877'));
  assert.equal(store.report().recentErrors.length, secrets.length);
  assert.equal(store.report().format, 'spendwise-technical-diagnostics-v1');
  assert.equal(store.report().app.version, '2.0.0');
  assert.equal(store.report().schemaVersion, 1); assert.equal(store.report().backupVersion, 3);
  assert.equal(store.report().recentErrors[0].timestamp, now);
});

test('unknown strings, nonfinite values and arbitrary timestamps cannot enter reports', () => {
  const store = new DiagnosticStore(null, () => now);
  store.record({ operation: secrets[0], code: secrets[1], outcome: 'failure', timestamp: secrets[2], durationMs: Infinity, httpClass: secrets[3], retry: secrets[4] });
  const report = store.report(); const output = JSON.stringify(report);
  for (const secret of secrets) assert.ok(!output.includes(secret));
  assert.equal(report.recentErrors[0].operation, 'other'); assert.equal(report.recentErrors[0].code, 'UNKNOWN_TECHNICAL_ERROR');
  assert.equal(report.recentErrors[0].timestamp, now); assert.equal(report.recentErrors[0].durationMs, undefined);
});

test('routine successes are aggregates and never a chronological activity history', () => {
  const storage = memory(); const store = new DiagnosticStore(storage, () => now);
  for (let i = 0; i < 200; i++) store.record({ operation: 'storage.open', outcome: 'success', durationMs: 20 });
  assert.equal(store.report().recentErrors.length, 0);
  assert.equal(store.report().timings['storage.open']?.count, 200);
  assert.equal(store.report().timings['storage.open']?.meanMs, 20);
  assert.equal(JSON.parse(storage.getItem(DIAGNOSTIC_STORAGE_KEY)!).recentErrors.length, 0);
});

test('technical failures have strict record, byte and seven-day retention bounds', () => {
  let clock = now; const storage = memory(); const store = new DiagnosticStore(storage, () => clock);
  for (let i = 0; i < 500; i++) { clock++; store.record({ operation: 'backup.restore', outcome: 'failure', code: 'BACKUP_RESTORE_FAILED', durationMs: 20 }); }
  assert.equal(store.report().recentErrors.length, MAX_DIAGNOSTIC_RECORDS);
  assert.equal(store.report().recentErrors[0].timestamp, now + 500 - MAX_DIAGNOSTIC_RECORDS + 1);
  assert.ok(Buffer.byteLength(storage.getItem(DIAGNOSTIC_STORAGE_KEY)!) <= MAX_DIAGNOSTIC_BYTES);
  clock += DIAGNOSTIC_RETENTION_MS;
  assert.equal(store.report().recentErrors.length, 0);
  assert.equal(new DiagnosticStore(storage, () => clock).report().recentErrors.length, 0);
});

test('reload and export sanitize poisoned records and future timestamps again', () => {
  const storage = memory();
  storage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify({ version: 1, state: { platform: secrets[0], migration: secrets[1], error: secrets[2], databaseOpen: true }, recentErrors: [{ operation: secrets[3], code: secrets[4], outcome: 'failure', timestamp: now, description: secrets[5], durationMs: -1 }, { operation: 'storage.open', code: 'STORAGE_OPEN_FAILED', outcome: 'failure', timestamp: now + 100_000 }], timings: { [secrets[6]]: { count: 3, totalMs: 4 }, 'storage.open': { count: -1, totalMs: NaN, description: secrets[7] } }, token: secrets[8] }));
  const report = new DiagnosticStore(storage, () => now).report(); const output = JSON.stringify(report);
  for (const secret of secrets) assert.ok(!output.includes(secret));
  assert.equal(report.recentErrors.length, 1); assert.equal(report.recentErrors[0].durationMs, undefined);
  assert.equal(report.state.databaseOpen, true); assert.equal(report.state.platform, 'unknown');
});

test('oversized, malformed and unversioned stored diagnostics are discarded independently', () => {
  for (const input of ['{bad', '{}', 'x'.repeat(MAX_DIAGNOSTIC_BYTES + 1)]) {
    const storage = memory(); storage.setItem(DIAGNOSTIC_STORAGE_KEY, input); storage.setItem('spendwise_expenses', 'financial-data');
    const store = new DiagnosticStore(storage, () => now); assert.equal(store.report().recentErrors.length, 0);
    assert.equal(storage.getItem('spendwise_expenses'), 'financial-data');
  }
});

test('diagnostic snapshots cannot mutate retained errors, state or timings', () => {
  const store = new DiagnosticStore(null, () => now); store.setState({ databaseOpen: true });
  store.record({ operation: 'storage.open', code: 'STORAGE_OPEN_FAILED', outcome: 'failure', durationMs: 5 });
  const report = store.report(); report.recentErrors[0].code = 'UNKNOWN_TECHNICAL_ERROR'; report.state.databaseOpen = false; report.timings['storage.open']!.count = 900;
  assert.equal(store.report().recentErrors[0].code, 'STORAGE_OPEN_FAILED'); assert.equal(store.report().state.databaseOpen, true); assert.equal(store.report().timings['storage.open']!.count, 1);
});

test('collection, reload, report and clear tolerate storage access failures', () => {
  const bad = { getItem() { throw new Error(secrets[0]); }, setItem() { throw new Error(secrets[1]); }, removeItem() { throw new Error(secrets[2]); } };
  const store = new DiagnosticStore(bad, () => now);
  assert.doesNotThrow(() => { store.setState({ platform: 'android', mediaEncrypted: true }); store.record({ operation: 'media.init', outcome: 'failure', code: 'MEDIA_INIT_FAILED' }); store.report(); store.clear(); });
  assert.equal(store.report().recentErrors.length, 0);
});

test('technical state allowlists omit media paths, financial counts and credential material', () => {
  const store = new DiagnosticStore(null, () => now);
  store.setState({ platform: 'android', migration: 'verified', databaseOpen: true, databaseEncrypted: true, mediaEncrypted: false, photoCount: 5, integrityIssueCount: 2, amount: 9, budgetCount: 3, expenseCount: 8, token: secrets[0], fileName: secrets[1], keyStatus: secrets[2] });
  const state = store.report().state;
  assert.equal(state.migration, 'verified'); assert.equal(state.photoCount, 5); assert.equal(state.integrityIssueCount, 2);
  assert.ok(!JSON.stringify(state).includes(secrets[0])); assert.equal('amount' in state, false); assert.equal('expenseCount' in state, false);
});
