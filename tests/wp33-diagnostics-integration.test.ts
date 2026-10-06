import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diagnostics, measureDiagnostic } from '../src/services/diagnostics/diagnostics';
import { BackupService } from '../src/features/backup/BackupService';
import { StorageManager } from '../src/utils/storage';
import { LocalDataStoreImpl } from '../src/utils/localDataStore';
import { buildTechnicalDiagnosticExport } from '../src/services/diagnostics/exportDiagnostics';

test('operation measurement preserves result and original failure while omitting error payload', async () => {
  diagnostics.clear(); const result = { token: 'never-record-this-result' };
  assert.equal(await measureDiagnostic('storage.read', async () => result), result);
  const failure = new Error('secret-passphrase-receipt-key');
  await assert.rejects(measureDiagnostic('backup.restore', async () => { throw failure; }), (error) => error === failure);
  const output = JSON.stringify(diagnostics.report()); assert.ok(!output.includes('secret-passphrase')); assert.ok(!output.includes('never-record-this-result'));
  assert.equal(diagnostics.report().recentErrors.at(-1)?.code, 'BACKUP_RESTORE_FAILED');
});

test('BackupService observes v3 failures without capturing passphrase, file or financial payload', async () => {
  const original = StorageManager.createBackupV3; const originalRestore = StorageManager.restoreBackupV3;
  try {
    diagnostics.clear();
    StorageManager.createBackupV3 = async () => { throw new Error('private-receipt-provider-message'); };
    StorageManager.restoreBackupV3 = async () => { throw new Error('private-financial-body'); };
    const service = new BackupService();
    await assert.rejects(service.createV3(false, 'private-passphrase'));
    await assert.rejects(service.restoreV3(new Blob(['private-backup-contents']), 'private-passphrase', false));
    assert.deepEqual(diagnostics.report().recentErrors.map((item) => item.code), ['BACKUP_CREATE_FAILED', 'BACKUP_RESTORE_FAILED']);
    assert.ok(!JSON.stringify(diagnostics.report()).includes('private-'));
  } finally { StorageManager.createBackupV3 = original; StorageManager.restoreBackupV3 = originalRestore; }
});

test('actual isolated storage init reports technical state and keeps unreadable data fail-closed', async () => {
  diagnostics.clear(); const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const store = new LocalDataStoreImpl(); await store.init(storage);
  assert.equal(diagnostics.report().state.platform, 'web'); assert.equal(diagnostics.report().state.databaseOpen, true); assert.equal(diagnostics.report().state.databaseEncrypted, false);
  values.set('spendwise_expenses', 'malformed-sensitive-financial-data');
  await assert.rejects(new LocalDataStoreImpl().init(storage));
  assert.equal(values.get('spendwise_expenses'), 'malformed-sensitive-financial-data'); assert.ok(!JSON.stringify(diagnostics.report()).includes('sensitive-financial'));
});

test('technical exports have identifiable filenames, technical-only content and bounded size', () => {
  const exported = buildTechnicalDiagnosticExport();
  assert.match(exported.fileName, /^SpendWise-technical-diagnostics-\d{4}-\d{2}-\d{2}\.json$/);
  const report = JSON.parse(exported.content); assert.equal(report.format, 'spendwise-technical-diagnostics-v1');
  assert.ok(Buffer.byteLength(exported.content) <= 64 * 1024); assert.ok(!exported.content.includes('private-'));
});

test('client logging sites never print raw errors and bootstrap has diagnostics without ledger access', () => {
  const undo = readFileSync('src/app/hooks/useExpenseDeleteUndo.ts', 'utf8');
  assert.doesNotMatch(undo, /console\.(error|warn)\([^\n]*error\b/);
  assert.match(undo, /DELETE_COMMIT_FAILED/);
  const bootstrap = readFileSync('src/main.tsx', 'utf8'); assert.match(bootstrap, /TechnicalDiagnostics/); assert.match(bootstrap, /measureDiagnostic\('security.init'/);
  const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8'); assert.doesNotMatch(settings, /TechnicalDiagnostics/);
  const overview = readFileSync('src/features/settings/SettingsOverview.tsx', 'utf8'); assert.doesNotMatch(overview, /technicalDiagnostics/);
});
