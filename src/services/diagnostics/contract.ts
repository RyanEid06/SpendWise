export const MAX_DIAGNOSTIC_RECORDS = 128;
export const MAX_DIAGNOSTIC_BYTES = 64 * 1024;
export const DIAGNOSTIC_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const DIAGNOSTIC_OPERATIONS = ['storage.init', 'storage.open', 'storage.read', 'storage.schema', 'storage.migration', 'media.init', 'media.integrity', 'backup.create', 'backup.preview', 'backup.restore', 'security.init', 'api.request', 'ai.fallback', 'delete.commit', 'other'] as const;
export type DiagnosticOperation = typeof DIAGNOSTIC_OPERATIONS[number];
export const DIAGNOSTIC_CODES = ['STORAGE_INIT_FAILED', 'STORAGE_OPEN_FAILED', 'STORAGE_READ_FAILED', 'STORAGE_SCHEMA_FAILED', 'STORAGE_MIGRATION_FAILED', 'MEDIA_INIT_FAILED', 'MEDIA_INTEGRITY_FAILED', 'BACKUP_CREATE_FAILED', 'BACKUP_PREVIEW_FAILED', 'BACKUP_RESTORE_FAILED', 'SECURITY_INIT_FAILED', 'API_REQUEST_FAILED', 'AI_LOCAL_FALLBACK', 'DELETE_COMMIT_FAILED', 'UNKNOWN_TECHNICAL_ERROR', 'network', 'timeout', 'temporary_unavailable', 'rate_limited', 'not_configured', 'invalid_response', 'unauthorized', 'generic'] as const;
export type DiagnosticCode = typeof DIAGNOSTIC_CODES[number];
export interface DiagnosticRecord {
  operation: DiagnosticOperation;
  code: DiagnosticCode;
  outcome: 'failure' | 'fallback';
  timestamp: number;
  durationMs?: number;
  httpClass?: '2xx' | '3xx' | '4xx' | '5xx';
  retry?: boolean;
}
export interface DiagnosticState {
  platform: 'android' | 'web' | 'unknown';
  migration?: 'copying' | 'copied' | 'verified' | 'active' | 'complete' | 'unknown';
  databaseOpen?: boolean;
  databaseEncrypted?: boolean;
  mediaEncrypted?: boolean;
  cryptoAvailable?: boolean;
  photoCount?: number;
  integrityIssueCount?: number;
}
export interface DiagnosticTiming { count: number; meanMs: number; maxMs: number; }
export interface DiagnosticReport {
  format: 'spendwise-technical-diagnostics-v1';
  generatedAt: number;
  app: { version: string; build: number };
  schemaVersion: number;
  backupVersion: 3;
  state: DiagnosticState;
  recentErrors: DiagnosticRecord[];
  timings: Partial<Record<DiagnosticOperation, DiagnosticTiming>>;
}

export function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function finiteBound(value: unknown, maximum: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum ? value : undefined;
}
export function normalizeOperation(value: unknown): DiagnosticOperation {
  return (DIAGNOSTIC_OPERATIONS as readonly unknown[]).includes(value) ? value as DiagnosticOperation : 'other';
}
export function normalizeCode(value: unknown): DiagnosticCode {
  return (DIAGNOSTIC_CODES as readonly unknown[]).includes(value) ? value as DiagnosticCode : 'UNKNOWN_TECHNICAL_ERROR';
}
export function sanitizeDiagnosticRecord(input: unknown, timestamp: number): DiagnosticRecord {
  const value = recordObject(input);
  const out: DiagnosticRecord = { operation: normalizeOperation(value.operation), code: normalizeCode(value.code), outcome: value.outcome === 'fallback' ? 'fallback' : 'failure', timestamp };
  const duration = finiteBound(value.durationMs, 600_000);
  if (duration !== undefined) out.durationMs = Math.round(duration * 100) / 100;
  if (['2xx', '3xx', '4xx', '5xx'].includes(value.httpClass as string)) out.httpClass = value.httpClass as DiagnosticRecord['httpClass'];
  if (typeof value.retry === 'boolean') out.retry = value.retry;
  return out;
}
export function sanitizeDiagnosticState(input: unknown): DiagnosticState {
  const value = recordObject(input);
  const out: DiagnosticState = { platform: value.platform === 'android' || value.platform === 'web' ? value.platform : 'unknown' };
  if (['copying', 'copied', 'verified', 'active', 'complete', 'unknown'].includes(value.migration as string)) out.migration = value.migration as DiagnosticState['migration'];
  for (const key of ['databaseOpen', 'databaseEncrypted', 'mediaEncrypted', 'cryptoAvailable'] as const) if (typeof value[key] === 'boolean') out[key] = value[key];
  for (const key of ['photoCount', 'integrityIssueCount'] as const) {
    const count = finiteBound(value[key], 1_000_000);
    if (count !== undefined && Number.isInteger(count)) out[key] = count;
  }
  return out;
}
