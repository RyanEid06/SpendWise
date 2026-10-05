import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertSyntheticEmulator } from '../scripts/wp33/native';

test('native benchmark refuses physical devices and unidentified emulator data', () => {
  for (const input of [
    { serial: 'physical-phone', qemu: '0', avd: 'wp33-synthetic' },
    { serial: 'emulator-5554', qemu: '0', avd: 'wp33-synthetic' },
    { serial: 'emulator-5554', qemu: '1', avd: 'personal-emulator' },
    { serial: '', qemu: '1', avd: 'wp33-synthetic' },
    { serial: 'emulator-5554', qemu: '1', avd: 'wp33' },
  ]) assert.throws(() => assertSyntheticEmulator(input), /SYNTHETIC_EMULATOR_REQUIRED/);
});
test('native benchmark accepts only explicitly named WP33 synthetic emulators', () => {
  assert.doesNotThrow(() => assertSyntheticEmulator({ serial: 'emulator-5554', qemu: '1', avd: 'wp33-synthetic-api35' }));
});
test('native probe is composed after isolated restore and before app-lock mutations, preserving all WP32 flows', () => {
  const runner = readFileSync('scripts/run-wp32-android-e2e.sh', 'utf8');
  assert.ok(runner.indexOf('run-wp33-native-benchmark.sh') > runner.indexOf('run_flow import-v2-full'));
  assert.ok(runner.indexOf('run-wp33-native-benchmark.sh') < runner.indexOf('run_flow app-lock-setup'));
  const workflow = readFileSync('.github/workflows/wp32-e2e.yml', 'utf8');
  assert.match(workflow, /avd-name: wp33-synthetic-api34/);
  assert.match(workflow, /WP33_NATIVE_BENCHMARK: "1"/);
  assert.match(workflow, /esbuild scripts\/wp33\/native.ts/);
  const probe = readFileSync('scripts/wp33/native.ts', 'utf8');
  assert.doesNotMatch(probe, /locksettings|pm', 'clear|set-pin|disableEncryption/);
});
test('native receipt includes source and host-controlled synthetic fixture provenance', () => {
  const probe = readFileSync('scripts/wp33/native.ts', 'utf8');
  assert.match(probe, /revision:.*rev-parse/);
  assert.match(probe, /WP33_NATIVE_FIXTURE/);
  assert.match(probe, /fixture:.*wp32-v2-full/);
  assert.match(probe, /nodeVersion: process\.versions\.node/);
  assert.match(readFileSync('scripts/run-wp32-android-e2e.sh', 'utf8'), /WP33_NATIVE_FIXTURE="wp32-v2-full"/);
});
