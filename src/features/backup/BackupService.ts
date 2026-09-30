import { ImportSummary, SpendWiseBackup } from '../../types';
import { BackupV2Preview, BackupV2RestoreSummary } from '../../utils/backupV2';
import { BackupV3Preview, BackupV3RestoreSummary } from '../../utils/backupV3';
import { StorageManager } from '../../utils/storage';

export interface BackupServiceContract {
  validateLegacy(input: unknown): SpendWiseBackup;
  createLegacy(): SpendWiseBackup;
  createV2(includeMedia: boolean): Promise<Blob>;
  createV3(includeMedia: boolean, passphrase: string): Promise<Blob>;
  isV3(file: Blob): Promise<boolean>;
  previewV2(file: Blob): Promise<BackupV2Preview>;
  previewV3(file: Blob, passphrase: string): Promise<BackupV3Preview>;
  restoreLegacy(input: SpendWiseBackup, replaceExisting: boolean): Promise<ImportSummary>;
  restoreV2(file: Blob, replaceExisting: boolean): Promise<BackupV2RestoreSummary>;
  restoreV3(file: Blob, passphrase: string, replaceExisting: boolean): Promise<BackupV3RestoreSummary>;
  createCsv(): string;
}

export class BackupService implements BackupServiceContract {
  validateLegacy(input: unknown): SpendWiseBackup {
    return StorageManager.validateBackup(input);
  }
  createLegacy(): SpendWiseBackup {
    return StorageManager.createBackupJson();
  }
  createV2(includeMedia: boolean): Promise<Blob> {
    return StorageManager.createBackupV2(includeMedia);
  }
  createV3(includeMedia: boolean, passphrase: string): Promise<Blob> {
    return StorageManager.createBackupV3(includeMedia, passphrase);
  }
  isV3(file: Blob): Promise<boolean> {
    return StorageManager.isBackupV3(file);
  }
  previewV2(file: Blob): Promise<BackupV2Preview> {
    return StorageManager.previewBackupV2(file);
  }
  previewV3(file: Blob, passphrase: string): Promise<BackupV3Preview> {
    return StorageManager.previewBackupV3(file, passphrase);
  }
  restoreLegacy(input: SpendWiseBackup, replaceExisting: boolean): Promise<ImportSummary> {
    return StorageManager.restoreBackup(input, replaceExisting);
  }
  restoreV2(file: Blob, replaceExisting: boolean): Promise<BackupV2RestoreSummary> {
    return StorageManager.restoreBackupV2(file, replaceExisting);
  }
  restoreV3(file: Blob, passphrase: string, replaceExisting: boolean): Promise<BackupV3RestoreSummary> {
    return StorageManager.restoreBackupV3(file, passphrase, replaceExisting);
  }
  createCsv(): string {
    return StorageManager.createCsvExport();
  }
}

export const backupService: BackupServiceContract = new BackupService();
