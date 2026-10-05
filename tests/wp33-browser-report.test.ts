import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBrowserReports, compareBrowserSummary } from '../scripts/wp33/browserReport';
import { BENCHMARK_SIZES, FIXTURE_CLOCK, FIXTURE_SEED } from '../scripts/wp33/fixtures';

function reports(): any[] {
  return BENCHMARK_SIZES.flatMap((size) => ['distributed', 'concentrated'].map((distribution) => ({ format: 'spendwise-browser-benchmark-v1', browser: '153.0.8010.12', timezone: 'UTC', environment: 'pinned-chromium-react-development-harness', fixture: { seed: FIXTURE_SEED, clockTimestamp: FIXTURE_CLOCK, version: 1 }, rows: Array.from({ length: 5 }, (_, sample) => [
    { sample, operation: 'history', size, distribution, renderedCount: distribution === 'concentrated' ? size : Math.floor(size / 10), searchedCount: 0, initial: { storageInitMs: 1, profiles: [{ actualDurationMs: 10, commitSinceRenderStartMs: 12 }] }, search: { wallMs: 15, profile: { actualDurationMs: 5 } } },
    { sample, operation: 'statistics', size, distribution, totalTransactions: size, statistics: { profiles: [{ actualDurationMs: 10 }, { actualDurationMs: 11 }, { actualDurationMs: 12 }] } },
  ]).flat() })));
}
test('browser summary requires all five sizes and distributions with repeated measured samples', () => {
  const summary = summarizeBrowserReports(reports()); assert.equal(summary.datasets.length, 10);
  assert.equal(compareBrowserSummary(summary, summary).failures.length, 0);
  assert.equal(compareBrowserSummary(summary, summary).warnings.length, 0);
  for (const dataset of summary.datasets) for (const metric of dataset.metrics) { assert.equal(metric.samplesMs.length, 5); assert.equal(metric.hardMs, null); assert.ok(metric.warningMs >= metric.maxMs); }
});
test('browser coverage, malformed rows and nonfinite timings cannot silently pass', () => {
  const missing = reports(); missing.pop(); assert.throws(() => summarizeBrowserReports(missing));
  const duplicate = reports(); duplicate[0] = duplicate[1]; assert.throws(() => summarizeBrowserReports(duplicate));
  for (const value of [NaN, Infinity, -1]) { const input = reports(); input[0].rows[0].initial.profiles[0].actualDurationMs = value; assert.throws(() => summarizeBrowserReports(input)); }
  const few = reports(); few[0].rows.pop(); assert.throws(() => summarizeBrowserReports(few));
});
test('browser timing changes warn while environment mismatch is explicitly incomparable', () => {
  const baseline = summarizeBrowserReports(reports()); const slower = reports();
  for (const report of slower) for (const row of report.rows) if (row.operation === 'history') row.search.wallMs *= 10;
  const result = compareBrowserSummary(summarizeBrowserReports(slower), baseline);
  assert.equal(result.failures.length, 0); assert.ok(result.warnings.length > 0);
  const different = structuredClone(baseline); different.environment.browser = '154';
  assert.equal(compareBrowserSummary(different, baseline).comparable, false);
});
