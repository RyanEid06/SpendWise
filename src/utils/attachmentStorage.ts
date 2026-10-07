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
  recoveryDraftId?: string;
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

      if (metadataChanged) {
        await LocalDataStore.replaceState({
          ...before,
          attachments: nextAttachments,
        });
        writeMigrationRecord('metadata_committed', nextAttachments.length);
      }

      const active = LocalDataStore.snapshot();
      for (const item of active.attachments) {
        await verifyEncryptedAttachment(item, key);
      }

      // Only after encrypted bytes + metadata are verified do we destroy any
      // legacy plaintext. A crash before this line leaves the old media intact.
      await deleteLegacyPlaintextFilesStrict();
      writeMigrationRecord('complete', active.attachments.length);
    });
  }

  static async prepareImageDraft(
    file: File,
    kind: ExpenseAttachmentKind
  ): Promise<AttachmentDraft> {
    if (!file.type.startsWith('image/')) throw new Error('ATTACHMENT_UNSUPPORTED');
    if (file.size <= 0 || file.size > MAX_INPUT_IMAGE_BYTES) {
      throw new Error('ATTACHMENT_TOO_LARGE');
    }

    const image = await loadImageElement(file);
    let rendered = await renderImage(image, MAX_IMAGE_DIMENSION, 0.86);
    if (rendered.blob.size > MAX_STORED_IMAGE_BYTES) {
      rendered = await renderImage(image, 1600, 0.78);
    }
    if (rendered.blob.size > MAX_STORED_IMAGE_BYTES) {
      throw new Error('ATTACHMENT_TOO_LARGE');
    }

    return {
      blob: rendered.blob,
      mimeType: 'image/jpeg',
      originalFilename: file.name || null,
      kind,
      width: rendered.width,
      height: rendered.height,
      byteSize: rendered.blob.size,
    };
  }

  static async prepareExpenseAttachmentChanges(
    expenseId: number,
    drafts: AttachmentDraft[],
    removedAttachmentIds: string[]
  ): Promise<PreparedAttachmentChanges> {
    const currentForExpense = this.getAttachmentsForExpense(expenseId);
    const removable = new Set(
      currentForExpense
        .filter((item) => removedAttachmentIds.includes(item.id))
        .map((item) => item.id)
    );
    const survivors = currentForExpense.filter((item) => !removable.has(item.id));
    if (survivors.length + drafts.length > MAX_ATTACHMENTS_PER_EXPENSE) {
      throw new Error('ATTACHMENT_LIMIT');
    }

    const stagedAttachments: ExpenseAttachment[] = [];
    try {
      for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index];
        const id = generateAttachmentId();
        const storageKey = getStorageKey(id);
        await saveBinary(storageKey, draft.blob);
        stagedAttachments.push({
          id,
          expenseId,
          storageKey,
          mimeType: draft.mimeType,
          createdAt: Date.now() + index,
          originalFilename: draft.originalFilename || null,
          kind: draft.kind,
          byteSize: draft.byteSize,
          width: draft.width,
          height: draft.height,
        });
      }
    } catch (error) {
      await this.deleteDetachedFiles(stagedAttachments);
      throw error;
    }

    return {
      nextAttachments: survivors.concat(stagedAttachments),
      stagedAttachments,
      removedAttachments: currentForExpense.filter((item) =>
        removable.has(item.id)
      ),
    };
  }

  static async readAttachmentUrl(item: ExpenseAttachment): Promise<string> {
    return URL.createObjectURL(await readBinaryBlob(item));
  }

  static async readAttachmentBlob(item: ExpenseAttachment): Promise<Blob> {
    return readBinaryBlob(item);
  }

  static async stageBackupMedia(
    source: Pick<
      ExpenseAttachment,
      'mimeType' | 'createdAt' | 'originalFilename' | 'kind' | 'width' | 'height'
    >,
    targetExpenseId: number,
    blob: Blob
  ): Promise<ExpenseAttachment> {
    if (
      source.mimeType !== 'image/jpeg' ||
      blob.size <= 0 ||
      blob.size > MAX_STORED_IMAGE_BYTES
    ) {
      throw new Error('BACKUP_MEDIA_INVALID');
    }

    const id = generateAttachmentId();
    const storageKey = getStorageKey(id);
    await saveBinary(storageKey, blob);
    return {
      id,
      expenseId: targetExpenseId,
      storageKey,
      mimeType: 'image/jpeg',
      createdAt: source.createdAt,
      originalFilename: source.originalFilename ?? null,
      kind: source.kind,
      byteSize: blob.size,
      width: source.width,
      height: source.height,
    };
  }

  static async listBinaryInventory(): Promise<MediaBinaryInventoryItem[]> {
    if (!isNativeAndroid()) {
      try {
        return await idbEntries();
      } catch {
        return [];
      }
    }

    const inventory: MediaBinaryInventoryItem[] = [];
    const legacyFiles = await listNativeDirectory(ATTACHMENT_DIR);
    for (const file of legacyFiles) {
      if (file.type !== 'file') continue;
      inventory.push({
        storageKey: ATTACHMENT_DIR + '/' + file.name,
        byteSize: Number(file.size || 0),
        valid: true,
      });
    }

    const secureFiles = await listNativeDirectory(SECURE_ATTACHMENT_DIR);
    if (secureFiles.length === 0) return inventory;
    if (!secureKeyService.hasWrappedSecret(MEDIA_KEY_PURPOSE)) {
      for (const file of secureFiles) {
        if (file.type !== 'file') continue;
        inventory.push({
          storageKey: SECURE_ATTACHMENT_DIR + '/' + file.name,
          byteSize: 0,
          valid: false,
        });
      }
      return inventory;
    }

    await withMediaKey(async (key) => {
      for (const file of secureFiles) {
        if (file.type !== 'file') continue;
        const storageKey = SECURE_ATTACHMENT_DIR + '/' + file.name;
        try {
          const envelope = await readNativeBytes(storageKey);
          const plaintext = await decryptMediaBytes(envelope, key);
          const byteSize = plaintext.byteLength;
          plaintext.fill(0);
          inventory.push({ storageKey, byteSize, valid: true });
        } catch {
          inventory.push({ storageKey, byteSize: 0, valid: false });
        }
      }
    });
    return inventory;
  }

  static async auditIntegrity(): Promise<MediaIntegrityReport> {
    return analyzeMediaIntegrity(
      LocalDataStore.getExpenses(),
      LocalDataStore.getAttachments(),
      await this.listBinaryInventory()
    );
  }

  static async repairIntegrity(): Promise<{
    report: MediaIntegrityReport;
    removedMetadata: number;
    deletedFiles: number;
  }> {
    const report = await this.auditIntegrity();
    const plan = planSafeMediaRepair(report);
    const before = LocalDataStore.snapshot();
    const next = {
      ...before,
      attachments: before.attachments.filter(
        (item) => !plan.removeAttachmentIds.includes(item.id)
      ),
    };
    if (plan.removeAttachmentIds.length > 0) {
      await LocalDataStore.replaceState(next);
    }
    await Promise.allSettled(
      plan.deleteStorageKeys.map((storageKey) => deleteBinary(storageKey))
    );
    return {
      report: await this.auditIntegrity(),
      removedMetadata: plan.removeAttachmentIds.length,
      deletedFiles: plan.deleteStorageKeys.length,
    };
  }

  static revokePreviewUrl(url: string | null | undefined): void {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  static async deleteDetachedFiles(items: ExpenseAttachment[]): Promise<void> {
    await Promise.allSettled(
      items.map((item) => deleteBinary(item.storageKey))
    );
  }

  static scheduleMaintenance(): void {
    if (maintenanceScheduled || typeof window === 'undefined') return;
    maintenanceScheduled = true;
    window.setTimeout(() => void this.repairOrphans(), 0);
  }

  static async repairOrphans(): Promise<void> {
    const referenced = new Set(
      LocalDataStore.getAttachments().map((item) => item.storageKey)
    );

    if (!isNativeAndroid()) {
      try {
        const staleKeys = (await idbKeys()).filter(
          (key) => !referenced.has(key)
        );
        await Promise.allSettled(
          staleKeys.map((key) => deleteBinary(key))
        );
      } catch {
        // Browser storage can be unavailable in restricted development contexts.
      }
      return;
    }

    const candidates: string[] = [];
    const legacyFiles = await listNativeDirectory(ATTACHMENT_DIR);
    for (const file of legacyFiles) {
      if (file.type === 'file') candidates.push(ATTACHMENT_DIR + '/' + file.name);
    }
    const secureFiles = await listNativeDirectory(SECURE_ATTACHMENT_DIR);
    for (const file of secureFiles) {
      if (file.type === 'file') {
        candidates.push(SECURE_ATTACHMENT_DIR + '/' + file.name);
      }
    }

    await Promise.allSettled(
      candidates
        .filter((storageKey) => !referenced.has(storageKey))
        .map((storageKey) => deleteBinary(storageKey))
    );
  }
}
