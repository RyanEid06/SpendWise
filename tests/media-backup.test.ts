import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import type { BackupSettings, Expense, ExpenseAttachment } from '../src/types';
import type { FinancialState } from '../src/utils/financialState';
import {
  BACKUP_V2_MANIFEST_PATH,
  BackupV2AttachmentRecord,
  createBackupV2Archive,
  previewValidatedBackupV2,
  restoreBackupV2WithAdapters,
  validateBackupV2Archive,
} from '../src/utils/backupV2';
import { analyzeMediaIntegrity, planSafeMediaRepair } from '../src/utils/mediaIntegrity';

const expense = (id = 1, amount = 20): Expense => ({
  id,
  amount,
  description: `Expense ${id}`,
  category: 'Food',
  date: 1_780_000_000_000 + id,
  note: null,
  createdAt: 1_780_000_100_000 + id,
});

const attachment = (id: string, expenseId = 1, byteSize = 4): ExpenseAttachment => ({
  id,
  expenseId,
  storageKey: `expense-attachments/${id}.jpg`,
  mimeType: 'image/jpeg',
  createdAt: 1_780_000_200_000 + expenseId,
  originalFilename: `${id}.jpg`,
  kind: 'receipt',
  byteSize,
  width: 640,
  height: 480,
});

const settings: BackupSettings = { currencyCode: 'USD', themeMode: 'DARK', language: 'en' };

function stateWith(attachments: ExpenseAttachment[] = [attachment('a1')]): FinancialState {
  return {
    expenses: [expense()],
    budgets: [{ monthKey: '2026-09', startingAmount: 500, updatedAt: 1_780_000_300_000 }],
    attachments,
    currencyCode: 'USD',
  };
}

function mediaReader(item: ExpenseAttachment): Promise<Blob> {
  const bytes = new Uint8Array(item.byteSize).fill(item.id.charCodeAt(0) || 1);
  return Promise.resolve(new Blob([bytes], { type: 'image/jpeg' }));
}

async function rewriteManifest(blob: Blob, mutate: (manifest: any) => void, removeEntry?: string): Promise<Blob> {
  const zip = await JSZip.loadAsync(blob);
  const manifest = JSON.parse(await zip.file(BACKUP_V2_MANIFEST_PATH)!.async('string'));
  mutate(manifest);
  zip.file(BACKUP_V2_MANIFEST_PATH, JSON.stringify(manifest));
  if (removeEntry) zip.remove(removeEntry);
  return zip.generateAsync({ type: 'blob' });
}

test('media audit reports counts, bytes and correct ownership state', () => {
  const state = stateWith([attachment('a1', 1, 4)]);
  const report = analyzeMediaIntegrity(state.expenses, state.attachments, [
    { storageKey: 'expense-attachments/a1.jpg', byteSize: 4 },
  ], 123);
  assert.equal(report.totalMetadataRecords, 1);
  assert.equal(report.totalMetadataBytes, 4);
  assert.equal(report.kindCounts.receipt, 1);
  assert.equal(report.healthy, true);
  assert.equal(report.checkedAt, 123);
});

test('media audit detects orphan file, missing file, broken ownership, duplicates and invalid metadata', () => {
  const attachments = [
    attachment('same', 999, 4),
    { ...attachment('same', 1, 5), storageKey: 'expense-attachments/shared.jpg' },
    { ...attachment('third', 1, 6), storageKey: 'expense-attachments/shared.jpg', mimeType: 'text/plain' },
  ];
  const report = analyzeMediaIntegrity([expense()], attachments, [
    { storageKey: 'expense-attachments/shared.jpg', byteSize: 5 },
    { storageKey: 'expense-attachments/orphan.jpg', byteSize: 9 },
  ]);
  assert.ok(report.orphanFileCount >= 1);
  assert.ok(report.missingFileCount >= 1);
  assert.ok(report.missingExpenseCount >= 1);
  assert.ok(report.duplicateIdCount >= 1);
  assert.ok(report.duplicateStorageKeyCount >= 1);
  assert.ok(report.invalidMetadataCount >= 1);
  assert.equal(report.healthy, false);
});

test('safe media repair deletes only clear orphans and missing-file metadata', () => {
  const missing = attachment('missing');
  const ambiguous = { ...attachment('ambiguous'), expenseId: 999 };
  const report = analyzeMediaIntegrity([expense()], [missing, ambiguous], [
    { storageKey: ambiguous.storageKey, byteSize: ambiguous.byteSize },
    { storageKey: 'expense-attachments/orphan.jpg', byteSize: 9 },
  ]);
  const plan = planSafeMediaRepair(report);
  assert.deepEqual(plan.removeAttachmentIds, ['missing']);
  assert.deepEqual(plan.deleteStorageKeys, ['expense-attachments/orphan.jpg']);
  assert.ok(!plan.removeAttachmentIds.includes('ambiguous'));
});

test('Backup v2 data-only export is explicit and contains no media binaries', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: false,
    readMedia: mediaReader,
  });
  const validated = await validateBackupV2Archive(blob);
  const preview = previewValidatedBackupV2(validated);
  assert.equal(preview.mediaIncluded, false);
  assert.equal(preview.totalAttachments, 1);
  assert.equal(preview.mediaBytes, 0);
  assert.equal(validated.manifest.attachments[0].mediaEntry, null);
});

test('Backup v2 full export validates photo size, checksum and relationship', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: true,
    readMedia: mediaReader,
  });
  const validated = await validateBackupV2Archive(blob);
  assert.equal(validated.manifest.mediaIncluded, true);
  assert.equal(validated.manifest.counts.mediaFiles, 1);
  assert.equal(validated.manifest.attachments[0].expenseId, 1);
  assert.equal(validated.manifest.attachments[0].byteSize, 4);
  assert.match(validated.manifest.attachments[0].checksumSha256 || '', /^[a-f0-9]{64}$/);
});

test('Backup v2 replace round trip restores ledger and photo ownership', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: true,
    readMedia: mediaReader,
  });
  let current: FinancialState = {
    expenses: [expense(9, 90)],
    budgets: [],
    attachments: [attachment('old', 9)],
    currencyCode: 'USD',
  };
  let currentSettings: BackupSettings = { currencyCode: 'USD', themeMode: 'LIGHT', language: 'fr' };
  const deleted: string[] = [];
  const summary = await restoreBackupV2WithAdapters(blob, true, {
    getState: () => current,
    getSettings: () => currentSettings,
    replaceState: async (next) => { current = next; },
    setSettings: async (next) => { currentSettings = next; },
    stageMedia: async (source, targetExpenseId, media) => ({
      id: `restored-${source.id}`,
      expenseId: targetExpenseId,
      storageKey: `expense-attachments/restored-${source.id}.jpg`,
      mimeType: source.mimeType,
      createdAt: source.createdAt,
      originalFilename: source.originalFilename,
      kind: source.kind,
      byteSize: media.size,
      width: source.width,
      height: source.height,
    }),
    deleteFiles: async (items) => { deleted.push(...items.map((item) => item.id)); },
  });
  assert.equal(summary.photosImported, 1);
  assert.equal(current.expenses[0].id, 1);
  assert.equal(current.attachments[0].expenseId, 1);
  assert.equal(currentSettings.themeMode, 'DARK');
  assert.deepEqual(deleted, ['old']);
});

test('Backup v2 merge remaps conflicting expense IDs and their photos', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: true,
    readMedia: mediaReader,
  });
  let current: FinancialState = {
    expenses: [{ ...expense(1), description: 'Existing', createdAt: 1_700_000_000_000 }],
    budgets: [],
    attachments: [],
    currencyCode: 'USD',
  };
  let stagedExpenseId = 0;
  const summary = await restoreBackupV2WithAdapters(blob, false, {
    getState: () => current,
    getSettings: () => settings,
    replaceState: async (next) => { current = next; },
    setSettings: async () => {},
    stageMedia: async (source, targetExpenseId, media) => {
      stagedExpenseId = targetExpenseId;
      return {
        id: 'merged-photo',
        expenseId: targetExpenseId,
        storageKey: 'expense-attachments/merged-photo.jpg',
        mimeType: source.mimeType,
        createdAt: source.createdAt,
        originalFilename: null,
        kind: source.kind,
        byteSize: media.size,
        width: source.width,
        height: source.height,
      };
    },
    deleteFiles: async () => {},
  });
  assert.equal(summary.expensesImported, 1);
  assert.equal(stagedExpenseId, 2);
  assert.equal(current.attachments[0].expenseId, 2);
});

test('Backup v2 merge skips photos when the owning expense is a duplicate', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: true,
    readMedia: mediaReader,
  });
  let current = stateWith([]);
  let stageCalls = 0;
  const summary = await restoreBackupV2WithAdapters(blob, false, {
    getState: () => current,
    getSettings: () => settings,
    replaceState: async (next) => { current = next; },
    setSettings: async () => {},
    stageMedia: async () => {
      stageCalls++;
      throw new Error('should not stage duplicate photo');
    },
    deleteFiles: async () => {},
  });
  assert.equal(summary.expensesSkipped, 1);
  assert.equal(summary.photosSkipped, 1);
  assert.equal(stageCalls, 0);
});

test('Backup v2 supports multiple photos and the 8-photo limit', async () => {
  const eight = Array.from({ length: 8 }, (_, index) => attachment(`a${index + 1}`, 1, 4));
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(eight),
    settings,
    includeMedia: false,
    readMedia: mediaReader,
  });
  const validated = await validateBackupV2Archive(blob);
  assert.equal(validated.manifest.attachments.length, 8);

  const nine = await rewriteManifest(blob, (manifest) => {
    const extra = { ...manifest.attachments[0], id: 'ninth', storageKey: 'expense-attachments/ninth.jpg' };
    manifest.attachments.push(extra);
    manifest.counts.attachments = 9;
  });
  await assert.rejects(() => validateBackupV2Archive(nine), /ATTACHMENT_LIMIT/);
});

test('Backup v2 rejects corrupt archive', async () => {
  await assert.rejects(
    () => validateBackupV2Archive(new Blob(['not a zip'], { type: 'application/zip' })),
    /ARCHIVE_CORRUPT/
  );
});

test('Backup v2 rejects missing media entry', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: true,
    readMedia: mediaReader,
  });
  const validated = await validateBackupV2Archive(blob);
  const missing = validated.manifest.attachments[0].mediaEntry!;
  const tampered = await rewriteManifest(blob, () => {}, missing);
  await assert.rejects(() => validateBackupV2Archive(tampered), /MEDIA_COUNT_MISMATCH|MEDIA_MISSING/);
});

test('Backup v2 rejects invalid manifest and unsupported schema', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: false,
    readMedia: mediaReader,
  });
  const invalid = await rewriteManifest(blob, (manifest) => { manifest.format = 'wrong'; });
  await assert.rejects(() => validateBackupV2Archive(invalid), /FORMAT_INVALID/);
  const unsupported = await rewriteManifest(blob, (manifest) => { manifest.backupSchemaVersion = 99; });
  await assert.rejects(() => validateBackupV2Archive(unsupported), /SCHEMA_UNSUPPORTED/);
});

test('Backup v2 rejects duplicate attachment IDs and storage keys', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith([attachment('a1'), attachment('a2')]),
    settings,
    includeMedia: false,
    readMedia: mediaReader,
  });
  const duplicateId = await rewriteManifest(blob, (manifest) => {
    manifest.attachments[1].id = manifest.attachments[0].id;
  });
  await assert.rejects(() => validateBackupV2Archive(duplicateId), /ATTACHMENT_INVALID/);

  const duplicateKey = await rewriteManifest(blob, (manifest) => {
    manifest.attachments[1].storageKey = manifest.attachments[0].storageKey;
  });
  await assert.rejects(() => validateBackupV2Archive(duplicateKey), /ATTACHMENT_INVALID/);
});

test('Backup v2 data-only replace remains internally consistent with no fake photo metadata', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: false,
    readMedia: mediaReader,
  });
  let current = stateWith([attachment('old')]);
  const summary = await restoreBackupV2WithAdapters(blob, true, {
    getState: () => current,
    getSettings: () => settings,
    replaceState: async (next) => { current = next; },
    setSettings: async () => {},
    stageMedia: async () => { throw new Error('must not stage data-only backup'); },
    deleteFiles: async () => {},
  });
  assert.equal(summary.photosImported, 0);
  assert.equal(summary.photosSkipped, 1);
  assert.deepEqual(current.attachments, []);
});

test('failed Backup v2 restore leaves old state intact and cleans staged media', async () => {
  const blob = await createBackupV2Archive({
    appVersion: '1.0.0',
    state: stateWith(),
    settings,
    includeMedia: true,
    readMedia: mediaReader,
  });
  const old = stateWith([]);
  let current = old;
  const cleaned: string[] = [];
  await assert.rejects(
    () =>
      restoreBackupV2WithAdapters(blob, true, {
        getState: () => current,
        getSettings: () => settings,
        replaceState: async () => { throw new Error('SIMULATED_DB_FAILURE'); },
        setSettings: async () => {},
        stageMedia: async (source, targetExpenseId, media) => ({
          id: 'staged',
          expenseId: targetExpenseId,
          storageKey: 'expense-attachments/staged.jpg',
          mimeType: source.mimeType,
          createdAt: source.createdAt,
          originalFilename: null,
          kind: source.kind,
          byteSize: media.size,
          width: source.width,
          height: source.height,
        }),
        deleteFiles: async (items) => { cleaned.push(...items.map((item) => item.id)); },
      }),
    /SIMULATED_DB_FAILURE/
  );
  assert.deepEqual(current, old);
  assert.deepEqual(cleaned, ['staged']);
});
