import { BENCHMARK_OPERATIONS, type BenchmarkEnvironment, type BenchmarkReport } from './benchmark';
import { BENCHMARK_SIZES, FIXTURE_SEED, FIXTURE_CLOCK } from './fixtures';
import { summarizeSamples } from './measure';

export interface OperationBudget {
  operation: string; medianMs: number; maxMs: number; madMs: number;
  warningMs: number; hardMs: number | null; reason: string;
}
export interface BenchmarkBaseline {
  format: 'spendwise-benchmark-baseline-v1'; environment: BenchmarkEnvironment;
  fixture: BenchmarkReport['fixture']; measuredRuns: { revision: string; generatedAt: string; samples: number }[];
  policy: { warningMultiplier: 2; severeMultiplier: 6; severeCondition: 'every-sample-exceeds-threshold' };
  datasets: { size: number; operations: OperationBudget[] }[];
}
export interface BudgetResult { comparable: boolean; failures: string[]; warnings: string[]; }
const environmentFields = ['runtime', 'nodeMajor', 'platform', 'arch', 'cpu', 'cpuCount', 'timezone', 'storageMode', 'cryptoMode'] as const;
const sameEnvironment = (a: BenchmarkEnvironment, b: BenchmarkEnvironment) => environmentFields.every((field) => a[field] === b[field]);
const hardOperations = new Set(['backup.restore.prepare', 'statistics.all', 'history.search']);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-9;

function assertCoverage(report: BenchmarkReport): void {
  if (report.format !== 'spendwise-benchmark-v1' || report.environment.runtime !== 'node' || report.environment.nodeMajor !== 22 || !/^[a-f0-9]{40}$/.test(report.revision)) throw new Error('INVALID_REPORT_METADATA');
  if (report.fixture.seed !== FIXTURE_SEED || report.fixture.version !== 1 || report.fixture.distribution !== 'ten-months' || report.fixture.clockTimestamp !== FIXTURE_CLOCK) throw new Error('INVALID_FIXTURE_IDENTITY');
  if (!Number.isInteger(report.samples) || report.samples < 3 || report.samples > 20) throw new Error('INSUFFICIENT_REPEATED_SAMPLES');
  if (report.datasets.length !== BENCHMARK_SIZES.length || new Set(report.datasets.map((item) => item.size)).size !== BENCHMARK_SIZES.length) throw new Error('INVALID_DATASET_COVERAGE');
  for (const size of BENCHMARK_SIZES) {
    const dataset = report.datasets.find((item) => item.size === size);
    if (!dataset || dataset.correctness.expenses !== size || dataset.correctness.idSum !== size * (size + 1) / 2 || !Number.isSafeInteger(dataset.correctness.totalCents) || dataset.correctness.totalCents < 0 || !Number.isFinite(dataset.archiveBytes) || dataset.archiveBytes <= 0) throw new Error('INVALID_CORRECTNESS_RECEIPT');
    if (dataset.operations.length !== BENCHMARK_OPERATIONS.length || new Set(dataset.operations.map((item) => item.operation)).size !== BENCHMARK_OPERATIONS.length) throw new Error('INVALID_OPERATION_COVERAGE');
    for (const name of BENCHMARK_OPERATIONS) {
      const item = dataset.operations.find((value) => value.operation === name);
      if (!item || item.samplesMs.length !== report.samples || item.validatedSamples !== report.samples) throw new Error('UNVALIDATED_OPERATION');
      const summary = summarizeSamples(item.samplesMs);
      for (const key of ['medianMs', 'minMs', 'maxMs', 'madMs'] as const) if (!Number.isFinite(item[key]) || !close(item[key], summary[key])) throw new Error('INVALID_TIMING_SUMMARY');
    }
  }
}

/** Collect baselines explicitly; comparison never rewrites them. */
export function createBenchmarkBaseline(reports: BenchmarkReport[]): BenchmarkBaseline {
  if (reports.length < 2 || reports.length > 10) throw new Error('BASELINE_REQUIRES_REPEATED_RUNS');
  reports.forEach(assertCoverage);
  if (reports.some((report) => !sameEnvironment(report.environment, reports[0].environment))) throw new Error('INCOMPARABLE_BASELINE_ENVIRONMENTS');
  return {
    format: 'spendwise-benchmark-baseline-v1', environment: { ...reports[0].environment }, fixture: { ...reports[0].fixture },
    measuredRuns: reports.map((report) => ({ revision: report.revision, generatedAt: report.generatedAt, samples: report.samples })),
    policy: { warningMultiplier: 2, severeMultiplier: 6, severeCondition: 'every-sample-exceeds-threshold' },
    datasets: BENCHMARK_SIZES.map((size) => ({ size, operations: BENCHMARK_OPERATIONS.map((operation) => {
      const samples = reports.flatMap((report) => report.datasets.find((item) => item.size === size)!.operations.find((item) => item.operation === operation)!.samplesMs);
      const summary = summarizeSamples(samples);
      const envelope = Math.max(summary.maxMs, summary.medianMs + 6 * summary.madMs);
      const hard = size >= 1000 && hardOperations.has(operation);
      return { operation, medianMs: summary.medianMs, maxMs: summary.maxMs, madMs: summary.madMs, warningMs: envelope * 2, hardMs: hard ? envelope * 6 : null,
        reason: hard ? 'Warning at twice the measured envelope; block only when every repeated sample exceeds six times that envelope on a matching environment.' : 'Timing-sensitive or small workload: warning only at twice the measured envelope; correctness and coverage still block.' };
    }) })),
  };
}

export function compareBenchmark(report: BenchmarkReport, baseline: BenchmarkBaseline | undefined): BudgetResult {
  const result: BudgetResult = { comparable: false, failures: [], warnings: [] };
  try { assertCoverage(report); } catch { result.failures.push('Benchmark report is incomplete, invalid or lacks repeated correctness-validated samples.'); return result; }
  if (!baseline) { result.failures.push('Measured benchmark baseline is missing.'); return result; }
  try {
    if (baseline.format !== 'spendwise-benchmark-baseline-v1' || baseline.measuredRuns.length < 2 || baseline.fixture.seed !== FIXTURE_SEED || baseline.fixture.version !== 1 || baseline.fixture.distribution !== 'ten-months' || baseline.fixture.clockTimestamp !== FIXTURE_CLOCK || baseline.policy.warningMultiplier !== 2 || baseline.policy.severeMultiplier !== 6 || baseline.policy.severeCondition !== 'every-sample-exceeds-threshold') throw new Error('INVALID_BASELINE');
    if (baseline.datasets.length !== BENCHMARK_SIZES.length || new Set(baseline.datasets.map((item) => item.size)).size !== BENCHMARK_SIZES.length) throw new Error('INVALID_BASELINE');
    for (const size of BENCHMARK_SIZES) {
      const dataset = baseline.datasets.find((item) => item.size === size);
      if (!dataset || dataset.operations.length !== BENCHMARK_OPERATIONS.length || new Set(dataset.operations.map((item) => item.operation)).size !== BENCHMARK_OPERATIONS.length) throw new Error('INVALID_BASELINE');
      for (const operation of BENCHMARK_OPERATIONS) {
        const item = dataset.operations.find((value) => value.operation === operation);
        if (!item || [item.medianMs, item.maxMs, item.madMs, item.warningMs].some((value) => !Number.isFinite(value) || value < 0) || item.warningMs < item.maxMs || (item.hardMs !== null && (!Number.isFinite(item.hardMs) || item.hardMs < item.warningMs))) throw new Error('INVALID_BASELINE');
        const envelope = Math.max(item.maxMs, item.medianMs + 6 * item.madMs);
        const requiresHard = size >= 1000 && hardOperations.has(operation);
        if (!close(item.warningMs, envelope * 2) || (requiresHard ? item.hardMs === null || !close(item.hardMs, envelope * 6) : item.hardMs !== null)) throw new Error('INVALID_BASELINE_POLICY');
      }
    }
  } catch { result.failures.push('Measured benchmark baseline is invalid or incomplete.'); return result; }
  result.comparable = sameEnvironment(report.environment, baseline.environment);
  if (!result.comparable) { result.warnings.push('Environment differs from measured baseline; timing comparison is unavailable. All correctness and coverage checks remain required.'); return result; }
  for (const dataset of report.datasets) {
    const reference = baseline.datasets.find((item) => item.size === dataset.size)!;
    for (const item of dataset.operations) {
      const budget = reference.operations.find((value) => value.operation === item.operation)!;
      const hardMs = budget.hardMs;
      if (hardMs !== null && item.samplesMs.every((value) => value > hardMs)) result.failures.push(`${dataset.size}/${item.operation}: repeated severe regression exceeds measured budget.`);
      else if (item.medianMs > budget.warningMs) result.warnings.push(`${dataset.size}/${item.operation}: median exceeds measured warning threshold.`);
    }
  }
  return result;
}
