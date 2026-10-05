import test from 'node:test';
import assert from 'node:assert/strict';
import { runFullMediaBenchmark } from '../scripts/wp33/fullMedia';
import { createFullMediaBaseline, compareFullMedia } from '../scripts/wp33/fullMediaBudget';

test('full-media measurements exercise production archive and every restored byte', async () => {
  const report = await runFullMediaBenchmark(3, 0);
  assert.equal(report.fixture.expenses, 100);
  assert.equal(report.fixture.attachments, 32);
  assert.ok(report.fixture.mediaBytes > 0);
  assert.match(report.revision, /^[a-f0-9]{40}$/);
  assert.deepEqual(report.operations.map((item) => item.operation), ['backup.full.create', 'backup.full.decrypt', 'backup.full.validate', 'backup.full.restore']);
  for (const operation of report.operations) { assert.equal(operation.validatedSamples, 3); assert.equal(operation.samplesMs.length, 3); }
  assert.equal(report.correctness.restoredAttachments, 32);
  assert.equal(report.correctness.byteEquivalent, true);
  const baseline = createFullMediaBaseline([report, structuredClone(report)]);
  assert.deepEqual(compareFullMedia(report, baseline), { comparable: true, warnings: [], failures: [] });
  const bad = structuredClone(report); bad.correctness.byteEquivalent = false as any;
  assert.equal(compareFullMedia(bad, baseline).failures.length, 1);
  const mismatch = structuredClone(report); mismatch.environment.cpu = 'other';
  assert.equal(compareFullMedia(mismatch, baseline).comparable, false);
  const slow = structuredClone(report);
  slow.operations[0].samplesMs = slow.operations[0].samplesMs.map((value) => value * 100);
  Object.assign(slow.operations[0], { medianMs: slow.operations[0].medianMs * 100, minMs: slow.operations[0].minMs * 100, maxMs: slow.operations[0].maxMs * 100, madMs: slow.operations[0].madMs * 100 });
  assert.equal(compareFullMedia(slow, baseline).warnings.length, 1);
  const invalidTiming = structuredClone(report); invalidTiming.operations[0].medianMs = NaN;
  assert.equal(compareFullMedia(invalidTiming, baseline).failures.length, 1);
  const invalidBudget = structuredClone(baseline); invalidBudget.operations[0].warningMs = NaN;
  assert.equal(compareFullMedia(report, invalidBudget).failures.length, 1);
});
