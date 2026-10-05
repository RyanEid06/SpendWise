import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('WP33 gate runs focused contracts and the real complete benchmark comparison', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.match(scripts['test:wp33'], /wp33-\*\.test\.ts/);
  assert.match(scripts['test:wp33'], /scripts\/wp33\/gate\.ts/);
  const gate = readFileSync('scripts/wp33/gate.ts', 'utf8');
  assert.match(gate, /runBenchmarks\(/);
  assert.match(gate, /compareBenchmark\(/);
  assert.match(gate, /result\.failures\.length/);
  assert.doesNotMatch(gate, /createBenchmarkBaseline|writeFile\([^\n]*baselines/);
});
test('WP33 follows retained WP32 checks before Android sync and preserves web acceptance', () => {
  const android = readFileSync('.github/workflows/android-build.yml', 'utf8');
  const gate = android.indexOf('run: npm run test:wp33');
  assert.ok(gate > android.indexOf('run: npm run test:wp32:runner'));
  assert.ok(gate < android.indexOf('run: npm run android:sync'));
  for (const packet of [26, 27, 28, 29, 30, 31]) assert.ok(android.includes(`run: npm run test:wp${packet}`));
  assert.match(android, /retention-days: 7/);
  const web = readFileSync('.github/workflows/wp32-e2e.yml', 'utf8');
  assert.ok(web.indexOf('run: npm run test:wp33:browser') > web.indexOf('run: npm run test:wp32'));
  assert.match(web, /Run WP32 executable web suite/);
});
