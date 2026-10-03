import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { ExpenseAttachment, ExpenseAttachmentKind } from '../types';
import { secureKeyService } from '../security/SecureKeyService';
import {
  decryptMediaBytes,
  encryptMediaBytes,
} from '../security/EncryptedMediaCodec';
import {
  analyzeMediaIntegrity,
  MediaBinaryInventoryItem,
  MediaIntegrityReport,
  planSafeMediaRepair,
} from './mediaIntegrity';
import { LocalDataStore } from './localDataStore';

const ATTACHMENT_DIR = 'expense-attachments';
const SECURE_ATTACHMENT_DIR = 'expense-attachments/secure';
const MEDIA_DB_NAME = 'spendwise_media_v1';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE_NAME = 'attachments';
const MEDIA_MIGRATION_KEY = 'spendwise_media_encryption_migration_v1';

export const MEDIA_KEY_PURPOSE = 'spendwise.media.v1';
export const MAX_ATTACHMENTS_PER_EXPENSE = 8;
export const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_STORED_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 2048;

type MediaMigrationPhase = 'staging' | 'metadata_committed' | 'complete';

interface MediaMigrationRecord {
  version: 1;
  phase: MediaMigrationPhase;
  attachmentCount: number;
  updatedAt: number;
}

export interface AttachmentDraft {
  blob: Blob;
  mimeType: string;
  originalFilename?: string | null;
  kind: ExpenseAttachmentKind;
  width: number;
  height: number;
  byteSize: number;
}

export interface AttachmentEditPayload {
  newAttachments: AttachmentDraft[];
  removedAttachmentIds: string[];
}

export interface PreparedAttachmentChanges {
  nextAttachments: ExpenseAttachment[];
  stagedAttachments: ExpenseAttachment[];
  removedAttachments: ExpenseAttachment[];
}

let maintenanceScheduled = false;

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function generateAttachmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
}

function legacyStorageKey(id: string): string {
  return ATTACHMENT_DIR + '/' + id + '.jpg';
}

function secureStorageKey(id: string): string {
  return SECURE_ATTACHMENT_DIR + '/' + id + '.swm';
}

function getStorageKey(id: string): string {
  return isNativeAndroid() ? secureStorageKey(id) : legacyStorageKey(id);
}

export function isSecureMediaStorageKey(storageKey: string): boolean {
  return (
    storageKey.startsWith(SECURE_ATTACHMENT_DIR + '/') &&
    storageKey.endsWith('.swm')
  );
}

function isLegacyNativeStorageKey(storageKey: string): boolean {
  return (
    storageKey.startsWith(ATTACHMENT_DIR + '/') &&
    !storageKey.startsWith(SECURE_ATTACHMENT_DIR + '/')
  );
}

function readMigrationRecord(): MediaMigrationRecord | null {
  const raw = localStorage.getItem(MEDIA_MIGRATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MediaMigrationRecord;
    if (
      parsed.version !== 1 ||
      !['staging', 'metadata_committed', 'complete'].includes(parsed.phase) ||
      !Number.isInteger(parsed.attachmentCount) ||
      parsed.attachmentCount < 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeMigrationRecord(
  phase: MediaMigrationPhase,
  attachmentCount: number
): void {
  localStorage.setItem(
    MEDIA_MIGRATION_KEY,
    JSON.stringify({
      version: 1,
      phase,
      attachmentCount,
      updatedAt: Date.now(),
    } satisfies MediaMigrationRecord)
  );
}

function openMediaDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('ATTACHMENT_STORAGE_UNAVAILABLE'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        db.createObjectStore(MEDIA_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('ATTACHMENT_STORAGE_UNAVAILABLE'));
  });
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      tx.objectStore(MEDIA_STORE_NAME).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('ATTACHMENT_WRITE_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('ATTACHMENT_WRITE_FAILED'));
    });
  } finally {
    db.close();
  }
}

async function idbGet(key: string): Promise<Blob> {
  const db = await openMediaDb();
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const request = tx.objectStore(MEDIA_STORE_NAME).get(key);
      request.onsuccess = () => {
        if (request.result instanceof Blob) resolve(request.result);
        else reject(new Error('ATTACHMENT_MISSING'));
      };
      request.onerror = () => reject(request.error || new Error('ATTACHMENT_READ_FAILED'));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(key: string): Promise<void> {
  const db = await openMediaDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      tx.objectStore(MEDIA_STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('ATTACHMENT_DELETE_FAILED'));
      tx.onabort = () => reject(tx.error || new Error('ATTACHMENT_DELETE_FAILED'));
    });
  } finally {
    db.close();
  }
}

async function idbEntries(): Promise<MediaBinaryInventoryItem[]> {
  const db = await openMediaDb();
  try {
    return await new Promise<MediaBinaryInventoryItem[]>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const store = tx.objectStore(MEDIA_STORE_NAME);
      const request = store.openCursor();
      const results: MediaBinaryInventoryItem[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        const value = cursor.value;
        results.push({
          storageKey: String(cursor.key),
          byteSize: value instanceof Blob ? value.size : 0,
          valid: value instanceof Blob,
        });
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error('ATTACHMENT_READ_FAILED'));
    });
  } finally {
    db.close();
  }
}

async function idbKeys(): Promise<string[]> {
  const db = await openMediaDb();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const request = tx.objectStore(MEDIA_STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result.map(String));
      request.onerror = () => reject(request.error || new Error('ATTACHMENT_READ_FAILED'));
    });
  } finally {
    db.close();
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    for (let index = 0; index < chunk.length; index += 1) {
      output += String.fromCharCode(chunk[index]);
    }
  }
  return btoa(output);
}

function base64ToBytes(value: string): Uint8Array {
  const comma = value.indexOf(',');
  const base64 = comma >= 0 ? value.slice(comma + 1) : value;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readNativeBytes(storageKey: string): Promise<Uint8Array> {
  const result = await Filesystem.readFile({
    path: storageKey,
    directory: Directory.Data,
  });
  if (result.data instanceof Blob) {
    return new Uint8Array(await result.data.arrayBuffer());
  }
  return base64ToBytes(String(result.data));
}

async function writeNativeBytes(
  storageKey: string,
  bytes: Uint8Array
): Promise<void> {
  await Filesystem.writeFile({
    path: storageKey,
    data: bytesToBase64(bytes),
    directory: Directory.Data,
    recursive: true,
  });
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function withMediaKey<T>(
  consumer: (key: Uint8Array) => Promise<T>
): Promise<T> {
  const result = await secureKeyService.withUnwrappedSecret(
    MEDIA_KEY_PURPOSE,
    consumer
  );
  if (!result.ok) {
    throw new Error(`MEDIA_KEY_UNWRAP_${result.code ?? result.kind}`);
  }
  return result.value;
}

async function ensureMediaKey(): Promise<void> {
  if (secureKeyService.hasWrappedSecret(MEDIA_KEY_PURPOSE)) return;
  const result = await secureKeyService.ensureWrappedSecret(
    MEDIA_KEY_PURPOSE,
    32
  );
  if (!result.ok) {
    throw new Error(`MEDIA_KEY_SETUP_${result.code ?? result.kind}`);
  }
}

async function writeEncryptedVerified(
  storageKey: string,
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<void> {
  const envelope = await encryptMediaBytes(plaintext, key);
  await writeNativeBytes(storageKey, envelope);

  const persisted = await readNativeBytes(storageKey);
  const verified = await decryptMediaBytes(persisted, key);
  try {
    if (!bytesEqual(plaintext, verified)) {
      throw new Error('MEDIA_WRITE_VERIFICATION_FAILED');
    }
  } finally {
    verified.fill(0);
  }
}

async function verifyEncryptedAttachment(
  item: ExpenseAttachment,
  key: Uint8Array
): Promise<void> {
  if (!isSecureMediaStorageKey(item.storageKey)) {
    throw new Error('MEDIA_SECURE_STORAGE_KEY_REQUIRED');
  }
  const envelope = await readNativeBytes(item.storageKey);
  const plaintext = await decryptMediaBytes(envelope, key);
  try {
    if (plaintext.byteLength !== item.byteSize) {
      throw new Error('MEDIA_PLAINTEXT_SIZE_MISMATCH');
    }
  } finally {
    plaintext.fill(0);
  }
}

async function deleteNativeFileStrict(storageKey: string): Promise<void> {
  await Filesystem.deleteFile({
    path: storageKey,
    directory: Directory.Data,
  });
}

async function deleteBinary(storageKey: string): Promise<void> {
  if (isNativeAndroid()) {
    try {
      await deleteNativeFileStrict(storageKey);
    } catch {
      // Missing detached files are already effectively deleted.
    }
    return;
  }
  try {
    await idbDelete(storageKey);
  } catch {
    // Browser storage may already have been cleared outside SpendWise.
  }
}

async function saveBinary(storageKey: string, blob: Blob): Promise<void> {
  if (!isNativeAndroid()) {
    await idbPut(storageKey, blob);
    return;
  }
  if (!isSecureMediaStorageKey(storageKey)) {
    throw new Error('MEDIA_SECURE_STORAGE_KEY_REQUIRED');
  }

  await ensureMediaKey();
  const plaintext = new Uint8Array(await blob.arrayBuffer());
  try {
    await withMediaKey(async (key) => {
      try {
        await writeEncryptedVerified(storageKey, plaintext, key);
      } catch (error) {
        try {
          await deleteNativeFileStrict(storageKey);
        } catch {
          // Preserve the original write/verification error.
        }
        throw error;
      }
    });
  } finally {
    plaintext.fill(0);
  }
}

async function readBinaryBlob(item: ExpenseAttachment): Promise<Blob> {
  if (!isNativeAndroid()) return idbGet(item.storageKey);
  if (!isSecureMediaStorageKey(item.storageKey)) {
    throw new Error('MEDIA_NOT_MIGRATED');
  }

  return withMediaKey(async (key) => {
    const envelope = await readNativeBytes(item.storageKey);
    const plaintext = await decryptMediaBytes(envelope, key);
    try {
      if (plaintext.byteLength !== item.byteSize) {
        throw new Error('MEDIA_PLAINTEXT_SIZE_MISMATCH');
      }
      const copy = plaintext.slice();
      return new Blob([copy.buffer as ArrayBuffer], { type: item.mimeType });
    } finally {
      plaintext.fill(0);
    }
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('ATTACHMENT_UNSUPPORTED'));
    };
    image.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob && blob.size > 0
          ? resolve(blob)
          : reject(new Error('ATTACHMENT_PROCESSING_FAILED')),
      'image/jpeg',
      quality
    );
  });
}

async function renderImage(
  image: HTMLImageElement,
  maxDimension: number,
  quality: number
) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('ATTACHMENT_UNSUPPORTED');
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ATTACHMENT_PROCESSING_FAILED');
  context.drawImage(image, 0, 0, width, height);
  return { blob: await canvasToJpeg(canvas, quality), width, height };
}

async function listNativeDirectory(path: string) {
  try {
    return (await Filesystem.readdir({ path, directory: Directory.Data })).files;
  } catch {
    return [];
  }
}

async function deleteLegacyPlaintextFilesStrict(): Promise<void> {
  const files = await listNativeDirectory(ATTACHMENT_DIR);
  for (const file of files) {
    if (file.type !== 'file') continue;
    await deleteNativeFileStrict(ATTACHMENT_DIR + '/' + file.name);
  }
}

export class AttachmentStorage {
  static getAllAttachments(): ExpenseAttachment[] {
    return LocalDataStore.getAttachments();
  }

  static getAttachmentsForExpense(expenseId: number): ExpenseAttachment[] {
    return LocalDataStore.getAttachments()
      .filter((item) => item.expenseId === expenseId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  static hasAttachments(expenseId: number): boolean {
    return LocalDataStore.getAttachments().some((item) => item.expenseId === expenseId);
  }

  static async ensureNativeEncryption(): Promise<void> {
    if (!isNativeAndroid()) return;

    const before = LocalDataStore.snapshot();
    const migration = readMigrationRecord();
    const hasEncryptedMetadata = before.attachments.some((item) =>
      isSecureMediaStorageKey(item.storageKey)
    );
    if (
      hasEncryptedMetadata &&
      !secureKeyService.hasWrappedSecret(MEDIA_KEY_PURPOSE)
    ) {
      throw new Error('MEDIA_KEY_MISSING');
    }

    const allMetadataEncrypted = before.attachments.every((item) =>
      isSecureMediaStorageKey(item.storageKey)
    );
    if (
      migration?.phase === 'complete' &&
      allMetadataEncrypted &&
      secureKeyService.hasWrappedSecret(MEDIA_KEY_PURPOSE)
    ) {
      // Normal startup is O(1) in media count. The completed migration already
      // verified every file; validate one representative against the session
      // key, then only enforce that no legacy plaintext was reintroduced.
      // A damaged attachment is isolated by authenticated on-demand reads;
      // it must not prevent opening the independently encrypted ledger.
      if (before.attachments.length > 0) {
        await withMediaKey(async (key) => {
          try {
            await verifyEncryptedAttachment(before.attachments[0], key);
          } catch (error) {
            if (!(error instanceof Error) || !(
              error.message.startsWith('MEDIA_ENVELOPE_') ||
              error.message === 'MEDIA_AUTHENTICATION_FAILED' ||
              error.message === 'MEDIA_PLAINTEXT_SIZE_MISMATCH'
            )) throw error;
          }
        });
      }
      await deleteLegacyPlaintextFilesStrict();
      return;
    }

    await ensureMediaKey();
    await withMediaKey(async (key) => {
      const nextAttachments: ExpenseAttachment[] = [];
      let metadataChanged = false;

      for (const item of before.attachments) {
        if (isSecureMediaStorageKey(item.storageKey)) {
          await verifyEncryptedAttachment(item, key);
          nextAttachments.push({ ...item });
          continue;
        }
        if (!isLegacyNativeStorageKey(item.storageKey)) {
          throw new Error('MEDIA_STORAGE_KEY_UNSUPPORTED');
        }

        writeMigrationRecord('staging', before.attachments.length);
        const plaintext = await readNativeBytes(item.storageKey);
        try {
          if (plaintext.byteLength !== item.byteSize) {
            throw new Error('MEDIA_LEGACY_SIZE_MISMATCH');
          }
          const targetKey = secureStorageKey(item.id);
          await writeEncryptedVerified(targetKey, plaintext, key);
          nextAttachments.push({ ...item, storageKey: targetKey });
          metadataChanged = true;
        } finally {
          plaintext.fill(0);
        }
      }

      if (metadataC…2285 tokens truncated…dFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateBackupV2Archive } from '../src/utils/backupV2';

const bash = process.env.WP32_BASH || (process.platform === 'win32'
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const shellPath = (value: string) => value.replace(/\\/g, '/');

function generateFixtures(directory: string) {
  const result = spawnSync(process.execPath, [
    'node_modules/tsx/dist/cli.mjs', 'scripts/wp32-generate-portable-fixtures.ts', directory,
  ], { encoding: 'utf8', env: { ...process.env, WP32_FIXTURE_MONTH: '2027-02' } });
  assert.equal(result.status, 0, result.stderr);
}

test('legacy v1 fixture dates and budget match the month exercised by History', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-v1-'));
  try {
    generateFixtures(directory);
    const fixture = JSON.parse(readFileSync(path.join(directory, 'wp32-v1.json'), 'utf8'));
    assert.equal(fixture.expenses.length, 2);
    for (const expense of fixture.expenses) {
      assert.equal(new Date(expense.date).toISOString().slice(0, 7), '2027-02');
      assert.equal(expense.dateFormatted, '2027-02-01');
    }
    assert.equal(fixture.monthlyBudgets[0].monthKey, '2027-02');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('v2 archives restore into the tested month with representative valid media', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-v2-'));
  try {
    generateFixtures(directory);
    for (const mode of ['data', 'full']) {
      const bytes = readFileSync(path.join(directory, `wp32-v2-${mode}.zip`));
      const { manifest, zip } = await validateBackupV2Archive(new Blob([bytes]));
      assert.equal(new Date(manifest.expenses[0].date).toISOString().slice(0, 7), '2027-02');
      assert.equal(manifest.monthlyBudgets[0].monthKey, '2027-02');
      assert.equal(manifest.mediaIncluded, mode === 'full');
      if (mode === 'full') {
        const media = manifest.attachments[0];
        assert.equal(media.width, 1024);
        assert.equal(media.height, 1024);
        const restored = await zip.file(media.mediaEntry!)!.async('nodebuffer');
        assert.deepEqual(restored, readFileSync('tests/fixtures/media/wp32-photo-01.jpg'));
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('both Android entrypoints parse before any emulator work begins', () => {
  for (const file of ['scripts/run-wp32-android-e2e.sh', 'scripts/run-wp32-backup-restore-targeted.sh']) {
    const result = spawnSync(bash, ['-n', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('Maestro owns app startup without a preceding host accessibility session', () => {
  for (const file of ['scripts/run-wp32-android-e2e.sh', 'scripts/run-wp32-backup-restore-targeted.sh']) {
    const directory = mkdtempSync(path.join(tmpdir(), 'wp32-launch-'));
    try {
      const result = spawnSync(bash, ['-c', `
set -euo pipefail
host_started=0
adb() {
  if [[ "$*" == 'shell am start '* ]]; then host_started=1; fi
  if [[ "$*" == 'shell dumpsys activity activities' ]]; then
    printf 'mResumedActivity com.spendwise.app/.MainActivity\\n'
  fi
}
maestro() {
  if [[ "$host_started" != 0 ]]; then
    echo 'Host launched WebView before Maestro attached' >&2
    return 13
  fi
  echo MAESTRO_COLD_LAUNCH_READY
  return 12
}
source "$WP32_ENTRYPOINT"
`], { encoding: 'utf8', env: {
        ...process.env, WP32_ENTRYPOINT: file,
        RESULT_ROOT: shellPath(path.join(directory, 'results')).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
        FIXTURE_ROOT: shellPath(path.join(directory, 'fixtures')).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
      } });
      assert.equal(result.status, 12, `${file}: ${result.stderr}`);
      assert.match(result.stdout, /MAESTRO_COLD_LAUNCH_READY/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('backup extraction selects the exact export mode from CRLF adb paths', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-runner-'));
  const data = path.join(directory, 'data.swb3');
  const full = path.join(directory, 'full.swb3');
  try {
    const result = spawnSync(bash, ['-c', `
set -euo pipefail
APP_ID=com.spendwise.app
source scripts/wp32-android-helpers.sh
adb() {
  if [[ "$*" == 'shell run-as com.spendwise.app find cache -type f' ]]; then
    printf 'cache/spendwise_backup_v3_full_2026-10-03.swb3\\r\\ncache/spendwise_backup_v3_data_2026-10-03.swb3\\r\\ncache/unrelated.swb3\\r\\n'
  elif [[ "$*" == 'exec-out run-as com.spendwise.app cat cache/spendwise_backup_v3_data_2026-10-03.swb3' ]]; then
    printf 'DATA_ONLY'
  elif [[ "$*" == 'exec-out run-as com.spendwise.app cat cache/spendwise_backup_v3_full_2026-10-03.swb3' ]]; then
    printf 'FULL_WITH_PHOTOS'
  else
    echo "Unexpected adb arguments: $*" >&2
    return 1
  fi
}
extract_backup_prefix spendwise_backup_v3_data_ "$WP32_DATA"
extract_backup_prefix spendwise_backup_v3_full_ "$WP32_FULL"
`], { encoding: 'utf8', env: { ...process.env, WP32_DATA: shellPath(data), WP32_FULL: shellPath(full) } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(data, 'utf8'), 'DATA_ONLY');
    assert.equal(readFileSync(full, 'utf8'), 'FULL_WITH_PHOTOS');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('corruption injection completes enumeration before bounded writes to every encrypted fixture', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-corruption-'));
  const calls = path.join(directory, 'calls.txt');
  writeFileSync(calls, '');
  try {
    const fakeAdb = path.join(directory, 'adb');
    writeFileSync(fakeAdb, `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == 'shell run-as com.spendwise.app find files -type f' ]]; then
  touch "$WP32_CORRUPT_DIR/enumerating"
  printf 'files/expense-attachments/secure/one.swm1\\r\\nfiles/expense-attachments/secure/eight.swm1\\r\\nfiles/expense-attachments/plain.jpg\\r\\n'
  sleep 0.2
  rm "$WP32_CORRUPT_DIR/enumerating"
elif [[ "$*" == 'exec-out run-as com.spendwise.app tee '* ]]; then
  [[ ! -f "$WP32_CORRUPT_DIR/enumerating" ]] || { echo 'Nested adb while enumeration is open' >&2; exit 70; }
  cat > "$WP32_CORRUPT_DIR/\${5##*/}"
elif [[ "$*" == 'shell run-as com.spendwise.app sh -c '* ]]; then
  [[ ! -f "$WP32_CORRUPT_DIR/enumerating" ]] || { echo 'Nested adb while enumeration is open' >&2; exit 70; }
  printf '%s\\n' "$*" >> "$WP32_CALLS"
  mkdir -p "$WP32_CORRUPT_DIR/files/expense-attachments/secure"
  (cd "$WP32_CORRUPT_DIR"; bash -c "sh -c \${*:6}")
elif [[ "$*" == 'exec-out run-as com.spendwise.app cat '* ]]; then
  cat "$WP32_CORRUPT_DIR/$5"
else
  echo "Unexpected adb operation: $*" >&2
  exit 71
fi
`);
    chmodSync(fakeAdb, 0o755);
    const result = spawnSync(bash, ['-c', `
set -euo pipefail
APP_ID=com.spendwise.app
PATH="$(dirname "$WP32_FAKE_ADB"):$PATH"
source scripts/wp32-android-helpers.sh
corrupt_secure_media_files
`], { encoding: 'utf8', timeout: 5000, env: { ...process.env,
      WP32_FAKE_ADB: shellPath(fakeAdb).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
      WP32_CALLS: shellPath(calls), WP32_CORRUPT_DIR: shellPath(directory),
    } });
    assert.equal(result.status, 0, result.stderr);
    const commands = readFileSync(calls, 'utf8');
    assert.match(commands, /one\.swm1/);
    assert.match(commands, /eight\.swm1/);
    assert.doesNotMatch(commands, /plain\.jpg|\r/);
    assert.equal(commands.trim().split('\n').length, 2);
    assert.equal(readFileSync(path.join(directory, 'files/expense-attachments/secure/one.swm1'), 'utf8'), 'WP32_CORRUPTED_CIPHERTEXT');
    assert.equal(readFileSync(path.join(directory, 'files/expense-attachments/secure/eight.swm1'), 'utf8'), 'WP32_CORRUPTED_CIPHERTEXT');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const failure of ['enumeration', 'missing', 'write-hang', 'verification']) {
  test(`corruption injection fails explicitly on ${failure}`, () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'wp32-corruption-failure-'));
    try {
      const fakeAdb = path.join(directory, 'adb');
      writeFileSync(fakeAdb, `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == 'shell run-as com.spendwise.app find files -type f' ]]; then
  [[ "$WP32_FAILURE" != enumeration ]] || exit 9
  [[ "$WP32_FAILURE" != missing ]] || exit 0
  printf 'files/expense-attachments/secure/one.swm1\\n'
elif [[ "$*" == 'shell run-as com.spendwise.app sh -c '* ]]; then
  [[ "$WP32_FAILURE" != write-hang ]] || exec sleep 60
elif [[ "$*" == 'exec-out run-as com.spendwise.app cat '* ]]; then
  printf 'UNCHANGED_CIPHERTEXT'
else
  exit 71
fi
`);
      chmodSync(fakeAdb, 0o755);
      const result = spawnSync(bash, ['-c', `
set -euo pipefail
APP_ID=com.spendwise.app
PATH="$(dirname "$WP32_FAKE_ADB"):$PATH"
source scripts/wp32-android-helpers.sh
corrupt_secure_media_files
`], { encoding: 'utf8', timeout: 20000, env: { ...process.env,
        WP32_FAILURE: failure,
        WP32_FAKE_ADB: shellPath(fakeAdb).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
      } });
      assert.equal(result.error, undefined, 'helper must terminate before the outer test deadline');
      assert.equal(result.status, 1, result.stderr);
      const expected = {
        enumeration: /Could not enumerate/,
        missing: /No encrypted attachment/,
        'write-hang': /Could not corrupt/,
        verification: /corruption was not verified/,
      }[failure];
      assert.match(result.stdout, expected!);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('upgrade seeds the legacy fixture before enabling Android device credentials', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-upgrade-order-'));
  try {
    const result = spawnSync(bash, ['-c', `
set -euo pipefail
pin=0
seeded=0
adb() {
  if [[ "$*" == 'shell locksettings set-pin 2468' ]]; then pin=1; fi
  if [[ "$*" == 'shell locksettings clear --old 2468' ]]; then pin=0; fi
  if [[ "$1" == install && "$2" == -r ]]; then
    [[ "$pin" == 1 && "$seeded" == 1 ]] || return 34
  fi
}
maestro() {
  if [[ "\${@: -1}" == .maestro/migration/v14-seed.yaml ]]; then
    [[ "$pin" == 0 ]] || { echo 'Device keyguard can obscure the legacy seed' >&2; return 33; }
    seeded=1
  else
    [[ "$pin" == 1 && "$seeded" == 1 ]] || return 35
  fi
}
source scripts/run-wp32-isolated-gate.sh
`], { encoding: 'utf8', env: { ...process.env, WP32_TARGET: 'hardened-upgrade',
      RESULT_ROOT: shellPath(directory).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
    } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /isolated target passed: hardened-upgrade/);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
