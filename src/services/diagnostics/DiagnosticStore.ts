import type { KeyValueStore } from '../../utils/financialState';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../../utils/appVersion';
import { SPENDWISE_DATABASE_SCHEMA_VERSION } from '../../data/databaseSchema';
import { DIAGNOSTIC_OPERATIONS, DIAGNOSTIC_RETENTION_MS, MAX_DIAGNOSTIC_BYTES, MAX_DIAGNOSTIC_RECORDS, finiteBound, normalizeOperation, recordObject, sanitizeDiagnosticRecord, sanitizeDiagnosticState, type DiagnosticOperation, type DiagnosticRecord, type DiagnosticReport, type DiagnosticState } from './contract';

export const DIAGNOSTIC_STORAGE_KEY = 'spendwise_technical_diagnostics_v1';
interface TimingAccumulator { count: number; totalMs: number; maxMs: number; }
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;

/** A technical-only boundary. Every entry point is best effort and never logs inputs. */
export class DiagnosticStore {
  private errors: DiagnosticRecord[] = [];
  private state: DiagnosticState = { platform: 'unknown' };
  private timings: Partial<Record<DiagnosticOperation, TimingAccumulator>> = {};
  constructor(private readonly storage: KeyValueStore | null, private readonly now: () => number = Date.now) {
    try {
      const raw = storage?.getItem(DIAGNOSTIC_STORAGE_KEY);
      if (!raw) return;
      if (bytes(raw) > MAX_DIAGNOSTIC_BYTES) { this.discard(); return; }
      const stored = recordObject(JSON.parse(raw));
      if (stored.version !== 1) { this.discard(); return; }
      this.state = sanitizeDiagnosticState(stored.state);
      const clock = this.clock();
      if (Array.isArray(stored.recentErrors)) this.errors = stored.recentErrors.slice(-MAX_DIAGNOSTIC_RECORDS).flatMap((item) => {
        const value = recordObject(item); const timestamp = finiteBound(value.timestamp, clock);
        return timestamp !== undefined && timestamp > clock - DIAGNOSTIC_RETENTION_MS ? [sanitizeDiagnosticRecord(item, timestamp)] : [];
      });
      const timings = recordObject(stored.timings);
      for (const operation of DIAGNOSTIC_OPERATIONS) {
        const value = recordObject(timings[operation]); const count = finiteBound(value.count, Number.MAX_SAFE_INTEGER); const totalMs = finiteBound(value.totalMs, Number.MAX_SAFE_INTEGER); const maxMs = finiteBound(value.maxMs, 600_000);
        if (count !== undefined && Number.isInteger(count) && count > 0 && totalMs !== undefined && maxMs !== undefined && totalMs <= count * 600_000) this.timings[operation] = { count, totalMs, maxMs };
      }
      this.persist();
    } catch { this.errors = []; this.state = { platform: 'unknown' }; this.timings = {}; this.discard(); }
  }
  private clock(): number {
    try { const value = finiteBound(this.now(), 8_640_000_000_000_000); if (value !== undefined) return value; } catch {}
    return Date.now();
  }
  private discard(): void { try { this.storage?.removeItem(DIAGNOSTIC_STORAGE_KEY); } catch {} }
  private prune(): void {
    const clock = this.clock();
    this.errors = this.errors.filter((record) => record.timestamp > clock - DIAGNOSTIC_RETENTION_MS && record.timestamp <= clock).slice(-MAX_DIAGNOSTIC_RECORDS);
  }
  private persist(): void {
    try {
      this.prune();
      let text = JSON.stringify({ version: 1, state: sanitizeDiagnosticState(this.state), recentErrors: this.errors.map((record) => sanitizeDiagnosticRecord(record, record.timestamp)), timings: this.timings });
      while (bytes(text) > MAX_DIAGNOSTIC_BYTES && this.errors.length) {
        this.errors.shift(); text = JSON.stringify({ version: 1, state: this.state, recentErrors: this.errors, timings: this.timings });
      }
      if (bytes(text) <= MAX_DIAGNOSTIC_BYTES) this.storage?.setItem(DIAGNOSTIC_STORAGE_KEY, text);
    } catch {}
  }
  record(input: unknown): void {
    try {
      const value = recordObject(input); const operation = normalizeOperation(value.operation); const duration = finiteBound(value.durationMs, 600_000);
      if (duration !== undefined) {
        const current = this.timings[operation] ?? { count: 0, totalMs: 0, maxMs: 0 };
        if (current.count < Number.MAX_SAFE_INTEGER && current.totalMs <= Number.MAX_SAFE_INTEGER - duration) this.timings[operation] = { count: current.count + 1, totalMs: current.totalMs + duration, maxMs: Math.max(current.maxMs, duration) };
      }
      if (value.outcome !== 'success') this.errors.push(sanitizeDiagnosticRecord(value, this.clock()));
      this.persist();
    } catch {}
  }
  setState(input: unknown): void {
    try {
      const sanitized = sanitizeDiagnosticState(input);
      if (!Object.prototype.hasOwnProperty.call(recordObject(input), 'platform')) sanitized.platform = this.state.platform;
      this.state = sanitizeDiagnosticState({ ...this.state, ...sanitized }); this.persist();
    } catch {}
  }
  report(): DiagnosticReport {
    this.prune();
    const timings: DiagnosticReport['timings'] = {};
    for (const operation of DIAGNOSTIC_OPERATIONS) {
      const value = this.timings[operation];
      if (value) timings[operation] = { count: value.count, meanMs: Math.round(value.totalMs / value.count * 100) / 100, maxMs: Math.round(value.maxMs * 100) / 100 };
    }
    return { format: 'spendwise-technical-diagnostics-v1', generatedAt: this.clock(), app: { version: APP_VERSION_NAME, build: APP_VERSION_CODE }, schemaVersion: SPENDWISE_DATABASE_SCHEMA_VERSION, backupVersion: 3, state: sanitizeDiagnosticState(this.state), recentErrors: this.errors.map((record) => sanitizeDiagnosticRecord(record, record.timestamp)), timings };
  }
  clear(): void { this.errors = []; this.timings = {}; this.discard(); }
}
