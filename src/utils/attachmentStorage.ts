import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { ExpenseAttachment, ExpenseAttachmentKind } from '../types';

const ATTACHMENT_METADATA_KEY = 'spendwise_expense_attachments_v1';
const ATTACHMENT_DIR = 'expense-attachments';
const MEDIA_DB_NAME = 'spendwise_media_v1';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE_NAME = 'attachments';

export const MAX_ATTACHMENTS_PER_EXPENSE = 8;
export const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_STORED_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 2048;

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

let maintenanceScheduled = false;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function generateAttachmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
}

function getStorageKey(id: string): string {
  return ATTACHMENT_DIR + '/' + id + '.jpg';
}

function isAttachment(value: unknown): value is ExpenseAttachment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as ExpenseAttachment;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    Number.isInteger(item.expenseId) &&
    item.expenseId > 0 &&
    typeof item.storageKey === 'string' &&
    item.storageKey.length > 0 &&
    typeof item.mimeType === 'string' &&
    item.mimeType.startsWith('image/') &&
    Number.isFinite(item.createdAt) &&
    item.createdAt > 0 &&
    ['purchase', 'receipt', 'proof'].includes(item.kind) &&
    Number.isFinite(item.byteSize) &&
    item.byteSize > 0 &&
    Number.isFinite(item.width) &&
    item.width > 0 &&
    Number.isFinite(item.height) &&
    item.height > 0
  );
}

function readMetadata(): ExpenseAttachment[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ATTACHMENT_METADATA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAttachment);
  } catch {
    return [];
  }
}

function writeMetadata(items: ExpenseAttachment[]): void {
  if (typeof localStorage === 'undefined') {
    if (items.length > 0) throw new Error('ATTACHMENT_STORAGE_UNAVAILABLE');
    return;
  }
  if (items.length === 0) {
    localStorage.removeItem(ATTACHMENT_METADATA_KEY);
  } else {
    localStorage.setItem(ATTACHMENT_METADATA_KEY, JSON.stringify(items));
  }
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
        if (request.result instanceof Blob) {
          resolve(request.result);
        } else {
          reject(new Error('ATTACHMENT_MISSING'));
        }
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error || new Error('ATTACHMENT_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}

async function saveBinary(storageKey: string, blob: Blob): Promise<void> {
  if (isNative()) {
    await Filesystem.writeFile({
      path: storageKey,
      data: await blobToBase64(blob),
      directory: Directory.Data,
      recursive: true,
    });
    return;
  }
  await idbPut(storageKey, blob);
}

async function deleteBinary(storageKey: string): Promise<void> {
  if (isNative()) {
    try {
      await Filesystem.deleteFile({
        path: storageKey,
        directory: Directory.Data,
      });
    } catch {
      // Missing files are already effectively deleted.
    }
    return;
  }

  try {
    await idbDelete(storageKey);
  } catch {
    // Browser storage may already have been cleared outside SpendWise.
  }
}

async function readBinaryUrl(item: ExpenseAttachment): Promise<string> {
  if (isNative()) {
    const result = await Filesystem.readFile({
      path: item.storageKey,
      directory: Directory.Data,
    });
    if (result.data instanceof Blob) {
      return URL.createObjectURL(result.data);
    }
    return 'data:' + item.mimeType + ';base64,' + result.data;
  }

  const blob = await idbGet(item.storageKey);
  return URL.createObjectURL(blob);
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
      (blob) => {
        if (!blob || blob.size <= 0) {
          reject(new Error('ATTACHMENT_PROCESSING_FAILED'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

async function renderImage(image: HTMLImageElement, maxDimension: number, quality: number) {
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
  const blob = await canvasToJpeg(canvas, quality);
  return { blob, width, height };
}

export class AttachmentStorage {
  static getAllAttachments(): ExpenseAttachment[] {
    return readMetadata();
  }

  static getAttachmentsForExpense(expenseId: number): ExpenseAttachment[] {
    return readMetadata()
      .filter((item) => item.expenseId === expenseId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  static hasAttachments(expenseId: number): boolean {
    return readMetadata().some((item) => item.expenseId === expenseId);
  }

  static async prepareImageDraft(
    file: File,
    kind: ExpenseAttachmentKind
  ): Promise<AttachmentDraft> {
    if (!file.type.startsWith('image/')) {
      throw new Error('ATTACHMENT_UNSUPPORTED');
    }
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

  static async readAttachmentUrl(item: ExpenseAttachment): Promise<string> {
    return readBinaryUrl(item);
  }

  static revokePreviewUrl(url: string | null | undefined): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  static async applyExpenseAttachmentChanges(
    expenseId: number,
    drafts: AttachmentDraft[],
    removedAttachmentIds: string[]
  ): Promise<ExpenseAttachment[]> {
    const current = readMetadata();
    const currentForExpense = current.filter((item) => item.expenseId === expenseId);
    const removable = new Set(
      currentForExpense
        .filter((item) => removedAttachmentIds.includes(item.id))
        .map((item) => item.id)
    );
    const survivors = currentForExpense.filter((item) => !removable.has(item.id));

    if (survivors.length + drafts.length > MAX_ATTACHMENTS_PER_EXPENSE) {
      throw new Error('ATTACHMENT_LIMIT');
    }

    const staged: ExpenseAttachment[] = [];
    try {
      for (let index = 0; index < drafts.length; index++) {
        const draft = drafts[index];
        const id = generateAttachmentId();
        const storageKey = getStorageKey(id);
        await saveBinary(storageKey, draft.blob);
        staged.push({
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

      const next = current
        .filter((item) => !removable.has(item.id))
        .concat(staged);
      writeMetadata(next);
    } catch (error) {
      await Promise.allSettled(staged.map((item) => deleteBinary(item.storageKey)));
      throw error;
    }

    const removed = currentForExpense.filter((item) => removable.has(item.id));
    await Promise.allSettled(removed.map((item) => deleteBinary(item.storageKey)));
    return this.getAttachmentsForExpense(expenseId);
  }

  static detachReferencesForExpense(expenseId: number): ExpenseAttachment[] {
    const current = readMetadata();
    const detached = current.filter((item) => item.expenseId === expenseId);
    if (detached.length === 0) return [];
    writeMetadata(current.filter((item) => item.expenseId !== expenseId));
    return detached;
  }

  static detachAllReferences(): ExpenseAttachment[] {
    const current = readMetadata();
    if (current.length === 0) return [];
    writeMetadata([]);
    return current;
  }

  static restoreReferences(items: ExpenseAttachment[]): void {
    if (items.length === 0) return;
    const current = readMetadata();
    const byId = new Map(current.map((item) => [item.id, item]));
    items.forEach((item) => byId.set(item.id, item));
    writeMetadata(Array.from(byId.values()));
  }

  static async deleteDetachedFiles(items: ExpenseAttachment[]): Promise<void> {
    await Promise.allSettled(items.map((item) => deleteBinary(item.storageKey)));
  }

  static scheduleMaintenance(): void {
    if (maintenanceScheduled || typeof window === 'undefined') return;
    maintenanceScheduled = true;
    window.setTimeout(() => {
      void this.repairOrphans();
    }, 0);
  }

  static async repairOrphans(): Promise<void> {
    const referenced = new Set(readMetadata().map((item) => item.storageKey));

    if (isNative()) {
      try {
        const listing = await Filesystem.readdir({
          path: ATTACHMENT_DIR,
          directory: Directory.Data,
        });
        const stalePaths = listing.files
          .map((file) => ATTACHMENT_DIR + '/' + file.name)
          .filter((path) => !referenced.has(path));
        await Promise.allSettled(stalePaths.map((path) => deleteBinary(path)));
      } catch {
        // The attachment directory may not exist yet.
      }
      return;
    }

    try {
      const keys = await idbKeys();
      const staleKeys = keys.filter((key) => !referenced.has(key));
      await Promise.allSettled(staleKeys.map((key) => deleteBinary(key)));
    } catch {
      // Browser storage can be unavailable in restricted development contexts.
    }
  }
}
