import test from 'node:test';
import assert from 'node:assert/strict';
import { measureOperation, summarizeSamples, withBenchmarkClock } from '../scripts/wp33/measure';
import { runBenchmarks, BENCHMARK_OPERATIONS } from '../scripts/wp33/benchmark';
import { createSyntheticLedger, createSyntheticMedia } from '../scripts/wp33/fixtures';

test('measurement consumes every warmup and sample result and computes repeatable statistics', async () => {
  let calls = 0; let checks = 0;
  const result = await measureOperation('test', async () => ++calls, (value) => { checks++; assert.ok(value > 0); }, 3, 1);
  assert.equal(calls, 4); assert.equal(checks, 4); assert.equal(result.samplesMs.length, 3);
  assert.ok(result.samplesMs.every((value) => Number.isFinite(value) && value >= 0));
  assert.deepEqual(summarizeSamples([9, 1, 5]), { medianMs: 5, minMs: 1, maxMs: 9, madMs: 4 });
});
test('invalid measurement configuration and invalid samples fail closed', async () => {
  for (const samples of [[], [-1], [NaN], [Infinity]]) assert.throws(() => summarizeSamples(samples));
  await assert.rejects(measureOperation('test', () => 1, () => {}, 0, 1));
  await assert.rejects(measureOperation('test', () => 1, () => { throw new Error('incorrect output'); }, 1, 0), /incorrect output/);
});
test('benchmark runs actual complete operations with correctness receipts and isolated fixtures', async () => {
  const report = await runBenchmarks({ sizes: [0, 100], samples: 2, warmups: 0 });
  assert.equal(report.format, 'spendwise-benchmark-v1'); assert.equal(report.environment.runtime, 'node');
  assert.equal(report.environment.nodeMajor, 22); assert.match(report.revision, /^[a-f0-9]{40}$/);
  for (const dataset of report.datasets) {
    assert.equal(dataset.operations.length, BENCHMARK_OPERATIONS.length);
    assert.deepEqual(dataset.operations.map((item) => item.operation).sort(), [...BENCHMARK_OPERATIONS].sort());
    for (const item of dataset.operations) { assert.equal(item.samplesMs.length, 2); assert.ok(item.medianMs >= 0); assert.equal(item.validatedSamples, 2); }
    assert.equal(dataset.correctness.expenses, dataset.size); assert.ok(dataset.archiveBytes > 0);
  }
});
test('fixture limits are enforced without widening archive or media protections', () => {
  for (const size of [-1, 0.5, 25001, Infinity]) assert.throws(() => createSyntheticLedger(size));
  assert.throws(() => createSyntheticMedia(createSyntheticLedger(0), 1));
  assert.throws(() => createSyntheticMedia(createSyntheticLedger(100), 801));
  assert.notDeepEqual(createSyntheticLedger(100, 1), createSyntheticLedger(100, 2));
});
test('synthetic clock preserves explicit Date construction and restores real time after failures', async () => {
  const original = Date; const fixed = Date.UTC(2026, 9, 5, 12);
  await withBenchmarkClock(fixed, async () => {
    assert.equal(Date.now(), fixed); assert.equal(new Date().getTime(), fixed);
    assert.equal(new Date(2025, 0, 2, 3, 4).getTime(), new original(2025, 0, 2, 3, 4).getTime());
    assert.equal(Date.UTC(2025, 0, 2), original.UTC(2025, 0, 2));
  });
  assert.equal(Date, original);
  const failure = new Error('clock test failure');
  await assert.rejects(withBenchmarkClock(fixed, async () => { throw failure; }), (error) => error === failure);
  assert.equal(Date, original);
});
