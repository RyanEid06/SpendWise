import type { AttachmentDraft } from '../utils/attachmentStorage';
import type { Language, ReceiptScanResult, SmartCaptureResult } from '../types';

export interface DraftToolState<T> {
  photo: AttachmentDraft | null;
  result: T | null;
  interrupted: boolean;
  language: Language;
  currencyCode: string;
}

export interface ExpenseEditorDraft {
  version: 1;
  id: string;
  expenseId: number | null;
  expenseCreatedAt: number | null;
  currencyCode: string;
  amountText: string;
  descriptionText: string;
  category: string;
  date: number;
  noteText: string;
  activeTool: 'smart' | 'receipt' | 'photos' | null;
  attachments: AttachmentDraft[];
  removedAttachmentIds: string[];
  smart: DraftToolState<SmartCaptureResult> | null;
  receipt: DraftToolState<ReceiptScanResult> | null;
}

export interface StoredDraftPhoto extends Omit<AttachmentDraft, 'blob'> {
  id: string;
}
type StoredTool<T> = Omit<DraftToolState<T>, 'photo'> & { photoId: string | null };
export interface StoredExpenseDraft extends Omit<ExpenseEditorDraft, 'attachments' | 'smart' | 'receipt'> {
  attachmentIds: string[];
  photos: StoredDraftPhoto[];
  smart: StoredTool<SmartCaptureResult> | null;
  receipt: StoredTool<ReceiptScanResult> | null;
}
export interface DraftWrite {
  draft: StoredExpenseDraft;
  media: Record<string, string>;
}

export const WEB_EXPENSE_DRAFT_KEY = 'spendwise_encrypted_expense_draft_v1';
export const NATIVE_EXPENSE_DRAFT_KEY = 'unfinished_expense_v1';

export function validateStoredDraft(value: unknown): StoredExpenseDraft {
  const d = value as StoredExpenseDraft;
  if (!d || d.version !== 1 || typeof d.id !== 'string' || !d.id ||
      ![null, 'smart', 'receipt', 'photos'].includes(d.activeTool) ||
      !['amountText', 'descriptionText', 'category', 'noteText', 'currencyCode'].every(k =>
        typeof (d as unknown as Record<string, unknown>)[k] === 'string') ||
      !Number.isFinite(d.date) || d.date <= 0 ||
      (d.expenseId !== null && (!Number.isSafeInteger(d.expenseId) || d.expenseId <= 0 || !Number.isFinite(d.expenseCreatedAt))) ||
      !Array.isArray(d.photos) || d.photos.length > 10 ||
      !Array.isArray(d.attachmentIds) || d.attachmentIds.length > 8 ||
      new Set(d.attachmentIds).size !== d.attachmentIds.length ||
      !Array.isArray(d.removedAttachmentIds) || !d.removedAttachmentIds.every(id => typeof id === 'string')) {
    throw new Error('EXPENSE_DRAFT_INVALID');
  }
  const ids = new Set<string>();
  for (const p of d.photos) {
    if (!p || typeof p.id !== 'string' || ids.has(p.id) || p.mimeType !== 'image/jpeg' ||
        !['purchase', 'receipt', 'proof'].includes(p.kind) ||
        !Number.isInteger(p.byteSize) || p.byteSize <= 0 || p.byteSize > 5 * 1024 * 1024 ||
        !Number.isInteger(p.width) || p.width <= 0 || !Number.isInteger(p.height) || p.height <= 0) {
      throw new Error('EXPENSE_DRAFT_MEDIA_INVALID');
    }
    ids.add(p.id);
  }
  for (const id of [...d.attachmentIds, d.smart?.photoId, d.receipt?.photoId].filter(Boolean)) {
    if (!ids.has(id!)) throw new Error('EXPENSE_DRAFT_MEDIA_MISSING');
  }
  return d;
}
