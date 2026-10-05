import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runBenchmarks } from './benchmark';
import { compareBenchmark, type BenchmarkBaseline } from './budgets';

process.env.TZ = 'UTC';
const baseline = JSON.parse(await readFile('scripts/wp33/baselines/windows-node22.json', 'utf8')) as BenchmarkBaseline;
const report = await runBenchmarks({ onDataset: (dataset) => console.info(`WP33 ${dataset.size}: ${dataset.operations.length} correctness-validated operations`) });
const result = compareBenchmark(report, baseline);
await mkdir('artifacts/wp33', { recursive: true });
await writeFile('artifacts/wp33/ci-benchmark.json', JSON.stringify(report, null, 2) + '\n');
await writeFile('artifacts/wp33/ci-budget-result.json', JSON.stringify(result, null, 2) + '\n');
for (const warning of result.warnings) console.warn(warning);
if (result.failures.length) throw new Error(result.failures.join('\n'));
console.info(`WP33 benchmark gate passed; timing environment ${result.comparable ? 'comparable' : 'incomparable (warning only)'}.`);
