import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { deriveNativeColdTimings, readNativeDiagnosticReport } from '../scripts/wp33/native';
import type { DiagnosticReport } from '../src/services/diagnostics/contract';

function report(count: number, meanMs = 100): DiagnosticReport {
  return { format: 'spendwise-technical-diagnostics-v1', generatedAt: 1,
    app: { version: '2.0.0', build: 6 }, schemaVersion: 1, backupVersion: 3,
    state: { platform: 'android', databaseOpen: true, databaseEncrypted: true }, recentErrors: [],
    timings: Object.fromEntries(['storage.init', 'storage.open', 'storage.read'].map(operation =>
      [operation, { count, meanMs, maxMs: 1000 }])) };
}

test('native cold timings use fresh per-boot counter deltas rather than cumulative means', () => {
  const before = report(2, 100); const after = report(3, 110);
  assert.deepEqual(deriveNativeColdTimings(before, after), {
    'storage.init': 130, 'storage.open': 130, 'storage.read': 130,
  });
  assert.equal(deriveNativeColdTimings(after, structuredClone(after)), undefined);
});

test('persisted ready state and partial startup cannot satisfy fresh native measurement', () => {
  const before = report(1); const after = report(2, 110);
  assert.equal(deriveNativeColdTimings(before, before), undefined);
  after.timings['storage.read'] = before.timings['storage.read'];
  assert.equal(deriveNativeColdTimings(before, after), undefined);
  const incomplete = report(2, 110); incomplete.timings['storage.init'] = before.timings['storage.init'];
  assert.equal(deriveNativeColdTimings(before, incomplete), undefined);
  const unencrypted = report(2, 110); unencrypted.state.databaseEncrypted = false;
  assert.equal(deriveNativeColdTimings(before, unencrypted), undefined);
});

test('fresh failure timings cannot certify successful startup, while retained old failures can remain', () => {
  const before = report(1); const after = report(2, 110);
  after.recentErrors = [{ operation: 'storage.init', code: 'STORAGE_INIT_FAILED', outcome: 'failure', timestamp: 2, durationMs: 120 }];
  assert.equal(deriveNativeColdTimings(before, after), undefined);
  before.recentErrors = structuredClone(after.recentErrors);
  assert.deepEqual(deriveNativeColdTimings(before, after), { 'storage.init': 120, 'storage.open': 120, 'storage.read': 120 });
});

test('native sanitization uses the device clock so host drift cannot hide a new startup failure', () => {
  const deviceClock = Date.now() + 60_000;
  const sanitized = readNativeDiagnosticReport(JSON.stringify({ version: 1, state: { platform: 'android', databaseOpen: true, databaseEncrypted: true },
    recentErrors: [{ operation: 'storage.init', code: 'STORAGE_INIT_FAILED', outcome: 'failure', timestamp: deviceClock - 10, token: 'forbidden-private-value' }], timings: {} }), deviceClock);
  assert.equal(sanitized.recentErrors.length, 1);
  assert.equal(sanitized.recentErrors[0].timestamp, deviceClock - 10);
  assert.ok(!JSON.stringify(sanitized).includes('forbidden-private-value'));
  for (const clock of [NaN, Infinity, -1, '2000', 8_640_000_000_000_001]) {
    assert.throws(() => readNativeDiagnosticReport(null, clock), /NATIVE_CLOCK_UNAVAILABLE/);
  }
});

test('native counter resets, duplicate work and invalid or impossible durations fail closed', () => {
  for (const after of [report(0), report(1), report(3), report(2, NaN), report(2, Infinity), report(2, -1), report(2, 600001)]) {
    assert.equal(deriveNativeColdTimings(report(1), after), undefined);
  }
  const missing = report(2); delete missing.timings['storage.open'];
  assert.equal(deriveNativeColdTimings(report(1), missing), undefined);
});

test('native collector preserves diagnostics and requires restarted process plus all fresh counters', () => {
  const source = readFileSync('scripts/wp33/native.ts', 'utf8');
  assert.doesNotMatch(source, /localStorage\.removeItem/);
  assert.match(source, /deriveNativeColdTimings\(previous, report\)/);
  assert.match(source, /connectedPid !== previousPid/);
  assert.match(source, /processRestartVerified: true/);
});

test('isolated native measurement uses the same synthetic v2 restore and probe as full acceptance', () => {
  const runner = readFileSync('scripts/run-wp32-isolated-gate.sh', 'utf8');
  const checkpoint = runner.slice(runner.indexOf('  wp33-native-startup)'), runner.indexOf('  app-lock-setup)'));
  assert.match(checkpoint, /install_current/);
  assert.match(checkpoint, /run_flow.*\.maestro\/current\/import-v2-full\.yaml/);
  assert.match(checkpoint, /WP33_NATIVE_FIXTURE="wp32-v2-full"/);
  assert.match(checkpoint, /run-wp33-native-benchmark\.sh/);
  const workflow = readFileSync('.github/workflows/wp32-isolated-gates.yml', 'utf8');
  assert.match(workflow, /- wp33-native-startup/);
  assert.match(workflow, /avd-name: wp33-synthetic-api34/);
  assert.match(workflow, /esbuild scripts\/wp33\/native\.ts/);
});

test('isolated startup refuses unsafe devices before reset, setup, failure capture or cleanup', () => {
  const bash = process.env.WP32_BASH || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
  for (const input of [
    { serial: 'physical-phone', qemu: '0', avd: 'wp33-synthetic-api34' },
    { serial: 'emulator-5554', qemu: '0', avd: 'wp33-synthetic-api34' },
    { serial: 'emulator-5554', qemu: '1', avd: 'personal-emulator' },
  ]) {
    const result = spawnSync(bash, ['-c', `
adb() {
  printf 'ADB_CALL:%s\\n' "$*" >&2
  if [[ "$*" == *ro.kernel.qemu ]]; then printf '%s\\n' "$WP33_TEST_QEMU";
  elif [[ "$*" == *'emu avd name' ]]; then printf '%s\\nOK\\n' "$WP33_TEST_AVD"; fi
}
export -f adb
bash scripts/run-wp32-isolated-gate.sh
`], { encoding: 'utf8', env: { ...process.env, WP32_TARGET: 'wp33-native-startup',
      ANDROID_SERIAL: input.serial, WP33_TEST_QEMU: input.qemu, WP33_TEST_AVD: input.avd } });
    assert.equal(result.status, 2, result.stderr);
    assert.doesNotMatch(result.stderr, /uninstall|install|pm clear|settings|locksettings|screencap|uiautomator|logcat|connectivity|KEYCODE/);
    if (input.serial === 'physical-phone') assert.doesNotMatch(result.stderr, /ADB_CALL/);
  }
});
