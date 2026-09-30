import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  decryptMediaBytes,
  encryptMediaBytes,
  inspectMediaEnvelope,
} from '../src/security/EncryptedMediaCodec';
import { decideDatabaseRecovery } from '../src/data/NativeEncryptedDatabaseService';
import {
  analyzeMediaIntegrity,
  planSafeMediaRepair,
} from '../src/utils/mediaIntegrity';
import type { Expense, ExpenseAttachment } from '../src/types';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

function source(path: string): string {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

function bytes(length: number, seed = 17): Uint8Array {
  const value = new Uint8Array(length);
  let state = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    value[index] = state & 0xff;
  }
  return value;
}

test('WP29 media envelope round-trips one attachment and exposes only versioned crypto metadata', async () => {
  const key = bytes(32, 1);
  const plaintext = bytes(18731, 2);
  const envelope = await encryptMediaBytes(plaintext, key);
  const info = inspectMediaEnvelope(envelope);

  assert.equal(info.formatVersion, 1);
  assert.equal(info.algorithm, 'AES-256-GCM');
  assert.equal(info.nonce.byteLength, 12);
  assert.equal(info.plaintextLength, plaintext.byteLength);
  assert.notDeepEqual(envelope.slice(0, Math.min(envelope.length, plaintext.length)), plaintext);

  const decrypted = await decryptMediaBytes(envelope, key);
  assert.deepEqual(decrypted, plaintext);
});

test('WP29 media envelope uses a fresh nonce for each of eight attachments', async () => {
  const key = bytes(32, 3);
  const nonces = new Set<string>();
  for (let index = 0; index < 8; index += 1) {
    const plaintext = bytes(4096 + index, 100 + index);
    const envelope = await encryptMediaBytes(plaintext, key);
    const info = inspectMediaEnvelope(envelope);
    nonces.add(Array.from(info.nonce).join(','));
    assert.deepEqual(await decryptMediaBytes(envelope, key), plaintext);
  }
  assert.equal(nonces.size, 8);
});

test('WP29 media envelope handles a large stored image payload', async () => {
  const key = bytes(32, 4);
  const plaintext = bytes(5 * 1024 * 1024, 5);
  const envelope = await encryptMediaBytes(plaintext, key);
  assert.equal(inspectMediaEnvelope(envelope).plaintextLength, plaintext.byteLength);
  assert.deepEqual(await decryptMediaBytes(envelope, key), plaintext);
});

test('WP29 media decryption rejects a wrong key', async () => {
  const envelope = await encryptMediaBytes(bytes(4096, 6), bytes(32, 7));
  await assert.rejects(
    () => decryptMediaBytes(envelope, bytes(32, 8)),
    /MEDIA_AUTHENTICATION_FAILED/
  );
});

test('WP29 media decryption rejects tampered ciphertext and authentication tag', async () => {
  const key = bytes(32, 9);
  const envelope = await encryptMediaBytes(bytes(8192, 10), key);

  const ciphertextTampered = envelope.slice();
  ciphertextTampered[30] ^= 0x40;
  await assert.rejects(
    () => decryptMediaBytes(ciphertextTampered, key),
    /MEDIA_AUTHENTICATION_FAILED/
  );

  const tagTampered = envelope.slice();
  tagTampered[tagTampered.length - 1] ^= 0x01;
  await assert.rejects(
    () => decryptMediaBytes(tagTampered, key),
    /MEDIA_AUTHENTICATION_FAILED/
  );
});

test('WP29 database recovery planner is idempotent across clean install and interrupted migration phases', () => {
  assert.equal(
    decideDatabaseRecovery({
      sourceExists: false,
      destinationExists: false,
      destinationEncrypted: false,
      migrationPhase: null,
    }),
    'create-encrypted'
  );
  assert.equal(
    decideDatabaseRecovery({
      sourceExists: true,
      destinationExists: false,
      destinationEncrypted: false,
      migrationPhase: null,
    }),
    'migrate-plaintext'
  );
  for (const phase of ['copying', 'copied', 'verified'] as const) {
    assert.equal(
      decideDatabaseRecovery({
        sourceExists: true,
        destinationExists: true,
        destinationEncrypted: true,
        migrationPhase: phase,
      }),
      'restart-migration'
    );
  }
  assert.equal(
    decideDatabaseRecovery({
      sourceExists: true,
      destinationExists: true,
      destinationEncrypted: true,
      migrationPhase: 'active',
    }),
    'resume-active-cleanup'
  );
  assert.equal(
    decideDatabaseRecovery({
      sourceExists: false,
      destinationExists: true,
      destinationEncrypted: true,
      migrationPhase: 'active',
    }),
    'open-encrypted'
  );
  assert.equal(
    decideDatabaseRecovery({
      sourceExists: false,
      destinationExists: true,
      destinationEncrypted: false,
      migrationPhase: null,
    }),
    'fail-unencrypted-destination'
  );
});

test('WP29 SQLCipher configuration and staged migration preserve the plaintext source until activation', () => {
  const config = JSON.parse(source('capacitor.config.json'));
  assert.equal(config.plugins?.CapacitorSQLite?.androidIsEncryption, true);

  const localStore = source('src/utils/localDataStore.ts');
  assert.match(localStore, /nativeEncryptedDatabaseService\.open\(storage\)/);
  assert.doesNotMatch(localStore, /createConnection\([^\n]*no-encryption/);

  const db = source('src/data/NativeEncryptedDatabaseService.ts');
  const schema = source('src/data/databaseSchema.ts');
  assert.match(db, /spendwise_secure_v1/);
  assert.match(db, /spendwise\.db\.v1/);
  assert.match(db, /createConnection\([\s\S]*encrypted[\s\S]*'secret'/);
  assert.match(schema, /PRAGMA integrity_check/);
  assert.match(schema, /PRAGMA foreign_key_check/);
  assert.match(db, /DATABASE_MIGRATION_COUNT_MISMATCH/);
  assert.match(db, /closeConnection\(sqlite, ENCRYPTED_DATABASE_NAME\)/);
  assert.match(db, /writeMigration\([\s\S]*'active'/);

  const activeIndex = db.lastIndexOf("'active'");
  const plaintextDeleteIndex = db.lastIndexOf(
    'deleteDatabase(sqlite, PLAINTEXT_DATABASE_NAME, false)'
  );
  assert.ok(activeIndex >= 0 && plaintextDeleteIndex > activeIndex);
});

test('WP29 retires plaintext legacy financial snapshots only after the encrypted database migration marker is complete', () => {
  const localStore = source('src/utils/localDataStore.ts');
  assert.match(localStore, /clearLegacyFinancialSnapshot/);
  assert.match(localStore, /LEGACY_FINANCIAL_KEYS\.EXPENSES/);
  assert.match(localStore, /LEGACY_FINANCIAL_KEYS\.BUDGETS/);
  assert.match(localStore, /LEGACY_FINANCIAL_KEYS\.ATTACHMENTS/);
  assert.match(localStore, /LEGACY_FINANCIAL_KEYS\.WEB_TXN/);

  const markerIndex = localStore.lastIndexOf(
    "this.setMeta(connection, LEGACY_MIGRATION_KEY, 'complete')"
  );
  const cleanupIndex = localStore.lastIndexOf('clearLegacyFinancialSnapshot(storage)');
  assert.ok(markerIndex >= 0 && cleanupIndex > markerIndex);
});

test('WP29 DB failures do not silently manufacture replacement keys for existing encrypted data', () => {
  const db = source('src/data/NativeEncryptedDatabaseService.ts');
  assert.match(
    db,
    /destinationExists[\s\S]*!this\.keyService\.hasWrappedSecret\(DATABASE_KEY_PURPOSE\)[\s\S]*DATABASE_KEY_MISSING/
  );
  const schema = source('src/data/databaseSchema.ts');
  assert.match(db, /ENCRYPTED_DATABASE_KEY_OR_FORMAT_INVALID/);
  assert.match(schema, /DATABASE_INTEGRITY_CHECK_FAILED/);
  assert.match(schema, /DATABASE_FOREIGN_KEY_CHECK_FAILED/);
  assert.match(db, /PLAINTEXT_DATABASE_CLEANUP_FAILED/);
});

test('WP29 media migration stages encrypted bytes, switches metadata, verifies, then removes plaintext', () => {
  const media = source('src/utils/attachmentStorage.ts');
  assert.match(media, /spendwise\.media\.v1/);
  assert.match(media, /expense-attachments\/secure/);
  assert.match(media, /\.swm/);
  assert.match(media, /encryptMediaBytes/);
  assert.match(media, /decryptMediaBytes/);
  assert.match(media, /writeMigrationRecord\('staging'/);
  assert.match(media, /LocalDataStore\.replaceState/);
  assert.match(media, /writeMigrationRecord\('metadata_committed'/);
  assert.match(media, /deleteLegacyPlaintextFilesStrict/);
  assert.match(media, /writeMigrationRecord\('complete'/);

  const replaceIndex = media.indexOf('await LocalDataStore.replaceState');
  const cleanupIndex = media.indexOf('await deleteLegacyPlaintextFilesStrict');
  assert.ok(replaceIndex >= 0 && cleanupIndex > replaceIndex);
  assert.doesNotMatch(media, /writeFile\(\{[\s\S]{0,160}draft\.blob/);
});

test('WP29 media integrity reports authentication failures without silently deleting metadata', () => {
  const expense: Expense = {
    id: 1,
    amount: 12,
    description: 'Test',
    category: 'Other',
    date: Date.now(),
    note: null,
    createdAt: Date.now(),
  };
  const attachment: ExpenseAttachment = {
    id: 'a',
    expenseId: 1,
    storageKey: 'expense-attachments/secure/a.swm',
    mimeType: 'image/jpeg',
    createdAt: Date.now(),
    originalFilename: 'a.jpg',
    kind: 'receipt',
    byteSize: 100,
    width: 100,
    height: 100,
  };

  const report = analyzeMediaIntegrity(
    [expense],
    [attachment],
    [{ storageKey: attachment.storageKey, byteSize: 0, valid: false }]
  );
  assert.equal(report.unreadableFileCount, 1);
  const repair = planSafeMediaRepair(report);
  assert.deepEqual(repair.removeAttachmentIds, []);
  assert.deepEqual(repair.deleteStorageKeys, []);
});

test('WP29 preserves Backup v1/v2 portability while encrypting only internal storage', () => {
  const storage = source('src/utils/storage.ts');
  const backupV2 = source('src/utils/backupV2.ts');
  assert.match(storage, /createBackupV2Archive/);
  assert.match(storage, /AttachmentStorage\.readAttachmentBlob/);
  assert.match(storage, /AttachmentStorage\.stageBackupMedia/);
  assert.match(backupV2, /mediaIncluded/);
  assert.match(backupV2, /readValidatedBackupMedia/);
  assert.doesNotMatch(backupV2, /spendwise\.media\.v1|SQLCipher|AES-GCM/);
});

test('WP29 keeps encryption details below repository and screen layers and does not log secrets', () => {
  const paths = [
    'src/data/ExpenseRepository.ts',
    'src/data/BudgetRepository.ts',
    'src/data/AttachmentMetadataRepository.ts',
    'src/services/MediaService.ts',
  ];
  for (const path of paths) {
    const value = source(path);
    assert.doesNotMatch(value, /SQLCipher|encryptionSecret|spendwise\.db\.v1|AES-GCM/);
  }

  const db = source('src/data/NativeEncryptedDatabaseService.ts');
  const media = source('src/utils/attachmentStorage.ts');
  const keyService = source('src/security/SecureKeyService.ts');
  assert.doesNotMatch(db, /console\.(log|info|debug).*passphrase|console\.(log|info|debug).*secret/i);
  assert.doesNotMatch(media, /console\.(log|info|debug).*key|console\.(log|info|debug).*secret/i);
  assert.doesNotMatch(keyService, /console\.(log|info|debug).*secret/i);
});

test('WP29 bootstraps the WP28 key hierarchy before opening encrypted storage', () => {
  const main = source('src/main.tsx');
  const storage = source('src/utils/storage.ts');
  assert.ok(
    main.indexOf('secureSessionService.initialize()') <
      main.lastIndexOf('await openProtectedStorage()')
  );
  assert.match(storage, /LocalDataStore\.init\(localStorage\)[\s\S]*AttachmentStorage\.ensureNativeEncryption\(\)/);
});
