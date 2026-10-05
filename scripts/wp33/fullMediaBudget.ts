import type { runFullMediaBenchmark } from './fullMedia';
import { summarizeSamples } from './measure';
type Report = Awaited<ReturnType<typeof runFullMediaBenchmark>>;
const names = ['backup.full.create', 'backup.full.decrypt', 'backup.full.validate', 'backup.full.restore'];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function validate(report: Report) {
  if (report.format !== 'spendwise-full-media-benchmark-v1' || !/^[a-f0-9]{40}$/.test(report.revision) || report.fixture.expenses !== 100 || report.fixture.attachments !== 32 || !Number.isSafeInteger(report.fixture.mediaBytes) || report.fixture.mediaBytes <= 0 || report.correctness.byteEquivalent !== true || report.correctness.restoredAttachments !== 32 || report.operations.length !== names.length) throw new Error('INVALID_FULL_MEDIA_REPORT');
  for (const name of names) {
    const operation = report.operations.find((item) => item.operation === name);
    if (!operation || operation.samplesMs.length < 3 || operation.samplesMs.length > 20 || operation.validatedSamples !== operation.samplesMs.length) throw new Error('INVALID_FULL_MEDIA_REPORT');
    const summary = summarizeSamples(operation.samplesMs);
    for (const key of ['medianMs', 'minMs', 'maxMs', 'madMs'] as const) if (!Number.isFinite(operation[key]) || Math.abs(summary[key] - operation[key]) > 1e-6) throw new Error('INVALID_FULL_MEDIA_REPORT');
  }
}
export function createFullMediaBaseline(reports: Report[]) {
  if (reports.length < 2 || reports.length > 10) throw new Error('REPEATED_FULL_MEDIA_RUNS_REQUIRED');
  reports.forEach(validate);
  if (reports.some((report) => !same(report.environment, reports[0].environment) || !same(report.fixture, reports[0].fixture))) throw new Error('INCOMPARABLE_FULL_MEDIA_BASELINE');
  return { format: 'spendwise-full-media-baseline-v1', environment: reports[0].environment, fixture: reports[0].fixture,
    measuredRuns: reports.map(({ revision, generatedAt }) => ({ revision, generatedAt })),
    operations: names.map((operation) => {
      const samplesMs = reports.flatMap((report) => report.operations.find((item) => item.operation === operation)!.samplesMs);
      const summary = summarizeSamples(samplesMs);
      return { operation, samplesMs, ...summary, warningMs: 2 * Math.max(summary.maxMs, summary.medianMs + 6 * summary.madMs), hardMs: null };
    }) };
}
export function compareFullMedia(report: Report, baseline: ReturnType<typeof createFullMediaBaseline>) {
  const result = { comparable: false, warnings: [] as string[], failures: [] as string[] };
  try {
    validate(report);
    if (baseline.format !== 'spendwise-full-media-baseline-v1' || baseline.measuredRuns.length < 2 || !same(baseline.fixture, report.fixture) || baseline.operations.length !== names.length) throw new Error('INVALID_FULL_MEDIA_BASELINE');
    for (const name of names) {
      const item = baseline.operations.find((operation) => operation.operation === name);
      if (!item || item.samplesMs.length < 6 || item.hardMs !== null) throw new Error('INVALID_FULL_MEDIA_BASELINE');
      const summary = summarizeSamples(item.samplesMs);
      if (!Number.isFinite(item.warningMs) || Math.abs(item.warningMs - 2 * Math.max(summary.maxMs, summary.medianMs + 6 * summary.madMs)) > 1e-6) throw new Error('INVALID_FULL_MEDIA_BASELINE');
    }
  } catch { result.failures.push('Full-media measurement or baseline is invalid.'); return result; }
  result.comparable = same(report.environment, baseline.environment);
  if (!result.comparable) { result.warnings.push('Full-media environment differs; timings are incomparable, byte correctness remains required.'); return result; }
  for (const item of report.operations) if (item.medianMs > baseline.operations.find((reference) => reference.operation === item.operation)!.warningMs) result.warnings.push(`${item.operation}: measured warning threshold exceeded.`);
  return result;
}
