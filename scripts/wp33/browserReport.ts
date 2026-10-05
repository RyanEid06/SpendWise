import { execFileSync } from 'node:child_process';
import { cpus, arch, platform } from 'node:os';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BENCHMARK_SIZES, FIXTURE_CLOCK, FIXTURE_SEED } from './fixtures';
import { summarizeSamples } from './measure';

const metricNames = ['history.initial.render', 'history.initial.commit', 'history.search.wall', 'history.search.render', 'statistics.initial.render', 'statistics.all.render', 'statistics.detail.render'] as const;
interface BrowserMetric { metric: typeof metricNames[number]; samplesMs: number[]; medianMs: number; minMs: number; maxMs: number; madMs: number; warningMs: number; hardMs: null; }
export interface BrowserSummary {
  format: 'spendwise-browser-summary-v1'; generatedAt: string; revision: string;
  fixture: { clockTimestamp: number; seed: number; version: 1 };
  environment: { browser: string; mode: 'react-development-harness'; timezone: 'UTC'; cpu: string; cpuCount: number; platform: string; arch: string };
  datasets: { size: number; distribution: 'distributed' | 'concentrated'; metrics: BrowserMetric[] }[];
}
const object = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BROWSER_REPORT');
  return value as Record<string, any>;
};
const number = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('INVALID_BROWSER_TIMING');
  return value;
};

export function summarizeBrowserReports(inputs: unknown[]): BrowserSummary {
  if (inputs.length !== BENCHMARK_SIZES.length * 2) throw new Error('INCOMPLETE_BROWSER_COVERAGE');
  const reports = inputs.map(object); const first = reports[0];
  if (typeof first.browser !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(first.browser)) throw new Error('INVALID_BROWSER_VERSION');
  const cpu = cpus();
  const result: BrowserSummary = { format: 'spendwise-browser-summary-v1', generatedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), fixture: { clockTimestamp: FIXTURE_CLOCK, seed: FIXTURE_SEED, version: 1 }, environment: { browser: first.browser, mode: 'react-development-harness', timezone: 'UTC', cpu: cpu[0]?.model ?? 'unknown', cpuCount: cpu.length, platform: platform(), arch: arch() }, datasets: [] };
  const seen = new Set<string>();
  for (const report of reports) {
    if (report.format !== 'spendwise-browser-benchmark-v1' || report.browser !== first.browser || report.environment !== 'pinned-chromium-react-development-harness' || report.timezone !== 'UTC' || !Array.isArray(report.rows) || report.rows.length !== 10) throw new Error('INVALID_BROWSER_REPORT');
    if (report.fixture?.clockTimestamp !== FIXTURE_CLOCK || report.fixture?.seed !== FIXTURE_SEED || report.fixture?.version !== 1) throw new Error('INVALID_BROWSER_FIXTURE');
    const firstRow = object(report.rows[0]); const size = firstRow.size; const distribution = firstRow.distribution;
    if (!(BENCHMARK_SIZES as readonly unknown[]).includes(size) || !['distributed', 'concentrated'].includes(distribution)) throw new Error('INVALID_BROWSER_FIXTURE');
    const key = `${size}/${distribution}`; if (seen.has(key)) throw new Error('DUPLICATE_BROWSER_COVERAGE'); seen.add(key);
    const samples = Object.fromEntries(metricNames.map((name) => [name, []])) as unknown as Record<typeof metricNames[number], number[]>;
    for (let sample = 0; sample < 5; sample++) {
      const rows = report.rows.filter((value: unknown) => object(value).sample === sample);
      if (rows.length !== 2) throw new Error('INVALID_BROWSER_SAMPLES');
      const history = object(rows.find((value: any) => value.operation === 'history'));
      const statistics = object(rows.find((value: any) => value.operation === 'statistics'));
      if ([history, statistics].some((row) => row.size !== size || row.distribution !== distribution) || statistics.totalTransactions !== size || history.renderedCount !== (distribution === 'concentrated' ? size : Math.floor(size / 10)) || !Number.isInteger(history.searchedCount) || history.searchedCount < 0 || history.searchedCount > history.renderedCount) throw new Error('INVALID_BROWSER_CORRECTNESS_RECEIPT');
      const initial = object(history.initial); const search = object(history.search);
      if (!Array.isArray(initial.profiles) || !initial.profiles.length || !Array.isArray(statistics.statistics?.profiles) || statistics.statistics.profiles.length < 2) throw new Error('MISSING_BROWSER_PROFILES');
      const mount = object(initial.profiles[0]); const statsProfiles = statistics.statistics.profiles;
      samples['history.initial.render'].push(number(mount.actualDurationMs));
      samples['history.initial.commit'].push(number(mount.commitSinceRenderStartMs));
      samples['history.search.wall'].push(number(search.wallMs));
      samples['history.search.render'].push(number(object(search.profile).actualDurationMs));
      samples['statistics.initial.render'].push(number(object(statsProfiles[0]).actualDurationMs));
      samples['statistics.all.render'].push(number(object(statsProfiles[1]).actualDurationMs));
      if (size > 0) { if (statsProfiles.length < 3) throw new Error('MISSING_DETAIL_PROFILE'); samples['statistics.detail.render'].push(number(object(statsProfiles.at(-1)).actualDurationMs)); }
    }
    const metrics = metricNames.filter((name) => size > 0 || name !== 'statistics.detail.render').map((metric) => {
      const samplesMs = samples[metric]; const summary = summarizeSamples(samplesMs);
      return { metric, samplesMs, ...summary, warningMs: 2 * Math.max(summary.maxMs, summary.medianMs + 6 * summary.madMs), hardMs: null };
    });
    result.datasets.push({ size, distribution, metrics });
  }
  result.datasets.sort((a, b) => a.size - b.size || a.distribution.localeCompare(b.distribution)); return result;
}

function validateSummary(input: BrowserSummary): void {
  if (input.format !== 'spendwise-browser-summary-v1' || input.datasets.length !== BENCHMARK_SIZES.length * 2) throw new Error('INVALID_BROWSER_SUMMARY');
  if (input.fixture.clockTimestamp !== FIXTURE_CLOCK || input.fixture.seed !== FIXTURE_SEED || input.fixture.version !== 1) throw new Error('INVALID_BROWSER_SUMMARY');
  const seen = new Set<string>();
  for (const dataset of input.datasets) {
    if (!(BENCHMARK_SIZES as readonly number[]).includes(dataset.size) || !['distributed', 'concentrated'].includes(dataset.distribution)) throw new Error('INVALID_BROWSER_SUMMARY');
    const key = `${dataset.size}/${dataset.distribution}`; if (seen.has(key)) throw new Error('INVALID_BROWSER_SUMMARY'); seen.add(key);
    const required = metricNames.filter((name) => dataset.size > 0 || name !== 'statistics.detail.render');
    if (dataset.metrics.length !== required.length || new Set(dataset.metrics.map((item) => item.metric)).size !== required.length) throw new Error('INVALID_BROWSER_SUMMARY');
    for (const name of required) {
      const metric = dataset.metrics.find((item) => item.metric === name);
      if (!metric || metric.samplesMs.length !== 5 || metric.hardMs !== null) throw new Error('INVALID_BROWSER_SUMMARY');
      const summary = summarizeSamples(metric.samplesMs);
      for (const field of ['medianMs', 'minMs', 'maxMs', 'madMs'] as const) if (Math.abs(number(metric[field]) - summary[field]) > 1e-6) throw new Error('INVALID_BROWSER_SUMMARY');
      if (Math.abs(number(metric.warningMs) - 2 * Math.max(summary.maxMs, summary.medianMs + 6 * summary.madMs)) > 1e-6) throw new Error('INVALID_BROWSER_SUMMARY');
    }
  }
}

export function compareBrowserSummary(current: BrowserSummary, baseline: BrowserSummary) {
  const result = { comparable: false, failures: [] as string[], warnings: [] as string[] };
  try { validateSummary(current); validateSummary(baseline); } catch { result.failures.push('Browser measurement or baseline coverage is invalid.'); return result; }
  result.comparable = (Object.keys(current.environment) as (keyof BrowserSummary['environment'])[]).every((key) => current.environment[key] === baseline.environment[key]);
  if (!result.comparable) { result.warnings.push('Browser environment differs from measured baseline; correctness remains required and timings are incomparable.'); return result; }
  for (const dataset of current.datasets) for (const metric of dataset.metrics) {
    const reference = baseline.datasets.find((item) => item.size === dataset.size && item.distribution === dataset.distribution)!.metrics.find((item) => item.metric === metric.metric)!;
    if (metric.medianMs > reference.warningMs) result.warnings.push(`${dataset.size}/${dataset.distribution}/${metric.metric}: measured warning threshold exceeded.`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.argv[2] ?? 'test-results/performance'; const output = process.argv[3] ?? 'artifacts/wp33/browser-summary.json';
  const reports: unknown[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) if (entry.isDirectory()) reports.push(JSON.parse(await readFile(join(root, entry.name, 'browser-measurements.json'), 'utf8')));
  const summary = summarizeBrowserReports(reports); await mkdir(resolve(output, '..'), { recursive: true }); await writeFile(output, JSON.stringify(summary, null, 2) + '\n');
  let baseline: BrowserSummary | undefined;
  try { baseline = JSON.parse(await readFile('scripts/wp33/baselines/browser-windows-chromium.json', 'utf8')); } catch {}
  if (baseline) { const result = compareBrowserSummary(summary, baseline); for (const warning of result.warnings) console.warn(warning); if (result.failures.length) throw new Error('INVALID_BROWSER_BENCHMARK_GATE'); }
  else console.warn('Browser baseline is unavailable; correctness receipts are complete, timing comparison is warning-only.');
  console.info(`WP33 browser summary: ${summary.datasets.length} datasets validated.`);
}
