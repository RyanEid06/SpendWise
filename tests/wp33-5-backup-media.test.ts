import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Expense, ExpenseAttachment } from '../src/types';
import { groupMediaByExpenseDate } from '../src/utils/mediaLibraryGrouping';

function expense(id: number, date: number): Expense {
  return {
    id,
    amount: 10,
    description: `Expense ${id}`,
    category: 'Other',
    date,
    createdAt: date,
  };
}

function attachment(id: string, expenseId: number, createdAt: number): ExpenseAttachment {
  return {
    id,
    expenseId,
    storageKey: `expense-attachments/${id}.jpg`,
    mimeType: 'image/jpeg',
    createdAt,
    originalFilename: `${id}.jpg`,
    kind: 'receipt',
    byteSize: 4,
    width: 1,
    height: 1,
  };
}

function localKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('WP33.5-03 unified backup flow defaults photos off and maps the toggle to existing createV3 behavior', () => {
  const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
  const modal = readFileSync('src/components/BackupPassphraseModal.tsx', 'utf8');

  assert.match(settings, /useState\(false\).*includePhotosInBackup|includePhotosInBackup, setIncludePhotosInBackup\] = useState\(false\)/s);
  assert.match(settings, /handleExportV3\(includePhotosInBackup, passphrase\)/);
  assert.match(settings, /backupService\.createV3\(includeMedia, passphrase\)/);
  assert.match(settings, /spendwise_encrypted_backup_/);
  assert.doesNotMatch(settings, /spendwise_backup_v3_/);
  assert.match(modal, /role="switch"/);
  assert.match(modal, /aria-checked=\{includePhotos\}/);
  assert.match(modal, /Include photos/);
});

test('WP33.5-03 keeps modern restore/import and legacy JSON compatibility reachable', () => {
  const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
  const copy = readFileSync('src/features/settings/settingsCopy.ts', 'utf8');

  assert.match(settings, /copy\.restoreBackup/);
  assert.match(settings, /accept="\.swb3,\.zip,application\/octet-stream,application\/zip"/);
  assert.match(settings, /accept="\.swb3,\.json,\.zip,application\/octet-stream,application\/json,application\/zip"/);
  assert.match(settings, /copy\.legacyTools/);
  assert.match(settings, /handleExportJson/);
  assert.match(copy, /Create encrypted backup/);
  assert.match(copy, /Legacy tools/);
  assert.doesNotMatch(copy, /Backup v3 ·/);
});

test('WP33.5-03 user-facing backup dialogs hide format generation terminology and keep password validation', () => {
  const passphraseModal = readFileSync('src/components/BackupPassphraseModal.tsx', 'utf8');
  const restoreModal = readFileSync('src/components/BackupV2ImportModal.tsx', 'utf8');

  assert.doesNotMatch(passphraseModal, /Backup v3|backup v3|نسخة v3|Backup v3/);
  assert.doesNotMatch(restoreModal, /\{text\.title\} v\{version\}/);
  assert.match(passphraseModal, /length < 8/);
  assert.match(passphraseModal, /passphrase !== confirm/);
  assert.match(passphraseModal, /Backup password/);
  assert.match(passphraseModal, /Confirm password/);
});

test('Media Library groups by linked expense date, with attachment creation date as fallback', () => {
  const oct4 = new Date(2026, 9, 4, 12).getTime();
  const oct5 = new Date(2026, 9, 5, 12).getTime();
  const oct6 = new Date(2026, 9, 6, 12).getTime();
  const oct7 = new Date(2026, 9, 7, 12).getTime();

  const groups = groupMediaByExpenseDate(
    [
      attachment('expense-date-wins', 1, oct7),
      attachment('newest', 2, oct6),
      attachment('legacy-fallback', 999, oct5),
    ],
    [expense(1, oct4), expense(2, oct6)]
  );

  assert.deepEqual(groups.map((group) => group.key), [localKey(oct6), localKey(oct5), localKey(oct4)]);
  assert.deepEqual(groups[0].items.map((item) => item.id), ['newest']);
  assert.deepEqual(groups[1].items.map((item) => item.id), ['legacy-fallback']);
  assert.deepEqual(groups[2].items.map((item) => item.id), ['expense-date-wins']);
});

test('Media Library ordering is deterministic and truly undated legacy media is last', () => {
  const day = new Date(2026, 9, 6, 12).getTime();
  const sameDay = [
    attachment('b', 1, day + 20),
    attachment('a', 1, day + 20),
    attachment('newer-created', 1, day + 30),
    attachment('undated', 999, 0),
  ];
  const groups = groupMediaByExpenseDate(sameDay, [expense(1, day)]);

  assert.equal(groups[0].key, localKey(day));
  assert.deepEqual(groups[0].items.map((item) => item.id), ['newer-created', 'a', 'b']);
  assert.equal(groups.at(-1)?.key, 'unknown');
  assert.deepEqual(groups.at(-1)?.items.map((item) => item.id), ['undated']);
});

test('Backup v3 cryptographic implementation is still Argon2id + AES-256-GCM and untouched by UI routing', () => {
  const backupV3 = readFileSync('src/utils/backupV3.ts', 'utf8');
  const storage = readFileSync('src/utils/storage.ts', 'utf8');

  assert.match(backupV3, /algorithm: 'argon2id'/);
  assert.match(backupV3, /algorithm: 'AES-256-GCM'/);
  assert.match(backupV3, /additionalData: cryptoBuffer\(headerBytes\)/);
  assert.match(storage, /createBackupV3Envelope\(\{ payload, passphrase, mediaIncluded: includeMedia \}\)/);
  assert.match(storage, /restoreBackupV3WithAdapters\(file, passphrase, replaceExisting/);
});
