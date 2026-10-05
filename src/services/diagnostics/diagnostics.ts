import { DiagnosticStore } from './DiagnosticStore';
import type { DiagnosticCode, DiagnosticOperation } from './contract';

function safeStorage(): Storage | null { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } }
export const diagnostics = new DiagnosticStore(safeStorage());
const failures: Record<DiagnosticOperation, DiagnosticCode> = {
  'storage.init': 'STORAGE_INIT_FAILED', 'storage.open': 'STORAGE_OPEN_FAILED', 'storage.read': 'STORAGE_READ_FAILED', 'storage.schema': 'STORAGE_SCHEMA_FAILED', 'storage.migration': 'STORAGE_MIGRATION_FAILED', 'media.init': 'MEDIA_INIT_FAILED', 'media.integrity': 'MEDIA_INTEGRITY_FAILED', 'backup.create': 'BACKUP_CREATE_FAILED', 'backup.preview': 'BACKUP_PREVIEW_FAILED', 'backup.restore': 'BACKUP_RESTORE_FAILED', 'security.init': 'SECURITY_INIT_FAILED', 'api.request': 'API_REQUEST_FAILED', 'ai.fallback': 'AI_LOCAL_FALLBACK', 'delete.commit': 'DELETE_COMMIT_FAILED', other: 'UNKNOWN_TECHNICAL_ERROR',
};
export async function measureDiagnostic<T>(operation: DiagnosticOperation, work: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await work();
    diagnostics.record({ operation, outcome: 'success', durationMs: performance.now() - start });
    return result;
  } catch (error) {
    diagnostics.record({ operation, outcome: 'failure', code: failures[operation], durationMs: performance.now() - start });
    throw error;
  }
}
