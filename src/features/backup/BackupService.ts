import { ImportSummary, SpendWiseBackup } from '../../types';
import { BackupV2Preview, BackupV2RestoreSummary } from '../../utils/backupV2';
import { StorageManager } from '../../utils/storage';

export interface BackupServiceContract {
  validateLegacy(input: unknown): SpendWiseBackup;
  createLegacy(): SpendWiseBackup;
  createV2(includeMedia: boolean): Promise<Blob>;
  previewV2(file: Blob): Promise<BackupV2Preview>;
  restoreLegacy(input: SpendWiseBackup, replaceExisting: boolean): Promise<ImportSummary>;
  restoreV2(file: Blob, replaceExisting: boolean): Promise<BackupV2RestoreSummary>;
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
  previewV2(file: Blob): Promise<BackupV2Preview> {
    return StorageManager.previewBackupV2(file);
  }
  restoreLegacy(input: SpendWiseBackup, replaceExisting: boolean): Promise<ImportSummary> {
    return StorageManager.restoreBackup(input, replaceExisting);
  }
  restoreV2(file: Blob, replaceExisting: boolean): Promise<BackupV2RestoreSummary> {
    return StorageManager.restoreBackupV2(file, replaceExisting);
  }
  createCsv(): string {
    return StorageManager.createCsvExport();
  }
}

export const backupService: BackupServiceContract = new BackupService();
