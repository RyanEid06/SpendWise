import type { Expense, ExpenseAttachment } from '../types';

export type MediaIntegrityIssueType =
  | 'missing-file'
  | 'orphan-file'
  | 'missing-expense'
  | 'duplicate-id'
  | 'duplicate-storage-key'
  | 'invalid-metadata'
  | 'size-mismatch'
  | 'unreadable-file';

export interface MediaBinaryInventoryItem {
  storageKey: string;
  byteSize: number;
  valid?: boolean;
}

export interface MediaIntegrityIssue {
  type: MediaIntegrityIssueType;
  attachmentId?: string;
  storageKey: string;
  detail?: string;
}

export interface MediaIntegrityReport {
  checkedAt: number;
  totalMetadataRecords: number;
  totalBinaryFiles: number;
  totalMetadataBytes: number;
  totalBinaryBytes: number;
  kindCounts: {
    purchase: number;
    receipt: number;
    proof: number;
  };
  issues: MediaIntegrityIssue[];
  missingFileCount: number;
  orphanFileCount: number;
  missingExpenseCount: number;
  duplicateIdCount: number;
  duplicateStorageKeyCount: number;
  invalidMetadataCount: number;
  sizeMismatchCount: number;
  unreadableFileCount: number;
  healthy: boolean;
}

export interface SafeMediaRepairPlan {
  removeAttachmentIds: string[];
  deleteStorageKeys: string[];
}

function metadataLooksValid(item: ExpenseAttachment): boolean {
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    Number.isInteger(item.expenseId) &&
    item.expenseId > 0 &&
    typeof item.storageKey === 'string' &&
    item.storageKey.startsWith('expense-attachments/') &&
    item.mimeType === 'image/jpeg' &&
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

export function analyzeMediaIntegrity(
  expenses: Expense[],
  attachments: ExpenseAttachment[],
  binaries: MediaBinaryInventoryItem[],
  checkedAt = Date.now()
): MediaIntegrityReport {
  const expenseIds = new Set(expenses.map((item) => item.id));
  const binaryMap = new Map(binaries.map((item) => [item.storageKey, item.byteSize]));
  const referencedKeys = new Set<string>();
  const idCounts = new Map<string, number>();
  const keyCounts = new Map<string, number>();
  const issues: MediaIntegrityIssue[] = [];
  const kindCounts = { purchase: 0, receipt: 0, proof: 0 };

  for (const attachment of attachments) {
    idCounts.set(attachment.id, (idCounts.get(attachment.id) || 0) + 1);
    keyCounts.set(attachment.storageKey, (keyCounts.get(attachment.storageKey) || 0) + 1);
    referencedKeys.add(attachment.storageKey);
    if (attachment.kind in kindCounts) kindCounts[attachment.kind]++;
  }

  for (const attachment of attachments) {
    if (!metadataLooksValid(attachment)) {
      issues.push({
        type: 'invalid-metadata',
        attachmentId: attachment.id,
        storageKey: attachment.storageKey || '',
      });
    }
    if ((idCounts.get(attachment.id) || 0) > 1) {
      issues.push({ type: 'duplicate-id', attachmentId: attachment.id, storageKey: attachment.storageKey });
    }
    if ((keyCounts.get(attachment.storageKey) || 0) > 1) {
      issues.push({
        type: 'duplicate-storage-key',
        attachmentId: attachment.id,
        storageKey: attachment.storageKey,
      });
    }
    if (!expenseIds.has(attachment.expenseId)) {
      issues.push({
        type: 'missing-expense',
        attachmentId: attachment.id,
        storageKey: attachment.storageKey,
      });
    }
    const binary = binaries.find((item) => item.storageKey === attachment.storageKey);
    if (!binary) {
      issues.push({ type: 'missing-file', attachmentId: attachment.id, storageKey: attachment.storageKey });
    } else if (binary.valid === false) {
      issues.push({
        type: 'unreadable-file',
        attachmentId: attachment.id,
        storageKey: attachment.storageKey,
      });
    } else if (binary.byteSize !== attachment.byteSize) {
      issues.push({
        type: 'size-mismatch',
        attachmentId: attachment.id,
        storageKey: attachment.storageKey,
        detail: `${attachment.byteSize}:${binary.byteSize}`,
      });
    }
  }

  for (const binary of binaries) {
    if (!referencedKeys.has(binary.storageKey)) {
      issues.push({ type: 'orphan-file', storageKey: binary.storageKey });
    }
  }

  const count = (type: MediaIntegrityIssueType) => issues.filter((issue) => issue.type === type).length;
  return {
    checkedAt,
    totalMetadataRecords: attachments.length,
    totalBinaryFiles: binaries.length,
    totalMetadataBytes: attachments.reduce((sum, item) => sum + Math.max(0, item.byteSize || 0), 0),
    totalBinaryBytes: binaries.reduce((sum, item) => sum + Math.max(0, item.byteSize || 0), 0),
    kindCounts,
    issues,
    missingFileCount: count('missing-file'),
    orphanFileCount: count('orphan-file'),
    missingExpenseCount: count('missing-expense'),
    duplicateIdCount: count('duplicate-id'),
    duplicateStorageKeyCount: count('duplicate-storage-key'),
    invalidMetadataCount: count('invalid-metadata'),
    sizeMismatchCount: count('size-mismatch'),
    unreadableFileCount: count('unreadable-file'),
    healthy: issues.length === 0,
  };
}

export function planSafeMediaRepair(report: MediaIntegrityReport): SafeMediaRepairPlan {
  const ambiguousIds = new Set(
    report.issues
      .filter((issue) =>
        ['duplicate-id', 'duplicate-storage-key', 'invalid-metadata', 'missing-expense'].includes(issue.type)
      )
      .map((issue) => issue.attachmentId)
      .filter((value): value is string => !!value)
  );

  const removeAttachmentIds = Array.from(
    new Set(
      report.issues
        .filter((issue) => issue.type === 'missing-file' && issue.attachmentId && !ambiguousIds.has(issue.attachmentId))
        .map((issue) => issue.attachmentId as string)
    )
  );

  const deleteStorageKeys = Array.from(
    new Set(report.issues.filter((issue) => issue.type === 'orphan-file').map((issue) => issue.storageKey))
  );

  return { removeAttachmentIds, deleteStorageKeys };
}
