import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import type { BackupSettings, Expense, ExpenseAttachment } from '../src/types';
import type { FinancialState } from '../src/utils/financialState';
import {
  BACKUP_V2_MANIFEST_PATH,
  createBackupV2Archive,
  restoreBackupV2WithAdapters,
  validateBackupV2Archive,
  type BackupV2AttachmentRecord,
  type BackupV2RestoreAdapters,
} from '../src/utils/backupV2';
import {
  BACKUP_V3_KDF,
  BACKUP_V3_VERSION,
  createBackupV3Envelope,
  previewBackupV3Envelope,
  readBackupV3Header,
  restoreBackupV3WithAdapters,
} from '../src/utils/backupV3';
import { StorageManager } from '../src/utils/storage';

const settings: BackupSettings = {
  currencyCode: 'USD',
  themeMode: 'DARK',
  language: 'en',
};

function expense(id: number, category = 'Food', amount = 20): Expense {
  return {
    id,
    amount,
    description: 'Expense ' + id,
    category,
    date: 1_780_000_000_000 + id,
    note: id % 2 ? 'note ' + id : null,
    createdAt: 1_780_000_100_000 + id,
  };
}

function attachment(id: string, expenseId: number, byteSize = 128): ExpenseAttachment {
  return {
    id,
    expenseId,
    storageKey: 'expense-attachments/' + id + '.jpg',
    mimeType: 'image/jpeg',
    createdAt: 1_780_000_200_000 + expenseId,
    originalFilename: id + '.jpg',
    kind: 'receipt',
    byteSize,
    width: 640,
    height: 480,
  };
}

function jpegBytes(size: number, fill = 7): Uint8Array {
  const length = Math.max(4, size);
  const bytes = new Uint8Array(length).fill(fill);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[length - 2] = 0xff;
  bytes[length - 1] = 0xd9;
  return bytes;
}

function stateWith(options?: {
  expenses?: Expense[];
  attachments?: ExpenseAttachment[];
  currencyCode?: string;
}): FinancialState {
  const expenses = options?.expenses ?? [expense(1)];
  return {
    expenses,
    budgets: [
      { monthKey: '2026-09', startingAmount: 500, updatedAt: 1_780_000_300_000 },
      { monthKey: '2026-10', startingAmount: 650, updatedAt: 1_780_000_400_000 },
    ],
    attachments: options?.attachments ?? [],
    currencyCode: options?.currencyCode ?? 'USD',
  };
}

function mediaReader(item: ExpenseAttachment): Promise<Blob> {
  return Promise.resolve(new Blob([jpegBytes(item.byteSize, item.id.charCodeAt(0) || 7)], { type: 'image/jpeg' }));
}

async function innerBackup(state: FinancialState, includeMedia: boolean): Promise<Blob> {
  return createBackupV2Archive({
    appVersion: '1.4.0',
    state,
    settings: { ...settings, currencyCode: state.currencyCode },
    includeMedia,
    readMedia: mediaReader,
  });
}

async function secureBackup(
  state: FinancialState,
  includeMedia: boolean,
  passphrase = 'correct horse battery staple'
): Promise<Blob> {
  return createBackupV3Envelope({
    payload: await innerBackup(state, includeMedia),
    passphrase,
    mediaIncluded: includeMedia,
  });
}

function restoreHarness(initial: FinancialState, initialSettings: BackupSettings = settings) {
  let current = structuredClone(initial) as FinancialState;
  let currentSettings = { ...initialSettings };
  const deleted: string[] = [];
  const staged: string[] = [];
  const adapters: BackupV2RestoreAdapters = {
    getState: () => structuredClone(current) as FinancialState,
    getSettings: () => ({ ...currentSettings }),
    replaceState: async (next) => {
      current = structuredClone(next) as FinancialState;
    },
    setSettings: async (next) => {
      currentSettings = { ...next };
    },
    stageMedia: async (source: BackupV2AttachmentRecord, targetExpenseId: number, blob: Blob) => {
      const id = 'restored-' + source.id;
      staged.push(id);
      return {
        id,
        expenseId: targetExpenseId,
        storageKey: 'expense-attachments/' + id + '.jpg',
        mimeType: 'image/jpeg',
        createdAt: source.createdAt,
        originalFilename: source.originalFilename ?? null,
        kind: source.kind,
        byteSize: blob.size,
        width: source.width,
        height: source.height,
      };
    },
    deleteFiles: async (items) => {
      deleted.push(...items.map((item) => item.id));
    },
  };
  return {
    adapters,
    current: () => current,
    currentSettings: () => currentSettings,
    deleted,
    staged,
  };
}

function mutateEnvelopeHeader(blob: Blob, mutate: (header: any) => void): Promise<Blob> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerLength = view.getUint32(5, false);
    const headerBytes = bytes.slice(9, 9 + headerLength);
    const header = JSON.parse(new TextDecoder().decode(headerBytes));
    mutate(header);
    const replacement = new TextEncoder().encode(JSON.stringify(header));
    if (replacement.byteLength !== headerLength) {
      throw new Error('test mutation must preserve header length');
    }
    bytes.set(replacement, 9);
    return new Blob([bytes]);
  });
}

async function rewriteManifest(blob: Blob, mutate: (manifest: any) => void): Promise<Blob> {
  const zip = await JSZip.loadAsync(blob);
  const manifest = JSON.parse(await zip.file(BACKUP_V2_MANIFEST_PATH)!.async('string'));
  mutate(manifest);
  zip.file(BACKUP_V2_MANIFEST_PATH, JSON.stringify(manifest));
  return zip.generateAsync({ type: 'blob' });
}

function findEocdOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('EOCD not found');
}

function centralDirectoryEntries(bytes: Uint8Array): Array<{ offset: number; path: string }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocdOffset(bytes);
  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: Array<{ offset: number; path: string }> = [];
  for (let index = 0; index < totalEntries; index++) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      offset,
      path: decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength)),
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function mutateZipBytes(blob: Blob, mutate: (bytes: Uint8Array) => void): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  mutate(bytes);
  return new Blob([bytes], { type: 'application/zip' });
}

test('Backup v3 round trip uses Argon2id + AES-GCM with unique salt and nonce', async () => {
  const state = stateWith({ expenses: [expense(1, 'Food'), expense(2, 'Transport', 33)] });
  const payload = await innerBackup(state, false);
  const first = await createBackupV3Envelope({ payload, passphrase: 'very strong passphrase', mediaIncluded: false });
  const second = await createBackupV3Envelope({ payload, passphrase: 'very strong passphrase', mediaIncluded: false });

  const firstHeader = await readBackupV3Header(first);
  const secondHeader = await readBackupV3Header(second);
  assert.equal(firstHeader.formatVersion, BACKUP_V3_VERSION);
  assert.equal(firstHeader.kdf.algorithm, 'argon2id');
  assert.equal(firstHeader.kdf.parametersVersion, 1);
  assert.equal(firstHeader.kdf.memorySizeKiB, BACKUP_V3_KDF.memorySizeKiB);
  assert.equal(firstHeader.cipher.algorithm, 'AES-256-GCM');
  assert.notEqual(firstHeader.kdf.saltBase64, secondHeader.kdf.saltBase64);
  assert.notEqual(firstHeader.cipher.nonceBase64, secondHeader.cipher.nonceBase64);

  const preview = await previewBackupV3Envelope(first, 'very strong passphrase');
  assert.equal(preview.schemaVersion, 3);
  assert.equal(preview.totalExpenses, 2);
  assert.equal(preview.totalBudgets, 2);
  assert.equal(preview.currencyCode, 'USD');
  assert.equal(preview.mediaIncluded, false);
});

test('wrong passphrase, AAD/header tamper, ciphertext tamper, tag tamper, truncation and unsupported version fail closed', async () => {
  const backup = await secureBackup(stateWith(), false, 'portable secret');

  await assert.rejects(
    () => previewBackupV3Envelope(backup, 'wrong secret'),
    /BACKUP_WRONG_PASSPHRASE_OR_TAMPER/
  );

  const headerTampered = await mutateEnvelopeHeader(backup, (header) => {
    const current = header.kdf.saltBase64 as string;
    header.kdf.saltBase64 = (current[0] === 'A' ? 'B' : 'A') + current.slice(1);
  });
  await assert.rejects(
    () => previewBackupV3Envelope(headerTampered, 'portable secret'),
    /BACKUP_WRONG_PASSPHRASE_OR_TAMPER/
  );

  const bytes = new Uint8Array(await backup.arrayBuffer());
  const headerLength = new DataView(bytes.buffer).getUint32(5, false);
  const cipherStart = 9 + headerLength;

  const ciphertextTampered = bytes.slice();
  ciphertextTampered[cipherStart] ^= 0x01;
  await assert.rejects(
    () => previewBackupV3Envelope(new Blob([ciphertextTampered]), 'portable secret'),
    /BACKUP_WRONG_PASSPHRASE_OR_TAMPER/
  );

  const tagTampered = bytes.slice();
  tagTampered[tagTampered.length - 1] ^= 0x01;
  await assert.rejects(
    () => previewBackupV3Envelope(new Blob([tagTampered]), 'portable secret'),
    /BACKUP_WRONG_PASSPHRASE_OR_TAMPER/
  );

  await assert.rejects(
    () => previewBackupV3Envelope(backup.slice(0, backup.size - 1), 'portable secret'),
    /BACKUP_V3_ENVELOPE_TRUNCATED/
  );

  const unsupported = bytes.slice();
  unsupported[4] = 99;
  await assert.rejects(
    () => previewBackupV3Envelope(new Blob([unsupported]), 'portable secret'),
    /BACKUP_V3_VERSION_UNSUPPORTED/
  );

  const badKdf = await mutateEnvelopeHeader(backup, (header) => {
    header.kdf.memorySizeKiB = 99_999;
  });
  await assert.rejects(
    () => previewBackupV3Envelope(badKdf, 'portable secret'),
    /BACKUP_V3_KDF_PARAMETERS_INVALID/
  );
});

test('Backup v3 supports data-only, 1 photo, 8 photos, large valid media and attachment mapping', async () => {
  const one = stateWith({ attachments: [attachment('a1', 1, 256)] });
  const oneBackup = await secureBackup(one, true);
  const onePreview = await previewBackupV3Envelope(oneBackup, 'correct horse battery staple');
  assert.equal(onePreview.mediaIncluded, true);
  assert.equal(onePreview.totalAttachments, 1);

  const eightAttachments = Array.from({ length: 8 }, (_, index) => attachment('p' + (index + 1), 1, 128 + index));
  const eight = await secureBackup(stateWith({ attachments: eightAttachments }), true);
  const eightPreview = await previewBackupV3Envelope(eight, 'correct horse battery staple');
  assert.equal(eightPreview.totalAttachments, 8);

  const large = await secureBackup(
    stateWith({ attachments: [attachment('large', 1, 2 * 1024 * 1024)] }),
    true
  );
  const largePreview = await previewBackupV3Envelope(large, 'correct horse battery staple');
  assert.equal(largePreview.mediaBytes, 2 * 1024 * 1024);

  const harness = restoreHarness(stateWith({ expenses: [], attachments: [] }));
  const summary = await restoreBackupV3WithAdapters(
    oneBackup,
    'correct horse battery staple',
    true,
    harness.adapters
  );
  assert.equal(summary.schemaVersion, 3);
  assert.equal(summary.photosImported, 1);
  assert.equal(harness.current().attachments[0].expenseId, harness.current().expenses[0].id);
});

test('fresh-install replace restore preserves multiple expenses, budgets, categories and currency across restart state', async () => {
  const source = stateWith({
    expenses: [
      expense(1, 'Food', 11),
      expense(2, 'Transport', 22),
      expense(3, 'Gifts', 33),
    ],
    currencyCode: 'EUR',
  });
  const backup = await secureBackup(source, false);
  const empty: FinancialState = { expenses: [], budgets: [], attachments: [], currencyCode: 'USD' };
  const harness = restoreHarness(empty, { currencyCode: 'USD', themeMode: 'LIGHT', language: 'fr' });

  const summary = await restoreBackupV3WithAdapters(
    backup,
    'correct horse battery staple',
    true,
    harness.adapters
  );
  assert.equal(summary.expensesImported, 3);
  assert.equal(summary.budgetsImported, 2);
  assert.equal(harness.current().currencyCode, 'EUR');
  assert.deepEqual(harness.current().expenses.map((item) => item.category), ['Food', 'Transport', 'Gifts']);

  const restartedState = structuredClone(harness.current()) as FinancialState;
  assert.equal(restartedState.expenses.length, 3);
  assert.equal(restartedState.budgets.length, 2);
  assert.equal(restartedState.currencyCode, 'EUR');
});

test('merge keeps currency safeguard and replace adopts backup currency', async () => {
  const backup = await secureBackup(stateWith({ currencyCode: 'EUR' }), false);
  const existing = stateWith({ expenses: [expense(9, 'Existing', 99)], currencyCode: 'USD' });

  const mergeHarness = restoreHarness(existing);
  await assert.rejects(
    () => restoreBackupV3WithAdapters(backup, 'correct horse battery staple', false, mergeHarness.adapters),
    /BACKUP_CURRENCY_MISMATCH/
  );
  assert.equal(mergeHarness.current().currencyCode, 'USD');
  assert.equal(mergeHarness.current().expenses.length, 1);

  const replaceHarness = restoreHarness(existing);
  await restoreBackupV3WithAdapters(backup, 'correct horse battery staple', true, replaceHarness.adapters);
  assert.equal(replaceHarness.current().currencyCode, 'EUR');
});

test('DB/media failures and partial staging preserve old state and clean staged files', async () => {
  const backup = await secureBackup(
    stateWith({ attachments: [attachment('a1', 1), attachment('a2', 1)] }),
    true
  );
  const old = stateWith({ expenses: [expense(9)], attachments: [attachment('old', 9)] });

  let current = structuredClone(old) as FinancialState;
  const cleaned: string[] = [];
  let stageCount = 0;
  let replaceCalls = 0;
  await assert.rejects(
    () =>
      restoreBackupV3WithAdapters(backup, 'correct horse battery staple', true, {
        getState: () => structuredClone(current) as FinancialState,
        getSettings: () => settings,
        replaceState: async (next) => {
          current = structuredClone(next) as FinancialState;
          replaceCalls++;
          if (replaceCalls === 1) throw new Error('SIMULATED_DB_FAILURE');
        },
        setSettings: async () => {},
        stageMedia: async (source, targetExpenseId, blob) => ({
          id: 'stage-' + source.id,
          expenseId: targetExpenseId,
          storageKey: 'expense-attachments/stage-' + source.id + '.jpg',
          mimeType: 'image/jpeg',
          createdAt: source.createdAt,
          originalFilename: null,
          kind: source.kind,
          byteSize: blob.size,
          width: source.width,
          height: source.height,
        }),
        deleteFiles: async (items) => cleaned.push(...items.map((item) => item.id)),
      }),
    /SIMULATED_DB_FAILURE/
  );
  assert.deepEqual(current, old);
  assert.deepEqual(cleaned.sort(), ['stage-a1', 'stage-a2']);

  current = structuredClone(old) as FinancialState;
  const partialCleaned: string[] = [];
  await assert.rejects(
    () =>
      restoreBackupV3WithAdapters(backup, 'correct horse battery staple', true, {
        getState: () => structuredClone(current) as FinancialState,
        getSettings: () => settings,
        replaceState: async (next) => { current = structuredClone(next) as FinancialState; },
        setSettings: async () => {},
        stageMedia: async (source, targetExpenseId, blob) => {
          stageCount++;
          if (stageCount === 2) throw new Error('SIMULATED_MEDIA_FAILURE');
          return {
            id: 'partial-' + source.id,
            expenseId: targetExpenseId,
            storageKey: 'expense-attachments/partial-' + source.id + '.jpg',
            mimeType: 'image/jpeg',
            createdAt: source.createdAt,
            originalFilename: null,
            kind: source.kind,
            byteSize: blob.size,
            width: source.width,
            height: source.height,
          };
        },
        deleteFiles: async (items) => partialCleaned.push(...items.map((item) => item.id)),
      }),
    /SIMULATED_MEDIA_FAILURE/
  );
  assert.deepEqual(current, old);
  assert.deepEqual(partialCleaned, ['partial-a1']);
});

test('legacy v1, v2 and v3 import formats remain accepted', async () => {
  const legacy = {
    metadata: {
      appVersion: '1.4.0',
      schemaVersion: 1,
      exportedAt: 1_780_000_000_000,
      exportedAtFormatted: '2026-09-30 12:00:00',
      totalExpenses: 1,
      totalBudgets: 1,
    },
    settings,
    monthlyBudgets: [{ monthKey: '2026-09', startingAmount: 500, updatedAt: 1_780_000_300_000 }],
    expenses: [{
      id: 1,
      amount: 20,
      description: 'Legacy',
      category: 'Food',
      date: 1_780_000_000_001,
      dateFormatted: '2026-05-27',
      note: null,
      createdAt: 1_780_000_100_001,
    }],
  };
  assert.equal(StorageManager.validateBackup(legacy).metadata.schemaVersion, 1);

  const v2 = await innerBackup(stateWith(), false);
  assert.equal((await validateBackupV2Archive(v2)).manifest.backupSchemaVersion, 2);

  const v3 = await createBackupV3Envelope({
    payload: v2,
    passphrase: 'compatibility passphrase',
    mediaIncluded: false,
  });
  assert.equal((await previewBackupV3Envelope(v3, 'compatibility passphrase')).schemaVersion, 3);
});

test('malicious v2 payloads are rejected before v3 restore mutation', async () => {
  const base = await innerBackup(stateWith({ attachments: [attachment('a1', 1)] }), false);

  const ninth = await rewriteManifest(base, (manifest) => {
    for (let i = 2; i <= 9; i++) {
      manifest.attachments.push({
        ...manifest.attachments[0],
        id: 'a' + i,
        storageKey: 'expense-attachments/a' + i + '.jpg',
      });
    }
    manifest.counts.attachments = 9;
  });
  await assert.rejects(() => validateBackupV2Archive(ninth), /BACKUP_V2_ATTACHMENT_LIMIT/);

  const duplicateId = await rewriteManifest(
    await innerBackup(stateWith({ attachments: [attachment('a1', 1), attachment('a2', 1)] }), false),
    (manifest) => { manifest.attachments[1].id = manifest.attachments[0].id; }
  );
  await assert.rejects(() => validateBackupV2Archive(duplicateId), /BACKUP_V2_ATTACHMENT_INVALID/);

  const oversized = await rewriteManifest(base, (manifest) => {
    manifest.attachments[0].byteSize = 6 * 1024 * 1024;
  });
  await assert.rejects(() => validateBackupV2Archive(oversized), /BACKUP_V2_ATTACHMENT_INVALID/);

  const traversal = new JSZip();
  traversal.file(BACKUP_V2_MANIFEST_PATH, '{}');
  traversal.file('../evil.jpg', jpegBytes(16));
  const traversalBlob = await traversal.generateAsync({ type: 'blob' });
  await assert.rejects(() => validateBackupV2Archive(traversalBlob), /BACKUP_V2_PATH_INVALID/);

  const bomb = new JSZip();
  bomb.file(BACKUP_V2_MANIFEST_PATH, '{}');
  bomb.file('media/bomb.jpg', jpegBytes(6 * 1024 * 1024), { compression: 'DEFLATE' });
  const bombBlob = await bomb.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  await assert.rejects(() => validateBackupV2Archive(bombBlob), /BACKUP_V2_MEDIA_SIZE_MISMATCH/);
});


test('ZIP entry-count, aggregate-size and duplicate-path bombs are rejected before inflation', async () => {
  const tiny = new JSZip();
  tiny.file(BACKUP_V2_MANIFEST_PATH, '{}');
  tiny.file('media/a1.jpg', jpegBytes(16));
  tiny.file('media/a2.jpg', jpegBytes(16));
  const tinyBlob = await tiny.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const excessiveFiles = await mutateZipBytes(tinyBlob, (bytes) => {
    const eocd = findEocdOffset(bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    view.setUint16(eocd + 8, 10_001, true);
    view.setUint16(eocd + 10, 10_001, true);
  });
  await assert.rejects(() => validateBackupV2Archive(excessiveFiles), /BACKUP_V2_ARCHIVE_LIMIT/);

  const duplicatePaths = await mutateZipBytes(tinyBlob, (bytes) => {
    const entries = centralDirectoryEntries(bytes);
    const second = entries.find((entry) => entry.path === 'media/a2.jpg');
    assert.ok(second);
    const nameStart = second.offset + 46;
    const current = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + 'media/a2.jpg'.length));
    assert.equal(current, 'media/a2.jpg');
    bytes[nameStart + 'media/a'.length] = '1'.charCodeAt(0);
  });
  await assert.rejects(() => validateBackupV2Archive(duplicatePaths), /BACKUP_V2_DUPLICATE_PATH/);

  const aggregate = new JSZip();
  aggregate.file(BACKUP_V2_MANIFEST_PATH, '{}');
  for (let index = 0; index < 130; index++) {
    aggregate.file('media/p' + String(index).padStart(3, '0') + '.jpg', jpegBytes(16), { compression: 'DEFLATE' });
  }
  const aggregateBlob = await aggregate.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const aggregateBomb = await mutateZipBytes(aggregateBlob, (bytes) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (const entry of centralDirectoryEntries(bytes)) {
      if (entry.path.startsWith('media/') && entry.path.endsWith('.jpg')) {
        view.setUint32(entry.offset + 24, 4 * 1024 * 1024, true);
      }
    }
  });
  await assert.rejects(() => validateBackupV2Archive(aggregateBomb), /BACKUP_V2_ARCHIVE_LIMIT/);
});

test('unsafe numeric magnitudes are rejected in v1 and v2 backup input', async () => {
  const v2 = await innerBackup(stateWith(), false);
  const overflowV2 = await rewriteManifest(v2, (manifest) => {
    manifest.expenses[0].amount = Number.MAX_VALUE;
  });
  await assert.rejects(() => validateBackupV2Archive(overflowV2), /LEGACY_EXPENSES_INVALID_RECORD/);

  const legacy = {
    metadata: {
      appVersion: '1.4.0',
      schemaVersion: 1,
      exportedAt: 1_780_000_000_000,
      exportedAtFormatted: '2026-09-30 12:00:00',
      totalExpenses: 1,
      totalBudgets: 0,
    },
    settings,
    monthlyBudgets: [],
    expenses: [{
      id: 1,
      amount: Number.MAX_VALUE,
      description: 'Overflow',
      category: 'Other',
      date: 1_780_000_000_001,
      dateFormatted: '2026-05-27',
      note: null,
      createdAt: 1_780_000_100_001,
    }],
  };
  assert.throws(() => StorageManager.validateBackup(legacy), /invalid or duplicate expense/i);
});

test('corrupted v3 photo is rejected before restore mutation', async () => {
  const source = stateWith({ attachments: [attachment('bad', 1, 64)] });
  const corruptInner = await createBackupV2Archive({
    appVersion: '1.4.0',
    state: source,
    settings,
    includeMedia: true,
    readMedia: async () => new Blob([new Uint8Array(64).fill(3)], { type: 'image/jpeg' }),
  });
  const secure = await createBackupV3Envelope({
    payload: corruptInner,
    passphrase: 'corrupt media passphrase',
    mediaIncluded: true,
  });
  const old = stateWith({ expenses: [expense(9)], attachments: [] });
  const harness = restoreHarness(old);
  await assert.rejects(
    () => restoreBackupV3WithAdapters(secure, 'corrupt media passphrase', true, harness.adapters),
    /BACKUP_V3_MEDIA_CORRUPT/
  );
  assert.deepEqual(harness.current(), old);
});

test('Backup v3 secrets stay out of persistence/logging and do not reuse WP29 keys', () => {
  const backupV3 = readFileSync('src/utils/backupV3.ts', 'utf8');
  const service = readFileSync('src/features/backup/BackupService.ts', 'utf8');
  const settingsScreen = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');

  assert.match(backupV3, /argon2id/);
  assert.match(backupV3, /AES-GCM/);
  assert.match(backupV3, /additionalData/);
  assert.doesNotMatch(backupV3, /SecureKeyService|secureKeyService|MEDIA_KEY|DB_SECRET|SQLCipher/);
  assert.doesNotMatch(backupV3, /localStorage|PreferencesRepository|database/i);
  assert.doesNotMatch(backupV3, /console\.(log|info|debug|warn|error)/);
  assert.doesNotMatch(service, /console\.(log|info|debug).*passphrase/i);
  assert.doesNotMatch(settingsScreen, /localStorage.*passphrase|setItem\([^)]*passphrase/i);
  assert.doesNotMatch(backupV3, /App Lock PIN|LOCK_PIN|getLockPin|webPin/i);
});

test('restoreV2 remains usable directly after WP30 compatibility hardening', async () => {
  const v2 = await innerBackup(stateWith(), false);
  const harness = restoreHarness({ expenses: [], budgets: [], attachments: [], currencyCode: 'USD' });
  const summary = await restoreBackupV2WithAdapters(v2, true, harness.adapters);
  assert.equal(summary.schemaVersion, 2);
  assert.equal(summary.expensesImported, 1);
});
