import { ExpenseAttachment } from '../types';
import { LocalDataStore } from '../utils/localDataStore';

export interface AttachmentMetadataRepository {
  listAll(): ExpenseAttachment[];
  listForExpense(expenseId: number): ExpenseAttachment[];
  hasForExpense(expenseId: number): boolean;
}

export class LocalAttachmentMetadataRepository implements AttachmentMetadataRepository {
  listAll(): ExpenseAttachment[] {
    return LocalDataStore.getAttachments();
  }
  listForExpense(expenseId: number): ExpenseAttachment[] {
    return LocalDataStore.getAttachments().filter((item) => item.expenseId === expenseId);
  }
  hasForExpense(expenseId: number): boolean {
    return LocalDataStore.getAttachments().some((item) => item.expenseId === expenseId);
  }
}

export const attachmentMetadataRepository: AttachmentMetadataRepository =
  new LocalAttachmentMetadataRepository();
