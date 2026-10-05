import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpus, platform, arch, release } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CategoryStatisticsSection } from '../../src/components/CategoryStatisticsSection';
import { BENCHMARK_SIZES, BENCHMARK_ANCHOR, FIXTURE_SEED, FIXTURE_CLOCK, createSyntheticLedger, createSyntheticMedia, createMemoryStorage, createRestoreHarness } from './fixtures';
import { measureOperation, withBenchmarkClock, type OperationMeasurement } from './measure';
import { LocalDataStoreImpl } from '../../src/utils/localDataStore';
import { financialStatesEqual, persistWebFinancialState, readLegacyFinancialState } from '../../src/utils/financialState';
import { sortHistoryExpenses, searchHistoryExpenses, filterHistoryByDay, groupHistoryByDay, groupHistoryByCategory } from '../../src/utils/historyView';
import { StatisticsEngine } from '../../src/utils/statisticsEngine';
import { rankLargestExpensesByMonth } from '../../src/utils/statisticsRanking';
import { selectMonthlyLedger } from '../../src/app/selectors/monthlyLedger';
import { SpendingAnalyzer } from '../../src/utils/spendingAnalyzer';
import { createBackupV2Archive, validateBackupV2Archive, planBackupV2Restore } from '../../src/utils/backupV2';
import { createBackupV3Envelope, readBackupV3Header, decryptBackupV3Envelope, restoreBackupV3WithAdapters } from '../../src/utils/backupV3';
import { analyzeMediaIntegrity } from '../../src/utils/mediaIntegrity';
import { encryptMediaBytes, decryptMediaBytes } from '../../src/security/EncryptedMediaCodec';

export const BENCHMARK_OPERATIONS = [
  'storage.web.init', 'storage.web.read', 'storage.web.persist', 'ledger.initial',
  'history.sort', 'history.search', 'history.category', 'history.date', 'history.group.day', 'history.group.category',
  'statistics.monthly', 'statistics.all', 'statistics.ranking', 'statistics.detail', 'statistics.localAI',
  'backup.v3.create', 'backup.v3.header', 'backup.v3.decrypt', 'backup.validate.parse', 'backup.restore.prepare', 'backup.restore.replace', 'backup.restore.merge',
  'media.inventory.integrity', 'media.codec.small', 'media.codec.large',
] as const;
export interface BenchmarkEnvironment {
  runtime: 'node'; nodeMajor: number; nodeVersion: string; platform: string; arch: string; osRelease: string; cpu: string; cpuCount: number; timezone: string;
  storageMode: 'isolated-web-memory-adapter'; cryptoMode: 'production-argon2id-and-webcrypto';
}
export interface BenchmarkDataset {
  size: number; mediaCount: number; archiveBytes: number; heapDeltaBytes: number;
  operations: OperationMeasurement[];
  correctness: { expenses: number; totalCents: number; idSum: number };
}
export interface BenchmarkReport {
  format: 'spendwise-benchmark-v1'; generatedAt: string; revision: string; fixture: { seed: number; version: 1; distribution: 'ten-months'; clockTimestamp: number };
  environment: BenchmarkEnvironment; samples: number; warmups: number; datasets: BenchmarkDataset[];
}
export interface BenchmarkOptions { sizes?: readonly number[]; samples?: number; warmups?: number; operations?: readonly string[]; onDataset?: (dataset: BenchmarkDataset) => void; }
const passphrase = 'WP33 synthetic benchmark passphrase';
const settings = { currencyCode: 'USD', themeMode: 'SYSTEM', language: 'en' } as const;

export async function runBenchmarks(options: BenchmarkOptions = {}): Promise<BenchmarkReport> {
  return withBenchmarkClock(FIXTURE_CLOCK, () => runActualBenchmarks(options));
}

async function runActualBenchmarks(options: BenchmarkOptions): Promise<BenchmarkReport> {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('BENCHMARK_REQUIRES_NODE_22');
  const samples = options.samples ?? 5; const warmups = options.warmups ?? 1;
  const sizes = options.sizes ?? BENCHMARK_SIZES;
  if (!sizes.length || new Set(sizes).size !== sizes.length) throw new Error('INVALID_BENCHMARK_SIZES');
  if (options.operations?.some((value) => !(BENCHMARK_OPERATIONS as readonly string[]).includes(value))) throw new Error('UNKNOWN_BENCHMARK_OPERATION');
  const cpu = cpus();
  const report: BenchmarkReport = {
    format: 'spendwise-benchmark-v1', generatedAt: new Date(performance.timeOrigin + performance.now()).toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    fixture: { seed: FIXTURE_SEED, version: 1, distribution: 'ten-months', clockTimestamp: FIXTURE_CLOCK }, samples, warmups,
    environment: { runtime: 'node', nodeMajor: 22, nodeVersion: process.versions.node, platform: platform(), arch: arch(), osRelease: release(), cpu: cpu[0]?.model ?? 'unknown', cpuCount: cpu.length, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, storageMode: 'isolated-web-memory-adapter', cryptoMode: 'production-argon2id-and-webcrypto' }, datasets: [],
  };
  for (const size of sizes) {
    const heapBefore = process.memoryUsage().heapUsed;
    const state = createSyntheticLedger(size);
    const totalCents = state.expenses.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
    const operations: OperationMeasurement[] = [];
    const measure = async <T>(operation: typeof BENCHMARK_OPERATIONS[number], work: () => T | Promise<T>, validate: (value: T) => void) => {
      if (!options.operations || options.operations.includes(operation)) operations.push(await measureOperation(operation, work, validate, samples, warmups));
    };
    const storage = createMemoryStorage(); persistWebFinancialState(storage, state);
    await measure('storage.web.init', async () => { const store = new LocalDataStoreImpl(); await store.init(storage); return store.getExpenses(); }, (items) => assert.deepEqual(items, state.expenses));
    await measure('storage.web.read', () => readLegacyFinancialState(storage), (value) => assert.ok(financialStatesEqual(value, state)));
    await measure('storage.web.persist', () => { const target = createMemoryStorage(); persistWebFinancialState(target, state); return target; }, (target) => assert.ok(financialStatesEqual(readLegacyFinancialState(target), state)));
    await measure('ledger.initial', () => selectMonthlyLedger(state.expenses, state.budgets, BENCHMARK_ANCHOR), (value) => assert.equal(value.monthlyExpenses.length, state.expenses.filter((item) => new Date(item.date).getMonth() === 9).length));
    const sortedReference = [...state.expenses].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
    await measure('history.sort', () => sortHistoryExpenses(state.expenses), (items) => assert.deepEqual(items, sortedReference));
    const searchReference = sortedReference.filter((item) => item.description.toLowerCase().includes('fixture 17'));
    await measure('history.search', () => searchHistoryExpenses(state.expenses, 'fixture 17'), (items) => assert.deepEqual(items, searchReference));
    const category = state.expenses[0]?.category ?? 'Food & Dining';
    await measure('history.category', () => groupHistoryByCategory(state.expenses).find((group) => group.category === category)?.expenses ?? [], (items) => assert.equal(items.length, state.expenses.filter((item) => item.category === category).length));
    const day = state.expenses[0]?.date ?? Date.UTC(2026, 0, 1, 12);
    await measure('history.date', () => filterHistoryByDay(state.expenses, day), (items) => assert.equal(items.length, state.expenses.filter((item) => new Date(item.date).toDateString() === new Date(day).toDateString()).length));
    await measure('history.group.day', () => groupHistoryByDay(state.expenses), (groups) => assert.equal(groups.reduce((sum, group) => sum + group.expenses.length, 0), size));
    await measure('history.group.category', () => groupHistoryByCategory(state.expenses), (groups) => assert.equal(groups.reduce((sum, group) => sum + group.count, 0), size));
    const stats = StatisticsEngine.calculateStatistics(state.expenses, state.budgets, 'ALL_TIME', BENCHMARK_ANCHOR);
    await measure('statistics.monthly', () => StatisticsEngine.calculateStatistics(state.expenses, state.budgets, 'CURRENT_MONTH', BENCHMARK_ANCHOR), (value) => assert.equal(value.totalTransactions, state.expenses.filter((item) => new Date(item.date).getMonth() === 9).length));
    await measure('statistics.all', () => StatisticsEngine.calculateStatistics(state.expenses, state.budgets, 'ALL_TIME', BENCHMARK_ANCHOR), (value) => { assert.equal(value.totalTransactions, size); assert.ok(Math.abs(value.totalSpent - totalCents / 100) < 0.00001); });
    await measure('statistics.ranking', () => rankLargestExpensesByMonth(stats.monthlyStats), (value) => assert.equal(value.length, stats.monthlyStats.filter((month) => month.largestExpense).length));
    // Actual expanded detail component, rendered to static markup in Node. Browser commit is measured separately.
    await measure('statistics.detail', () => renderToStaticMarkup(createElement(CategoryStatisticsSection, { stats, currencyCode: 'USD', language: 'en', expandedCategory: stats.categoryTrends[0]?.category ?? null, onToggleCategory: () => {} })), (markup) => { assert.ok(markup.length > 0); if (size) assert.ok(markup.includes('aria-expanded="true"')); });
    await measure('statistics.localAI', () => { const analyzer = new SpendingAnalyzer(); const summary = analyzer.computeHistoricalSummary(state.expenses, BENCHMARK_ANCHOR); return { summary, analysis: analyzer.generateStatisticalAnalysis(summary, 'USD') }; }, (value) => { assert.equal(value.analysis.isAiGenerated, false); assert.equal(value.summary.currentMonthExpenses.length, state.expenses.filter((item) => new Date(item.date).getMonth() === 9).length); });
    const createPayload = () => createBackupV2Archive({ appVersion: '2.0.0', state, settings, includeMedia: false, readMedia: async () => { throw new Error('NO_MEDIA_EXPECTED'); } });
    const payload = await createPayload();
    const backup = await createBackupV3Envelope({ payload, passphrase, mediaIncluded: false });
    const validated = await validateBackupV2Archive(payload);
    await measure('backup.v3.create', async () => createBackupV3Envelope({ payload: await createPayload(), passphrase, mediaIncluded: false }), (value) => assert.ok(value.size > 0));
    await measure('backup.v3.header', () => readBackupV3Header(backup), (value) => assert.equal(value.payload.mediaIncluded, false));
    await measure('backup.v3.decrypt', () => decryptBackupV3Envelope(backup, passphrase), (value) => assert.equal(value.size, payload.size));
    await measure('backup.validate.parse', () => validateBackupV2Archive(payload), (value) => assert.equal(value.manifest.expenses.length, size));
    const existing = createSyntheticLedger(size, FIXTURE_SEED + 1);
    await measure('backup.restore.prepare', () => planBackupV2Restore(validated.manifest, existing, false), (value) => assert.equal(value.expensesImported + value.expensesSkipped, size));
    await measure('backup.restore.replace', async () => { const harness = createRestoreHarness(createSyntheticLedger(0)); const summary = await restoreBackupV3WithAdapters(backup, passphrase, true, harness.adapters); return { summary, state: harness.getState() }; }, (value) => { assert.equal(value.summary.expensesImported, size); assert.ok(financialStatesEqual(value.state, state)); });
    const plan = planBackupV2Restore(validated.manifest, existing, false);
    await measure('backup.restore.merge', async () => { const harness = createRestoreHarness(existing); const summary = await restoreBackupV3WithAdapters(backup, passphrase, false, harness.adapters); return { summary, state: harness.getState() }; }, (value) => { assert.equal(value.summary.expensesImported + value.summary.expensesSkipped, size); assert.deepEqual(value.state.expenses, plan.nextExpenses); });
    const media = createSyntheticMedia(state, Math.min(size * 2, 1000));
    await measure('media.inventory.integrity', () => analyzeMediaIntegrity(state.expenses, media.attachments, media.binaries), (value) => { assert.equal(value.healthy, true); assert.equal(value.totalMetadataRecords, media.attachments.length); });
    // Generated byte buffers exercise the real AES-GCM codec, not image decoding or disk I/O.
    const key = new Uint8Array(32).fill(33);
    for (const [operation, length] of [['media.codec.small', 4096], ['media.codec.large', 5 * 1024 * 1024]] as const) {
      const bytes = new Uint8Array(length); for (let i = 0; i < length; i++) bytes[i] = i % 251;
      await measure(operation, async () => decryptMediaBytes(await encryptMediaBytes(bytes, key), key), (value) => assert.deepEqual(value, bytes));
    }
    const dataset: BenchmarkDataset = { size, mediaCount: media.attachments.length, archiveBytes: backup.size, heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore, operations, correctness: { expenses: size, totalCents, idSum: state.expenses.reduce((sum, item) => sum + item.id, 0) } };
    report.datasets.push(dataset); options.onDataset?.(dataset);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.env.TZ = 'UTC';
  const output = process.argv[2] ?? 'artifacts/wp33/benchmark.json';
  const report = await runBenchmarks({ onDataset: (dataset) => console.info(`WP33 synthetic ${dataset.size}: ${dataset.operations.length} operations validated`) });
  await mkdir(resolve(output, '..'), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.info(`WP33 benchmark report saved: ${output}`);
}
