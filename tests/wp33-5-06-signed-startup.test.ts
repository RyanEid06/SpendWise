import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { existsSync, readFileSync as readText } from 'node:fs';
import {
  assertCleanAppLog,
  assertCleanInstallTarget,
  parseDisplayRotation,
  assertSafeSyntheticTarget,
  assertStablePid,
  waitForDisplayRotation,
} from '../scripts/wp33-5-06-signed-startup';

const workflow = readFileSync('.github/workflows/wp33-5-06-candidate.yml', 'utf8');
const runner = readFileSync('scripts/wp33-5-06-signed-startup.ts', 'utf8');
const expectedAvd = 'wp33-signed-startup-api36';

test('clean release install accepts absent package without swallowing adb errors', () => {
  const calls: string[][] = [];
  assert.doesNotThrow(() => assertCleanInstallTarget(args => { calls.push(args); return ''; }));
  assert.deepEqual(calls, [['shell', 'pm', 'list', 'packages', '--user', '0', 'com.spendwise.app']]);
  assert.throws(() => assertCleanInstallTarget(() => 'package:com.spendwise.app\n'), /clean synthetic AVD/);
  assert.throws(() => assertCleanInstallTarget(() => 'unexpected package-manager output'), /clean synthetic AVD/);
  const transportFailure = new Error('adb offline');
  assert.throws(() => assertCleanInstallTarget(() => { throw transportFailure; }), error => error === transportFailure);
});

test('code7 workflow receipt accepts the retained artifact and rejects changed provenance', () => {
  const command = workflow.split('\n').find(line => line.includes("throw Error('actual code-7 artifact receipt mismatch')"));
  assert.ok(command, 'the retained artifact must have a strict receipt check');
  const script = command.match(/node -e "(.*)" "\$receipt"/)?.[1];
  assert.ok(script);
  // Exact non-secret receipt retained in artifact 11367974300, run 37365477604.
  const receipt = {
    source: '3ea40df0221a20e7c722e1d662bc5bae0c5e0370',
    baseMainCommit: '3423e60e4264a23b56d58b6341c5d2bfa59c0ce1',
    sourceChanges: ['version.json only'],
    package: 'com.spendwise.app', versionName: '2.0.1', versionCode: 7,
    signingCertificateSha256: 'e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965',
    apkSha256: '27736147ad2ab6b22a706914ef2853e46b587be58a70e714861cae374cf08fa1',
    runId: '37365477604',
  };
  const verify = (value: unknown) => runInNewContext(script, {
    require: () => value, process: { argv: ['node', 'receipt.json'] },
  });
  assert.doesNotThrow(() => verify(receipt));
  for (const key of Object.keys(receipt)) {
    assert.throws(() => verify({ ...receipt, [key]: null }), /actual code-7 artifact receipt mismatch/);
  }
  assert.throws(() => verify({ ...receipt, sourceChanges: ['version.json'] }), /receipt mismatch/);
  assert.throws(() => verify({ ...receipt, sourceChanges: ['version.json only', 'other.ts'] }), /receipt mismatch/);
});

function targetEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    WP36_ALLOW_EMULATOR_MUTATION: '1',
    WP36_EXPECTED_AVD: expectedAvd,
    ANDROID_SERIAL: 'emulator-5554',
    ...overrides,
  };
}

test('signed startup target guard never contacts a physical device', () => {
  let calls = 0;
  assert.throws(() => assertSafeSyntheticTarget(targetEnv({ ANDROID_SERIAL: 'R5CT123456A' }), () => {
    calls++;
    return '';
  }), /emulator-/i);
  assert.equal(calls, 0);
});

test('signed startup target guard requires explicit mutation opt-in before adb access', () => {
  let calls = 0;
  assert.throws(() => assertSafeSyntheticTarget(targetEnv({ WP36_ALLOW_EMULATOR_MUTATION: '' }), () => {
    calls++;
    return '';
  }), /explicit.*emulator/i);
  assert.equal(calls, 0);
});

test('signed startup target guard rejects non-qemu and wrong AVD targets before mutations', () => {
  const calls: string[] = [];
  const readOnlyAdb = (args: string[]) => {
    calls.push(args.join(' '));
    if (args.join(' ') === 'get-state') return 'device';
    if (args.join(' ') === 'shell getprop ro.kernel.qemu') return '0';
    throw new Error(`unexpected adb command: ${args.join(' ')}`);
  };
  assert.throws(() => assertSafeSyntheticTarget(targetEnv(), readOnlyAdb), /synthetic.*emulator/i);
  assert.deepEqual(calls, ['get-state', 'shell getprop ro.kernel.qemu']);

  calls.length = 0;
  const wrongAvd = (args: string[]) => {
    calls.push(args.join(' '));
    if (args.join(' ') === 'get-state') return 'device';
    if (args.join(' ') === 'shell getprop ro.kernel.qemu') return '1';
    if (args.join(' ') === 'shell getprop ro.build.version.sdk') return '36';
    if (args.join(' ') === 'emu avd name') return 'personal-emulator\nOK';
    throw new Error(`unexpected adb command: ${args.join(' ')}`);
  };
  assert.throws(() => assertSafeSyntheticTarget(targetEnv(), wrongAvd), new RegExp(expectedAvd));
  assert.deepEqual(calls, ['get-state', 'shell getprop ro.kernel.qemu', 'shell getprop ro.build.version.sdk', 'emu avd name']);
});

test('signed startup target guard requires API36 even on a synthetic emulator', () => {
  const calls: string[] = [];
  const readAdb = (args: string[]) => {
    calls.push(args.join(' '));
    if (args.join(' ') === 'get-state') return 'device';
    if (args.join(' ') === 'shell getprop ro.kernel.qemu') return '1';
    if (args.join(' ') === 'shell getprop ro.build.version.sdk') return '34';
    throw new Error(`unexpected adb command: ${args.join(' ')}`);
  };
  assert.throws(() => assertSafeSyntheticTarget(targetEnv(), readAdb), /requires Android API36/);
  assert.deepEqual(calls, ['get-state', 'shell getprop ro.kernel.qemu', 'shell getprop ro.build.version.sdk']);
});

test('restart-loop detector rejects a process that changes PID inside one stable checkpoint', () => {
  assert.equal(assertStablePid(['413', '413', '413']), '413');
  assert.throws(() => assertStablePid(['413', '418', '421']), /restart loop|PID changed/i);
  assert.throws(() => assertStablePid(['413', '', '413']), /PID missing/i);
});

test('rotation parser accepts Android 16 display dump variants and waits for asynchronous changes', () => {
  assert.equal(parseDisplayRotation('mRotation=ROTATION_0'), 0);
  assert.equal(parseDisplayRotation('mRotation=ROTATION_90 (1)'), 1);
  assert.equal(parseDisplayRotation('mCurrentRotation=1'), 1);
  assert.equal(parseDisplayRotation('rotation=3'), 3);
  assert.equal(parseDisplayRotation('rotation=270'), 3);
  assert.equal(parseDisplayRotation('display rotation pending'), undefined);

  const states = ['mRotation=ROTATION_0', 'mCurrentRotation=0', 'mCurrentRotation=1'];
  let reads = 0;
  let pauses = 0;
  const reached = waitForDisplayRotation(() => states[Math.min(reads++, states.length - 1)], 1, () => { pauses++; }, 4);
  assert.equal(parseDisplayRotation(reached), 1);
  assert.equal(reads, 3);
  assert.equal(pauses, 2);
  assert.throws(() => waitForDisplayRotation(() => 'rotation unavailable', 1, () => {}, 3), /after 3 checks/);
});

test('release crash detector rejects fatal and relaunch signatures', () => {
  assert.doesNotThrow(() => assertCleanAppLog('Displayed com.spendwise.app/.MainActivity'));
  assert.doesNotThrow(() => assertCleanAppLog('I StartupDiagnostics: recovered package (com.spendwise.app) after previous attempt'));
  assert.doesNotThrow(() => assertCleanAppLog('FATAL EXCEPTION: main\nProcess: unrelated.package, PID: 413'));
  assert.throws(() => assertCleanAppLog('FATAL EXCEPTION: main\nProcess: com.spendwise.app, PID: 413'), /fatal|crash/i);
  assert.throws(() => assertCleanAppLog('Fatal signal 11 (SIGSEGV) in tid 413 (com.spendwise.app)'), /fatal|crash/i);
  assert.throws(() => assertCleanAppLog('Process com.spendwise.app (pid 413) has died'), /fatal|crash/i);
});

test('signed startup workflow pins source, version, signer, API36 AVD, and baseline APK bytes', () => {
  assert.match(workflow, /refs\/heads\/codex\/wp33-5-06-honor-startup-fix/);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /test "\$EXPECTED_SOURCE" = "\$GITHUB_SHA"/);
  assert.match(workflow, /test "\$VERSION_CODE" = "9"/);
  assert.match(workflow, /test "\$INSTALLED_CODE" = "8"/);
  assert.match(workflow, /e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965/);
  assert.match(workflow, /11564128407/);
  assert.match(workflow, /37809691011/);
  assert.match(workflow, /e1552b48e07b17e845bbd8274c2a6ac3d56a91a7bc2b9de3088cbed88c5311ca/);
  assert.match(workflow, /api-level: 36/);
  assert.match(workflow, new RegExp(expectedAvd));
  assert.match(workflow, /scripts\/wp33-5-06-signed-startup\.ts/);
  const buildIndex = workflow.indexOf('- name: Build signed release APK');
  const verifyIndex = workflow.indexOf('- name: Verify web app');
  const keyIndex = workflow.indexOf('SPENDWISE_KEYSTORE_BASE64: ${{ secrets.SPENDWISE_KEYSTORE_BASE64 }}', buildIndex);
  assert.ok(verifyIndex >= 0 && verifyIndex < keyIndex && keyIndex < buildIndex + 500, 'release keystore must only be restored in the signing build step after source-controlled verification');
  assert.match(workflow.slice(buildIndex, buildIndex + 900), /trap 'rm -f "\$keystore"' EXIT/);
});

test('signed release flow covers saved appearance modes and real lifecycle transitions', () => {
  for (const mode of ['light', 'dark', 'system']) {
    for (const stage of ['set', 'verify']) {
      const flow = `.maestro/wp33-5-06/${stage}-${mode}.yaml`;
      assert.ok(existsSync(flow), `missing release flow ${flow}`);
      const text = readText(flow, 'utf8');
      assert.match(text, /Open Settings/);
      assert.match(text, /Appearance/);
      assert.match(text, new RegExp(mode, 'i'));
      if (stage === 'verify') {
        assert.equal((text.match(/tapOn: "Appearance"/g) ?? []).length, 2, `${mode} verify flow must collapse options before asserting the persisted row value`);
      }
    }
  }
  assert.match(runner, /am', 'force-stop'/);
  assert.match(runner, /KEYCODE_HOME/);
  assert.match(runner, /settings', 'put', 'system', 'user_rotation'/);
  assert.match(runner, /uiautomator', 'dump', '\/sdcard\/wp33-5-06-checkpoint\.xml'/);
  assert.match(runner, /screencap/);
  assert.match(runner, /dumpsys', 'uimode'/);
  assert.match(runner, /install', '-r', currentApk/);
  assert.match(runner, /productionLedgerReadAfterUpgrade: true/);
});

test('real signed upgrade seeds code 7, installs code 8 without launching, and verifies code 9 data', () => {
  assert.match(workflow, /11367974300/);
  assert.match(workflow, /37365477604/);
  assert.match(workflow, /f083da5fec05d1eec5fae9bf8b1078003da94479/);
  assert.match(workflow, /SpendWise-v2\.0\.1-release/);
  assert.match(workflow, /27736147ad2ab6b22a706914ef2853e46b587be58a70e714861cae374cf08fa1/);
  assert.match(workflow, /3ea40df0221a20e7c722e1d662bc5bae0c5e0370/);
  assert.match(runner, /verifyBaseline7Receipt/);
  const installSeven = runner.indexOf("adb(target.serial, ['install', baseline7Apk])");
  const seedSeven = runner.indexOf("maestro('.maestro/wp33-5-06/code7-seed.yaml'");
  const verifySeven = runner.indexOf("maestro('.maestro/wp33-5-06/verify-code7-seed.yaml'");
  const installEight = runner.indexOf("adb(target.serial, ['install', '-r', baseline8Apk])");
  const installNine = runner.indexOf("adb(target.serial, ['install', '-r', currentApk])", installEight);
  const verifyNine = runner.indexOf("maestro('.maestro/wp33-5-06/verify-code7-data-after-code9.yaml'");
  assert.ok(installSeven >= 0 && installSeven < seedSeven, 'install the actual signed code-7 APK before seeding');
  assert.ok(seedSeven < verifySeven && verifySeven < installEight, 'prove the code-7 fixture is populated before code 8');
  assert.ok(installEight < installNine && installNine < verifyNine, 'install code 8 without launch before installing and launching code 9');
  assert.match(runner.slice(installEight, installNine), /assertInstalledVersion\(target\.serial, '8'\)/);
  assert.match(runner.slice(installEight, installNine), /launched: false/);
  assert.doesNotMatch(runner, /run-as|locksettings|adb root|android-device-pin/);
  const verification = readText('.maestro/wp33-5-06/verify-code7-data-after-code9.yaml', 'utf8');
  const baselineVerification = readText('.maestro/wp33-5-06/verify-code7-seed.yaml', 'utf8');
  const seed = readText('.maestro/wp33-5-06/code7-seed.yaml', 'utf8');
  assert.match(seed, /onboard-current\.yaml/);
  assert.match(seed, /Set Monthly Budget/);
  assert.match(seed, /WP33\.5-06 signed startup receipt/);
  assert.match(baselineVerification, /stopApp/);
  assert.match(verification, /1,250/);
  assert.match(verification, /WP33\.5-06 signed startup receipt/);
  assert.match(runner, /api36-code7-to-code8-to-code9-install-r\.json/);
  assert.match(runner, /verificationStatus: 'pending-code9-ui-read'/);
  assert.match(runner, /verificationStatus: 'passed'/);
  assert.match(runner, /captureFailureEvidence\(error\)/);
});
