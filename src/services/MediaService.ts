import { ExpenseAttachment, MediaStorageSummary } from '../types';
import { diagnostics, measureDiagnostic } from './diagnostics/diagnostics';
import {
  AttachmentDraft,
  AttachmentEditPayload,
  AttachmentStorage,
} from '../utils/attachmentStorage';

export interface PreparedAttachmentChanges {
  nextAttachments: ExpenseAttachment[];
  stagedAttachments: ExpenseAttachment[];
  removedAttachments: ExpenseAttachment[];
}

export interface MediaService {
  prepareImageDraft(file: File, kind: ExpenseAttachment['kind']): Promise<AttachmentDraft>;
  prepareExpenseAttachmentChanges(
    expenseId: number,
    newAttachments: AttachmentEditPayload['newAttachments'],
    removedAttachmentIds: string[]
  ): Promise<PreparedAttachmentChanges>;
  deleteDetachedFiles(items: ExpenseAttachment[]): Promise<void>;
  getStorageSummary(): Promise<MediaStorageSummary>;
}

export class ExistingAttachmentMediaService implements MediaService {
  prepareImageDraft(file: File, kind: ExpenseAttachment['kind']): Promise<AttachmentDraft> {
    return AttachmentStorage.prepareImageDraft(file, kind);
  }

  prepareExpenseAttachmentChanges(
    expenseId: number,
    newAttachments: AttachmentEditPayload['newAttachments'],
    removedAttachmentIds: string[]
  ): Promise<PreparedAttachmentChanges> {
    return AttachmentStorage.prepareExpenseAttachmentChanges(
      expenseId,
      newAttachments,
      removedAttachmentIds
    );
  }

  deleteDetachedFiles(items: ExpenseAttachment[]): Promise<void> {
    return AttachmentStorage.deleteDetachedFiles(items);
  }

  async getStorageSummary(): Promise<MediaStorageSummary> {
    const report = await measureDiagnostic('media.integrity', () => AttachmentStorage.auditIntegrity());
    diagnostics.setState({ photoCount: report.totalMetadataRecords, integrityIssueCount: report.issues.length });
    if (!report.healthy) diagnostics.record({ operation: 'media.integrity', outcome: 'failure', code: 'MEDIA_INTEGRITY_FAILED' });
    return {
      photoCount: report.totalMetadataRecords,
      totalBytes: report.totalBinaryBytes,
      purchaseCount: report.kindCounts.purchase,
      receiptCount: report.kindCounts.receipt,
      proofCount: report.kindCounts.proof,
      integrityIssueCount: report.issues.length,
    };
  }
}

export const mediaService: MediaService = new ExistingAttachmentMediaService();
