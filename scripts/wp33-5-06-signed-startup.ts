import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export type GateEnvironment = Record<string, string | undefined>;
export type AdbReader = (args: string[]) => string;

const PACKAGE_ID = 'com.spendwise.app';
const EXPECTED_CERT = 'e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965';
const BASELINE7_SHA = '27736147ad2ab6b22a706914ef2853e46b587be58a70e714861cae374cf08fa1';
const BASELINE7_SOURCE = '3ea40df0221a20e7c722e1d662bc5bae0c5e0370';
const BASELINE7_BASE = '3423e60e4264a23b56d58b6341c5d2bfa59c0ce1';
const BASELINE7_RUN_ID = '37365477604';
const BASELINE7_ARTIFACT_ID = '11367974300';
const BASELINE_SHA = 'e1552b48e07b17e845bbd8274c2a6ac3d56a91a7bc2b9de3088cbed88c5311ca';
const BASELINE_SOURCE = 'ae32af7ebe2bdbfd2aa48bf11046bdddeac51a50';
const GENERIC_FATAL = /FATAL EXCEPTION|Fatal signal|Fatal Java exception/i;
const SPENDWISE_FATAL = /Force finishing activity com\.spendwise\.app|Process com\.spendwise\.app \(pid \d+\) has died/i;

function requireValue(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`Missing required signed-startup setting: ${name}`);
  return value.trim();
}

export function assertSafeSyntheticTarget(env: GateEnvironment, readAdb: AdbReader): { serial: string; avd: string } {
  if (env.WP36_ALLOW_EMULATOR_MUTATION !== '1') {
    throw new Error('Set WP36_ALLOW_EMULATOR_MUTATION=1 explicitly before any signed-startup emulator operation.');
  }
  const serial = requireValue(env.ANDROID_SERIAL, 'ANDROID_SERIAL');
  if (!/^emulator-\d+$/.test(serial)) {
    throw new Error(`Refusing device ${serial}: signed-startup mutations require an emulator-* serial.`);
  }

  const expectedAvd = requireValue(env.WP36_EXPECTED_AVD, 'WP36_EXPECTED_AVD');
  if (expectedAvd !== 'wp33-signed-startup-api36') {
    throw new Error(`WP36_EXPECTED_AVD must be wp33-signed-startup-api36, got ${expectedAvd}.`);
  }
  const state = readAdb(['get-state']).trim();
  if (state !== 'device') throw new Error(`ADB target ${serial} is not ready (state: ${state || 'empty'}).`);

  const qemu = readAdb(['shell', 'getprop', 'ro.kernel.qemu']).trim();
  if (qemu !== '1') throw new Error(`Refusing non-synthetic target ${serial}: ro.kernel.qemu=${qemu || 'empty'}.`);

  const api = readAdb(['shell', 'getprop', 'ro.build.version.sdk']).trim();
  if (api !== '36') throw new Error(`Signed-startup gate requires Android API36, got API${api || 'unknown'}.`);

  const avd = readAdb(['emu', 'avd', 'name']).split(/\r?\n/, 1)[0].trim();
  if (avd !== expectedAvd) {
    throw new Error(`Refusing AVD ${avd || 'unknown'}; only ${expectedAvd} is allowed.`);
  }
  return { serial, avd };
}

export function assertStablePid(samples: string[]): string {
  const pids = samples.map((value) => value.trim());
  if (pids.some((pid) => !/^\d+$/.test(pid))) throw new Error(`App PID missing during stable checkpoint: ${pids.join(',')}`);
  if (new Set(pids).size !== 1) throw new Error(`App restart loop suspected: PID changed during checkpoint (${pids.join(' -> ')}).`);
  return pids[0];
}

export function assertCleanAppLog(log: string): void {
  const lines = log.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    if (SPENDWISE_FATAL.test(lines[index])) {
      throw new Error(`Signed release startup crash/fatal marker detected: ${lines[index]}`);
    }
    if (/Fatal signal/i.test(lines[index]) && /\(com\.spendwise\.app\)/i.test(lines[index])) {
      throw new Error(`Signed release startup crash/fatal marker detected: ${lines[index]}`);
    }
    if (GENERIC_FATAL.test(lines[index])) {
      const processContext = lines.slice(index, index + 12).join('\n');
      if (/Process:\s*com\.spendwise\.app\b/i.test(processContext)) {
        throw new Error(`Signed release startup crash/fatal marker detected: ${lines[index]}`);
      }
    }
  }
}

function run(command: string, args: string[], label: string, env: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync(command, args, { encoding: 'utf8', env, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`${label} failed (${result.status}): ${detail}`);
  }
  return result.stdout ?? '';
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function apkContract(apk: string, buildTools: string, expectedCode: string, expectedName: string): { sha256: string; certificate: string } {
  if (!existsSync(apk)) throw new Error(`APK not found: ${apk}`);
  const signer = run(path.join(buildTools, 'apksigner'), ['verify', '--verbose', '--print-certs', apk], 'apksigner verification');
  const certificates = [...signer.matchAll(/certificate SHA-256 digest: ([a-fA-F0-9]{64})/g)].map((match) => match[1].toLowerCase());
  if (!certificates.length || certificates.some((value) => value !== EXPECTED_CERT)) {
    throw new Error(`APK signer mismatch; expected ${EXPECTED_CERT}, got ${certificates.join(',') || 'none'}.`);
  }
  const badging = run(path.join(buildTools, 'aapt'), ['dump', 'badging', apk], 'APK metadata inspection');
  const match = badging.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m);
  if (!match || match[1] !== PACKAGE_ID || match[2] !== expectedCode || match[3] !== expectedName) {
    throw new Error(`APK package/version mismatch for ${apk}; expected ${PACKAGE_ID} ${expectedName}/${expectedCode}.`);
  }
  return { sha256: sha256(apk), certificate: certificates[0] };
}

function adb(serial: string, args: string[]): string {
  return run('adb', ['-s', serial, ...args], `adb ${args.join(' ')}`);
}

function maestro(flow: string, artifactRoot: string): void {
  const name = path.basename(flow, '.yaml');
  const output = path.join(artifactRoot, 'maestro', name);
  mkdirSync(output, { recursive: true });
  run('maestro', [
    'test', '--config=.maestro/config.yaml', '--format=junit',
    `--output=${path.join(output, 'report.xml')}`,
    `--test-output-dir=${path.join(output, 'artifacts')}`,
    `--debug-output=${path.join(output, 'debug')}`, flow,
  ], `Maestro flow ${flow}`);
}

function requireActivityForeground(serial: string): void {
  const activity = adb(serial, ['shell', 'dumpsys', 'activity', 'activities']);
  if (!/mResumedActivity[^\n]*com\.spendwise\.app\/[^\s}]*MainActivity|topResumedActivity[^\n]*com\.spendwise\.app\/[^\s}]*MainActivity/i.test(activity)) {
    throw new Error(`SpendWise MainActivity is not resumed:\n${activity.slice(0, 1200)}`);
  }
}

function samplePid(serial: string): string {
  return adb(serial, ['shell', 'pidof', PACKAGE_ID]).trim();
}

function assertProcessAndUi(serial: string, artifactRoot: string, label: string): string {
  requireActivityForeground(serial);
  const samples = [samplePid(serial)];
  for (let index = 0; index < 2; index++) {
    run('node', ['-e', 'setTimeout(() => {}, 1000)'], 'checkpoint interval');
    samples.push(samplePid(serial));
  }
  const pid = assertStablePid(samples);
  const log = adb(serial, ['logcat', '-d', '-t', '2500']);
  assertCleanAppLog(log);

  const safeLabel = label.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const directory = path.join(artifactRoot, safeLabel);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, 'pid.txt'), `${pid}\n`);
  writeFileSync(path.join(directory, 'activity.txt'), adb(serial, ['shell', 'dumpsys', 'activity', 'activities']));
  writeFileSync(path.join(directory, 'logcat.txt'), log);
  const display = adb(serial, ['shell', 'dumpsys', 'window', 'displays']);
  writeFileSync(path.join(directory, 'display.txt'), display);
  writeFileSync(path.join(directory, 'uimode.txt'), adb(serial, ['shell', 'dumpsys', 'uimode']));
  adb(serial, ['shell', 'uiautomator', 'dump', '/sdcard/wp33-5-06-checkpoint.xml']);
  writeFileSync(path.join(directory, 'window.xml'), adb(serial, ['exec-out', 'cat', '/sdcard/wp33-5-06-checkpoint.xml']));
  const screenshot = spawnSync('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], { env: process.env, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (screenshot.error || screenshot.status !== 0 || !screenshot.stdout?.length) {
    throw new Error(`Could not capture signed-startup checkpoint screenshot: ${screenshot.error?.message ?? screenshot.stderr ?? 'empty image'}`);
  }
  writeFileSync(path.join(directory, 'screen.png'), screenshot.stdout);
  return pid;
}

function assertInstalledVersion(serial: string, expectedCode: string): string {
  const dump = adb(serial, ['shell', 'dumpsys', 'package', PACKAGE_ID]);
  const version = dump.match(/versionCode=(\d+)/)?.[1];
  if (version !== expectedCode) throw new Error(`Installed version receipt mismatch: expected ${expectedCode}, got ${version ?? 'unknown'}.`);
  if (!dump.includes('codePath=/data/app/')) throw new Error('Installed package receipt has no application code path.');
  return dump;
}

export function parseDisplayRotation(display: string): number | undefined {
  const named = display.match(/mRotation\s*=\s*ROTATION_(UP|LEFT|DOWN|RIGHT|0|90|180|270)(?:\s+\((\d)\))?/i);
  if (named) {
    if (named[2] !== undefined) return Number(named[2]);
    const rotation = named[1].toUpperCase();
    const aliases: Record<string, number> = { UP: 0, LEFT: 1, DOWN: 2, RIGHT: 3, '0': 0, '90': 1, '180': 2, '270': 3 };
    return aliases[rotation];
  }
  const numeric = display.match(/mCurrentRotation\s*=\s*(\d+)|\brotation\s*=\s*(\d+)/i);
  const observed = numeric?.[1] ?? numeric?.[2];
  if (observed === undefined) return undefined;
  const degrees = Number(observed);
  return degrees <= 3 ? degrees : degrees === 90 ? 1 : degrees === 180 ? 2 : degrees === 270 ? 3 : undefined;
}

export function waitForDisplayRotation(
  readDisplay: () => string,
  expected: number,
  pause: (milliseconds: number) => void = (milliseconds) => run('node', ['-e', `setTimeout(() => {}, ${milliseconds})`], 'wait for display rotation'),
  maxAttempts = 20,
): string {
  let display = '';
  let observed: number | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    display = readDisplay();
    observed = parseDisplayRotation(display);
    if (observed === expected) return display;
    if (attempt + 1 < maxAttempts) pause(250);
  }
  throw new Error(`Display did not reach rotation ${expected}; observed ${observed ?? 'unknown'} after ${maxAttempts} checks.`);
}

function assertRotation(serial: string, expected: number): string {
  return waitForDisplayRotation(() => adb(serial, ['shell', 'dumpsys', 'window', 'displays']), expected);
}

function modeFlow(mode: 'LIGHT' | 'DARK' | 'SYSTEM', stage: 'set' | 'verify'): string {
  return `.maestro/wp33-5-06/${stage}-${mode.toLowerCase()}.yaml`;
}

function runModeCycle(serial: string, artifactRoot: string, mode: 'LIGHT' | 'DARK' | 'SYSTEM'): void {
  maestro(modeFlow(mode, 'set'), artifactRoot);
  assertProcessAndUi(serial, artifactRoot, `${mode}-selected`);

  adb(serial, ['shell', 'am', 'force-stop', PACKAGE_ID]);
  adb(serial, ['logcat', '-c']);
  maestro(modeFlow(mode, 'verify'), artifactRoot);
  assertProcessAndUi(serial, artifactRoot, `${mode}-cold-relaunch`);

  adb(serial, ['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
  run('node', ['-e', 'setTimeout(() => {}, 1000)'], 'background interval');
  maestro('.maestro/wp33-5-06/background-resume.yaml', artifactRoot);
  assertProcessAndUi(serial, artifactRoot, `${mode}-background-resume`);

  if (mode === 'SYSTEM') {
    adb(serial, ['shell', 'cmd', 'uimode', 'night', 'yes']);
    maestro('.maestro/wp33-5-06/assert-home.yaml', artifactRoot);
    assertProcessAndUi(serial, artifactRoot, 'system-night-on');
    adb(serial, ['shell', 'cmd', 'uimode', 'night', 'no']);
    maestro('.maestro/wp33-5-06/assert-home.yaml', artifactRoot);
    assertProcessAndUi(serial, artifactRoot, 'system-night-off');
    adb(serial, ['shell', 'cmd', 'uimode', 'night', 'auto']);
  }

  adb(serial, ['shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0']);
  adb(serial, ['shell', 'settings', 'put', 'system', 'user_rotation', '0']);
  assertRotation(serial, 0);
  adb(serial, ['shell', 'settings', 'put', 'system', 'user_rotation', '1']);
  const landscape = assertRotation(serial, 1);
  writeFileSync(path.join(artifactRoot, `${mode.toLowerCase()}-landscape.txt`), landscape);
  maestro('.maestro/wp33-5-06/assert-home.yaml', artifactRoot);
  assertProcessAndUi(serial, artifactRoot, `${mode}-landscape`);
  adb(serial, ['shell', 'settings', 'put', 'system', 'user_rotation', '0']);
  assertRotation(serial, 0);
  maestro('.maestro/wp33-5-06/assert-home.yaml', artifactRoot);
  assertProcessAndUi(serial, artifactRoot, `${mode}-portrait-restored`);
}

function captureFinalAccessibility(serial: string, artifactRoot: string): void {
  adb(serial, ['shell', 'uiautomator', 'dump', '/sdcard/wp33-5-06-window.xml']);
  writeFileSync(path.join(artifactRoot, 'final-window.xml'), adb(serial, ['exec-out', 'cat', '/sdcard/wp33-5-06-window.xml']));
  writeFileSync(path.join(artifactRoot, 'boot-id.txt'), adb(serial, ['shell', 'cat', '/proc/sys/kernel/random/boot_id']));
  writeFileSync(path.join(artifactRoot, 'uptime.txt'), adb(serial, ['shell', 'cat', '/proc/uptime']));
  writeFileSync(path.join(artifactRoot, 'api-runtime.txt'), JSON.stringify({
    api: adb(serial, ['shell', 'getprop', 'ro.build.version.sdk']).trim(),
    build: adb(serial, ['shell', 'getprop', 'ro.build.fingerprint']).trim(),
    avd: adb(serial, ['emu', 'avd', 'name']).split(/\r?\n/, 1)[0].trim(),
    pid: samplePid(serial),
  }, null, 2) + '\n');
}

function verifyBaselineReceipt(apk: string, buildTools: string): void {
  const receipt = apkContract(apk, buildTools, '8', '2.0.2');
  if (receipt.sha256 !== BASELINE_SHA) {
    throw new Error(`Code-8 baseline APK SHA mismatch: expected ${BASELINE_SHA}, got ${receipt.sha256}.`);
  }
}

function verifyBaseline7Receipt(apk: string, buildTools: string): { sha256: string; certificate: string } {
  const receipt = apkContract(apk, buildTools, '7', '2.0.1');
  if (receipt.sha256 !== BASELINE7_SHA) {
    throw new Error(`Code-7 baseline APK SHA mismatch: expected ${BASELINE7_SHA}, got ${receipt.sha256}.`);
  }
  return receipt;
}

let guardedTarget: { serial: string; avd: string } | undefined;
let activeArtifactRoot: string | undefined;

function captureFailureEvidence(error: unknown): void {
  if (!guardedTarget || !activeArtifactRoot) return;
  const root = path.join(activeArtifactRoot, 'failure');
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, 'failure.txt'), `${(error as Error)?.stack ?? String(error)}\n`);
    writeFileSync(path.join(root, 'activity.txt'), adb(guardedTarget.serial, ['shell', 'dumpsys', 'activity', 'activities']));
    writeFileSync(path.join(root, 'package.txt'), adb(guardedTarget.serial, ['shell', 'dumpsys', 'package', PACKAGE_ID]));
    writeFileSync(path.join(root, 'logcat.txt'), adb(guardedTarget.serial, ['logcat', '-d', '-t', '8000']));
    const screenshot = spawnSync('adb', ['-s', guardedTarget.serial, 'exec-out', 'screencap', '-p'], { env: process.env, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    if (!screenshot.error && screenshot.status === 0 && screenshot.stdout?.length) writeFileSync(path.join(root, 'screen.png'), screenshot.stdout);
    adb(guardedTarget.serial, ['shell', 'uiautomator', 'dump', '/sdcard/wp33-5-06-failure.xml']);
    writeFileSync(path.join(root, 'window.xml'), adb(guardedTarget.serial, ['exec-out', 'cat', '/sdcard/wp33-5-06-failure.xml']));
  } catch (captureError) {
    writeFileSync(path.join(root, 'capture-error.txt'), String(captureError));
  }
}

function main(env: NodeJS.ProcessEnv): void {
  const serial = requireValue(env.ANDROID_SERIAL, 'ANDROID_SERIAL');
  const readAdb: AdbReader = (args) => run('adb', ['-s', serial, ...args], `adb ${args.join(' ')}`);
  const target = assertSafeSyntheticTarget(env, readAdb);
  guardedTarget = target;
  if (process.argv.includes('--preflight')) {
    process.stdout.write(`SIGNED_STARTUP_PREFLIGHT_OK serial=${target.serial} avd=${target.avd} api=36\n`);
    return;
  }

  const currentApk = requireValue(env.WP36_CURRENT_APK, 'WP36_CURRENT_APK');
  const baseline8Apk = requireValue(env.WP36_BASELINE8_APK, 'WP36_BASELINE8_APK');
  const baseline7Apk = requireValue(env.WP36_BASELINE7_APK, 'WP36_BASELINE7_APK');
  const buildTools = requireValue(env.WP36_BUILD_TOOLS, 'WP36_BUILD_TOOLS');
  const artifactRoot = path.resolve(requireValue(env.WP36_ARTIFACT_ROOT, 'WP36_ARTIFACT_ROOT'));
  mkdirSync(artifactRoot, { recursive: true });
  activeArtifactRoot = artifactRoot;
  const currentContract = apkContract(currentApk, buildTools, '9', '2.0.2');
  verifyBaselineReceipt(baseline8Apk, buildTools);
  const baseline7Contract = verifyBaseline7Receipt(baseline7Apk, buildTools);
  if (currentContract.certificate !== EXPECTED_CERT) throw new Error('Candidate signing identity is not the permanent release key.');
  if (baseline7Contract.certificate !== currentContract.certificate) throw new Error('Signed code-7 baseline and candidate do not have the same permanent signing identity.');
  writeFileSync(path.join(artifactRoot, 'runtime-start.json'), JSON.stringify({
    api: adb(target.serial, ['shell', 'getprop', 'ro.build.version.sdk']).trim(),
    build: adb(target.serial, ['shell', 'getprop', 'ro.build.fingerprint']).trim(),
    avd: target.avd,
    bootId: adb(target.serial, ['shell', 'cat', '/proc/sys/kernel/random/boot_id']).trim(),
    uptime: adb(target.serial, ['shell', 'cat', '/proc/uptime']).trim(),
  }, null, 2) + '\n');

  const existing = adb(target.serial, ['shell', 'pm', 'path', PACKAGE_ID]).trim();
  if (existing) throw new Error(`Expected a clean synthetic AVD before candidate install, found ${PACKAGE_ID}: ${existing}`);
  adb(target.serial, ['install', currentApk]);
  assertInstalledVersion(target.serial, '9');
  adb(target.serial, ['logcat', '-c']);
  maestro('.maestro/wp33-5-06/clean-first-run.yaml', artifactRoot);
  assertProcessAndUi(target.serial, artifactRoot, 'candidate-clean-first-run-home');

  for (const mode of ['LIGHT', 'DARK', 'SYSTEM'] as const) runModeCycle(target.serial, artifactRoot, mode);

  maestro('.maestro/wp33-5-06/seed-populated-home.yaml', artifactRoot);
  maestro('.maestro/wp33-5-06/seed-populated-expense.yaml', artifactRoot);
  assertProcessAndUi(target.serial, artifactRoot, 'candidate-populated-before-same-build-upgrade');
  adb(target.serial, ['install', '-r', currentApk]);
  assertInstalledVersion(target.serial, '9');
  maestro('.maestro/wp33-5-06/assert-populated-after-same-build-upgrade.yaml', artifactRoot);
  assertProcessAndUi(target.serial, artifactRoot, 'candidate-populated-after-same-build-upgrade');

  // Seed with the retained signed code-7 release, then carry the same package data
  // through actual code-8 and code-9 install-r updates. Code 8 is never launched.
  adb(target.serial, ['uninstall', PACKAGE_ID]);
  adb(target.serial, ['install', baseline7Apk]);
  const code7Installed = assertInstalledVersion(target.serial, '7');
  writeFileSync(path.join(artifactRoot, 'api36-code7-baseline-install.txt'), code7Installed);
  adb(target.serial, ['logcat', '-c']);
  maestro('.maestro/wp33-5-06/code7-seed.yaml', artifactRoot);
  assertProcessAndUi(target.serial, artifactRoot, 'code7-seeded-ledger');
  maestro('.maestro/wp33-5-06/verify-code7-seed.yaml', artifactRoot);
  assertProcessAndUi(target.serial, artifactRoot, 'code7-seeded-ledger-cold-relaunch');

  adb(target.serial, ['install', '-r', baseline8Apk]);
  const code8Installed = assertInstalledVersion(target.serial, '8');
  writeFileSync(path.join(artifactRoot, 'api36-code7-to-code8-install-r.json'), JSON.stringify({
    package: PACKAGE_ID,
    baseline7: { versionName: '2.0.1', versionCode: 7, sha256: BASELINE7_SHA, source: BASELINE7_SOURCE, baseMainCommit: BASELINE7_BASE, runId: BASELINE7_RUN_ID, artifactId: BASELINE7_ARTIFACT_ID, dataSeeded: true },
    candidate8: { versionName: '2.0.2', versionCode: 8, sha256: BASELINE_SHA, source: BASELINE_SOURCE, installedWithReplace: true, launched: false },
    androidApi: 36,
    avd: target.avd,
    fixtureSeededBeforeUpdate: true,
    note: 'The actual signed code-8 APK is installed over the populated code-7 package but is not launched because its known Android16 attachBaseContext crash would interrupt the owner phone path.',
    installedPackage: code8Installed,
  }, null, 2) + '\n');
  adb(target.serial, ['install', '-r', currentApk]);
  const candidateInstalled = assertInstalledVersion(target.serial, '9');
  const upgradeReceiptPath = path.join(artifactRoot, 'api36-code7-to-code8-to-code9-install-r.json');
  writeFileSync(upgradeReceiptPath, JSON.stringify({
    package: PACKAGE_ID,
    baseline7: { versionName: '2.0.1', versionCode: 7, sha256: BASELINE7_SHA, source: BASELINE7_SOURCE, baseMainCommit: BASELINE7_BASE, runId: BASELINE7_RUN_ID, artifactId: BASELINE7_ARTIFACT_ID, launched: true, dataSeeded: true },
    intermediate8: { versionName: '2.0.2', versionCode: 8, sha256: BASELINE_SHA, source: BASELINE_SOURCE, runId: '37809691011', artifactId: '11564128407', installReplace: true, launched: false },
    candidate9: { versionName: '2.0.2', versionCode: 9, sha256: currentContract.sha256, source: env.GITHUB_SHA, signingCertificateSha256: currentContract.certificate, installReplace: true, launched: true },
    androidApi: 36,
    avd: target.avd,
    verificationStatus: 'pending-code9-ui-read',
    installedPackage: candidateInstalled,
  }, null, 2) + '\n');
  adb(target.serial, ['logcat', '-c']);
  maestro('.maestro/wp33-5-06/verify-code7-data-after-code9.yaml', artifactRoot);
  assertProcessAndUi(target.serial, artifactRoot, 'code7-populated-ledger-after-code9-upgrade');
  writeFileSync(upgradeReceiptPath, JSON.stringify({
    package: PACKAGE_ID,
    baseline7: { versionName: '2.0.1', versionCode: 7, sha256: BASELINE7_SHA, source: BASELINE7_SOURCE, baseMainCommit: BASELINE7_BASE, runId: BASELINE7_RUN_ID, artifactId: BASELINE7_ARTIFACT_ID, launched: true, dataSeeded: true },
    intermediate8: { versionName: '2.0.2', versionCode: 8, sha256: BASELINE_SHA, source: BASELINE_SOURCE, runId: '37809691011', artifactId: '11564128407', installReplace: true, launched: false },
    candidate9: { versionName: '2.0.2', versionCode: 9, sha256: currentContract.sha256, source: env.GITHUB_SHA, signingCertificateSha256: currentContract.certificate, installReplace: true, launched: true },
    androidApi: 36,
    avd: target.avd,
    verificationStatus: 'passed',
    populatedDataPreservedAcross7To9: true,
    retainedBudget: '1250',
    retainedExpense: 'WP33.5-06 signed startup receipt',
    productionLedgerReadAfterUpgrade: true,
    note: 'The code-9 release reopened and displayed the exact code-7 seeded financial records after Android accepted both same-certificate install-r updates. This demonstrates the production encrypted-storage read path functionally; the gate does not export private app database or Keystore bytes.',
    installedPackage: candidateInstalled,
  }, null, 2) + '\n');
  captureFinalAccessibility(target.serial, artifactRoot);
  process.stdout.write(`SIGNED_STARTUP_API36_PASS serial=${target.serial} avd=${target.avd} upgrade=populated-code7->install-r-code8-unlaunched->install-r-code9-and-read\n`);
}

const invokedFile = process.argv[1]?.replace(/\\/g, '/');
if (invokedFile?.endsWith('/scripts/wp33-5-06-signed-startup.ts') || invokedFile?.endsWith('/wp33-5-06-signed-startup.mjs')) {
  try {
    main(process.env);
  } catch (error) {
    captureFailureEvidence(error);
    process.stderr.write(`SIGNED_STARTUP_API36_FAIL ${(error as Error).stack ?? String(error)}\n`);
    process.exitCode = 1;
  }
}
