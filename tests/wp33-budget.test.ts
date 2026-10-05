import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBenchmark, createBenchmarkBaseline } from '../scripts/wp33/budgets';
import { BENCHMARK_OPERATIONS, type BenchmarkReport } from '../scripts/wp33/benchmark';
import { BENCHMARK_SIZES, FIXTURE_SEED, FIXTURE_CLOCK } from '../scripts/wp33/fixtures';

function report(): BenchmarkReport {
  return { format: 'spendwise-benchmark-v1', generatedAt: new Date().toISOString(), revision: 'a'.repeat(40), fixture: { seed: FIXTURE_SEED, version: 1, distribution: 'ten-months', clockTimestamp: FIXTURE_CLOCK }, environment: { runtime: 'node', nodeMajor: 22, nodeVersion: '22.23.3', platform: 'win32', arch: 'x64', osRelease: 'test', cpu: 'Synthetic test CPU', cpuCount: 4, timezone: 'UTC', storageMode: 'isolated-web-memory-adapter', cryptoMode: 'production-argon2id-and-webcrypto' }, samples: 5, warmups: 1, datasets: BENCHMARK_SIZES.map((size) => ({ size, mediaCount: Math.min(size * 2, 1000), archiveBytes: 100, heapDeltaBytes: 0, correctness: { expenses: size, totalCents: 0, idSum: size * (size + 1) / 2 }, operations: BENCHMARK_OPERATIONS.map((operation) => ({ operation, samplesMs: [9, 10, 10, 10, 11], validatedSamples: 5, medianMs: 10, minMs: 9, maxMs: 11, madMs: 0 })) })) };
}
function scaleMeasurement(input: BenchmarkReport, operation: string, factor: number) {
  for (const dataset of input.datasets) for (const item of dataset.operations) if (item.operation === operation) {
    item.samplesMs = item.samplesMs.map((value) => value * factor);
    item.medianMs *= factor; item.minMs *= factor; item.maxMs *= factor; item.madMs *= factor;
  }
}
test('measured baselines accept unchanged complete reports and never mutate sources', () => {
  const input = report(); const before = JSON.stringify(input); const baseline = createBenchmarkBaseline([input, structuredClone(input)]);
  const result = compareBenchmark(input, baseline); assert.equal(result.failures.length, 0); assert.equal(result.warnings.length, 0); assert.equal(result.comparable, true); assert.equal(JSON.stringify(input), before);
});
test('repeated severe relative regressions block while moderate shifts and crypto variation warn', () => {
  const baseline = createBenchmarkBaseline([report(), report()]);
  const moderate = report(); scaleMeasurement(moderate, 'backup.restore.prepare', 3);
  assert.equal(compareBenchmark(moderate, baseline).failures.length, 0); assert.ok(compareBenchmark(moderate, baseline).warnings.length > 0);
  const severe = report(); scaleMeasurement(severe, 'backup.restore.prepare', 10);
  assert.ok(compareBenchmark(severe, baseline).failures.some((item) => item.includes('backup.restore.prepare')));
  const crypto = report(); scaleMeasurement(crypto, 'backup.v3.create', 10);
  assert.equal(compareBenchmark(crypto, baseline).failures.length, 0); assert.ok(compareBenchmark(crypto, baseline).warnings.length > 0);
});
test('one noisy sample is not a repeated severe regression', () => {
  const baseline = createBenchmarkBaseline([report(), report()]); const input = report();
  const item = input.datasets[3].operations.find((entry) => entry.operation === 'backup.restore.prepare')!;
  item.samplesMs = [9, 10, 10, 10, 500]; item.maxMs = 500;
  assert.equal(compareBenchmark(input, baseline).failures.length, 0);
});
test('different runtime environments warn instead of asserting comparable performance', () => {
  const baseline = createBenchmarkBaseline([report(), report()]);
  for (const field of ['platform', 'cpu', 'timezone', 'storageMode', 'cryptoMode'] as const) {
    const input = report(); (input.environment as unknown as Record<string, unknown>)[field] = 'different';
    const result = compareBenchmark(input, baseline); assert.equal(result.comparable, false); assert.equal(result.failures.length, 0); assert.ok(result.warnings.length > 0);
  }
});
test('missing baseline, sizes, operations, duplicated coverage and invalid samples fail closed', () => {
  const baseline = createBenchmarkBaseline([report(), report()]);
  assert.ok(compareBenchmark(report(), undefined).failures.length > 0);
  for (const mutate of [
    (input: BenchmarkReport) => input.datasets.pop(),
    (input: BenchmarkReport) => input.datasets[0].operations.pop(),
    (input: BenchmarkReport) => input.datasets.push(input.datasets[0]),
    (input: BenchmarkReport) => { input.datasets[0].operations[0].samplesMs[0] = NaN; },
    (input: BenchmarkReport) => { input.datasets[0].operations[0].samplesMs[0] = -1; },
    (input: BenchmarkReport) => { input.datasets[0].operations[0].medianMs = Infinity; },
    (input: BenchmarkReport) => { input.datasets[0].operations[0].validatedSamples = 0; },
    (input: BenchmarkReport) => { input.fixture.seed = 1; },
  ]) { const input = report(); mutate(input); assert.ok(compareBenchmark(input, baseline).failures.length > 0); }
});
test('baseline construction requires at least two valid compatible measured runs', () => {
  assert.throws(() => createBenchmarkBaseline([report()]));
  const different = report(); different.environment.cpu = 'different';
  assert.throws(() => createBenchmarkBaseline([report(), different]));
});
test('baseline edits cannot silently remove or inflate required severe budgets', () => {
  for (const change of ['remove', 'inflate'] as const) {
    const baseline = createBenchmarkBaseline([report(), report()]);
    const item = baseline.datasets[3].operations.find((entry) => entry.operation === 'backup.restore.prepare')!;
    if (change === 'remove') item.hardMs = null; else item.hardMs! *= 100;
    assert.ok(compareBenchmark(report(), baseline).failures.length > 0);
  }
});
