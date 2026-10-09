import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateBackupV2Archive } from '../src/utils/backupV2';

const bash = process.env.WP32_BASH || (process.platform === 'win32'
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const shellPath = (value: string) => value.replace(/\\/g, '/');

test('native runner rejects an unknown phase before accessing a device', () => {
  const result = spawnSync(bash, ['-c', `
adb() { echo UNEXPECTED_DEVICE_ACCESS; return 99; }
export -f adb
bash scripts/run-wp32-android-e2e.sh
`], { encoding: 'utf8', env: { ...process.env, WP32_NATIVE_PHASE: 'typo', ANDROID_SERIAL: 'emulator-5554' } });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /Unknown native phase/);
  assert.doesNotMatch(result.stdout, /UNEXPECTED_DEVICE_ACCESS/);
});

for (const failure of ['ui-polish.yaml', 'backup-export-data.yaml']) {
test(`WP34 tail restores prerequisites and propagates failure in ${failure}`, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp34-targeted-tail-'));
  try {
    const result = spawnSync(bash, ['-c', `
adb() {
  case "$*" in
    *'getprop ro.kernel.qemu'*) printf '1\\n' ;;
    *'emu avd name'*) printf 'wp33-synthetic-api34\\nOK\\n' ;;
  esac
}
maestro() {
  local flow
  for flow in "$@"; do :; done
  printf 'FLOW:%s\\n' "$flow"
  if [[ "$flow" == *"$WP32_TEST_FAIL_FLOW" ]]; then return 17; fi
  # The full prefix must not run in this mode.
  if [[ "$flow" == *empty-navigation.yaml ]]; then return 18; fi
}
export -f adb maestro
bash scripts/run-wp32-android-e2e.sh
`], { encoding: 'utf8', env: { ...process.env, WP32_NATIVE_PHASE: 'wp34-tail', WP32_TEST_FAIL_FLOW: failure,
      ANDROID_SERIAL: 'emulator-5554', RESULT_ROOT: shellPath(path.join(directory, 'results')),
      FIXTURE_ROOT: shellPath(path.join(directory, 'fixtures')) } });
    assert.equal(result.status, 17, result.stderr);
    const flows = result.stdout.split(/\r?\n/).filter(line => line.startsWith('FLOW:'));
    assert.deepEqual(flows, [
      'FLOW:.maestro/diagnostic/onboard-current-only.yaml',
      'FLOW:.maestro/diagnostic/restore-v3-full-bootstrap.yaml',
      'FLOW:.maestro/wp34/ui-polish.yaml',
      ...(failure === 'backup-export-data.yaml' ? ['FLOW:.maestro/current/backup-export-data.yaml'] : []),
    ]);
    assert.match(result.stdout, /native phase: wp34-tail/);
    assert.doesNotMatch(result.stdout, /completed successfully/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
}

for (const target of ['backup-export-full', 'wp33-5-04-continuity']) {
test(`isolated ${target} rejects unsafe devices before any mutation`, () => {
  for (const input of [
    { serial: 'physical-phone', qemu: '0', avd: 'wp33-synthetic-api34' },
    { serial: 'emulator-5554', qemu: '0', avd: 'wp33-synthetic-api34' },
    { serial: 'emulator-5554', qemu: '1', avd: 'personal-emulator' },
  ]) {
    const result = spawnSync(bash, ['-c', `
adb() {
  printf 'ADB_CALL:%s\\n' "$*" >&2
  if [[ "$*" == *ro.kernel.qemu ]]; then printf '%s\\n' "$WP32_TEST_QEMU";
  elif [[ "$*" == *'emu avd name' ]]; then printf '%s\\nOK\\n' "$WP32_TEST_AVD";
  else return 91; fi
}
export -f adb
bash scripts/run-wp32-isolated-gate.sh
`], { encoding: 'utf8', env: { ...process.env, WP32_TARGET: target,
      ANDROID_SERIAL: input.serial, WP32_TEST_QEMU: input.qemu, WP32_TEST_AVD: input.avd } });
    assert.equal(result.status, 2, result.stderr);
    assert.doesNotMatch(result.stderr, /uninstall|install|pm clear|settings|locksettings|screencap|uiautomator|logcat|connectivity|KEYCODE/);
    if (input.serial === 'physical-phone') assert.doesNotMatch(result.stderr, /ADB_CALL/);
  }
});
}

function generateFixtures(directory: string) {
  const result = spawnSync(process.execPath, [
    'node_modules/tsx/dist/cli.mjs', 'scripts/wp32-generate-portable-fixtures.ts', directory,
  ], { encoding: 'utf8', env: { ...process.env, WP32_FIXTURE_MONTH: '2027-02' } });
  assert.equal(result.status, 0, result.stderr);
}

test('legacy v1 fixture dates and budget match the month exercised by History', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-v1-'));
  try {
    generateFixtures(directory);
    const fixture = JSON.parse(readFileSync(path.join(directory, 'wp32-v1.json'), 'utf8'));
    assert.equal(fixture.expenses.length, 2);
    for (const expense of fixture.expenses) {
      assert.equal(new Date(expense.date).toISOString().slice(0, 7), '2027-02');
      assert.equal(expense.dateFormatted, '2027-02-01');
    }
    assert.equal(fixture.monthlyBudgets[0].monthKey, '2027-02');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('v2 archives restore into the tested month with representative valid media', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-v2-'));
  try {
    generateFixtures(directory);
    for (const mode of ['data', 'full']) {
      const bytes = readFileSync(path.join(directory, `wp32-v2-${mode}.zip`));
      const { manifest, zip } = await validateBackupV2Archive(new Blob([bytes]));
      assert.equal(new Date(manifest.expenses[0].date).toISOString().slice(0, 7), '2027-02');
      assert.equal(manifest.monthlyBudgets[0].monthKey, '2027-02');
      assert.equal(manifest.mediaIncluded, mode === 'full');
      if (mode === 'full') {
        const media = manifest.attachments[0];
        assert.equal(media.width, 1024);
        assert.equal(media.height, 1024);
        const restored = await zip.file(media.mediaEntry!)!.async('nodebuffer');
        assert.deepEqual(restored, readFileSync('tests/fixtures/media/wp32-photo-01.jpg'));
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('both Android entrypoints parse before any emulator work begins', () => {
  for (const file of ['scripts/run-wp32-android-e2e.sh', 'scripts/run-wp32-backup-restore-targeted.sh']) {
    const result = spawnSync(bash, ['-n', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
});

test('WP32 end-to-end runner rejects a phone before it can clear or uninstall SpendWise', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-device-guard-'));
  const calls = path.join(directory, 'adb-calls.txt');
  try {
    const result = spawnSync(bash, ['-c', `
adb() { printf '%s\\n' "$*" >> "$WP32_ADB_CALLS"; }
export -f adb
bash scripts/run-wp32-android-e2e.sh
`], { encoding: 'utf8', env: { ...process.env, ANDROID_SERIAL: 'HONOR-X9d', WP32_ADB_CALLS: shellPath(calls), RESULT_ROOT: shellPath(path.join(directory, 'results')), FIXTURE_ROOT: shellPath(path.join(directory, 'fixtures')) } });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(existsSync(calls), false);
    assert.match(result.stderr, /emulator|synthetic/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('WP34 splash runner captures light and dark before each launch and restores light', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp34-splash-modes-'));
  const calls = path.join(directory, 'adb-calls.txt');
  try {
    const commands = path.join(directory, 'commands');
    mkdirSync(commands);
    const ffmpeg = path.join(commands, 'ffmpeg');
    writeFileSync(ffmpeg, '#!/usr/bin/env bash\nexit 0\n');
    chmodSync(ffmpeg, 0o755);
    const result = spawnSync(bash, ['-c', `
adb() {
  printf '%s\\n' "$*" >> "$WP32_ADB_CALLS"
  case "$*" in
    *'getprop ro.kernel.qemu'*) printf '1\\n' ;;
    *'emu avd name'*) printf 'wp33-synthetic-api34\\nOK\\n' ;;
  esac
}
maestro() { return 12; }
export -f adb maestro
bash scripts/run-wp32-android-e2e.sh
`], { encoding: 'utf8', env: { ...process.env, ANDROID_SERIAL: 'emulator-5554', PATH: `${shellPath(commands)}:${process.env.PATH}`, WP32_ADB_CALLS: shellPath(calls), RESULT_ROOT: shellPath(path.join(directory, 'results')), FIXTURE_ROOT: shellPath(path.join(directory, 'fixtures')) } });
    assert.equal(result.status, 12, result.stderr);
    const log = readFileSync(calls, 'utf8').split(/\r?\n/);
    const light = log.indexOf('shell cmd uimode night no');
    const dark = log.indexOf('shell cmd uimode night yes');
    const recordings = log.flatMap((line, index) => line.includes('shell screenrecord') ? [index] : []);
    const launches = log.flatMap((line, index) => line.includes('shell am start -n com.spendwise.app/.MainActivity') ? [index] : []);
    const restoreLight = log.indexOf('shell cmd uimode night no', light + 1);
    assert.ok(light >= 0 && dark > light && restoreLight > dark);
    assert.equal(recordings.length, 2);
    assert.equal(launches.length, 2);
    assert.ok(light < recordings[0] && recordings[0] < launches[0]);
    assert.ok(dark < recordings[1] && recordings[1] < launches[1]);
    assert.ok(restoreLight < log.indexOf('shell pm clear com.spendwise.app'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Maestro owns app startup without a preceding host accessibility session', () => {
  for (const file of ['scripts/run-wp32-android-e2e.sh', 'scripts/run-wp32-backup-restore-targeted.sh']) {
    const directory = mkdtempSync(path.join(tmpdir(), 'wp32-launch-'));
    try {
      const commands = path.join(directory, 'commands');
      mkdirSync(commands);
      const ffmpeg = path.join(commands, 'ffmpeg');
      writeFileSync(ffmpeg, '#!/usr/bin/env bash\nexit 0\n');
      chmodSync(ffmpeg, 0o755);
      const result = spawnSync(bash, ['-c', `
set -euo pipefail
host_started=0
adb() {
  if [[ "$*" == *'getprop ro.kernel.qemu' ]]; then printf '1\\n'; fi
  if [[ "$*" == *'emu avd name' ]]; then printf 'wp33-synthetic-api34\\nOK\\n'; fi
  if [[ "$*" == 'shell am start '* ]]; then host_started=1; fi
  if [[ "$*" == 'shell dumpsys activity activities' ]]; then
    printf 'mResumedActivity com.spendwise.app/.MainActivity\\n'
  fi
}
maestro() {
  if [[ "$host_started" != 0 ]]; then
    echo 'Host launched WebView before Maestro attached' >&2
    return 13
  fi
  echo MAESTRO_COLD_LAUNCH_READY
  return 12
}
export -f adb maestro
source "$WP32_ENTRYPOINT"
`], { encoding: 'utf8', env: {
        ...process.env, WP32_ENTRYPOINT: file,
        ANDROID_SERIAL: 'emulator-5554', PATH: `${shellPath(commands)}:${process.env.PATH}`,
        RESULT_ROOT: shellPath(path.join(directory, 'results')).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
        FIXTURE_ROOT: shellPath(path.join(directory, 'fixtures')).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
      } });
      assert.equal(result.status, 12, `${file}: ${result.stderr}`);
      assert.match(result.stdout, /MAESTRO_COLD_LAUNCH_READY/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('backup extraction selects the exact export mode from CRLF adb paths', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-runner-'));
  const data = path.join(directory, 'data.swb3');
  const full = path.join(directory, 'full.swb3');
  try {
    const result = spawnSync(bash, ['-c', `
set -euo pipefail
APP_ID=com.spendwise.app
source scripts/wp32-android-helpers.sh
adb() {
  if [[ "$*" == 'shell run-as com.spendwise.app find cache -type f' ]]; then
    printf 'cache/spendwise_encrypted_backup_full_2026-10-03.swb3\\r\\ncache/spendwise_encrypted_backup_data_2026-10-03.swb3\\r\\ncache/unrelated.swb3\\r\\n'
  elif [[ "$*" == 'exec-out run-as com.spendwise.app cat cache/spendwise_encrypted_backup_data_2026-10-03.swb3' ]]; then
    printf 'DATA_ONLY'
  elif [[ "$*" == 'exec-out run-as com.spendwise.app cat cache/spendwise_encrypted_backup_full_2026-10-03.swb3' ]]; then
    printf 'FULL_WITH_PHOTOS'
  else
    echo "Unexpected adb arguments: $*" >&2
    return 1
  fi
}
extract_backup_prefix spendwise_encrypted_backup_data_ "$WP32_DATA"
extract_backup_prefix spendwise_encrypted_backup_full_ "$WP32_FULL"
`], { encoding: 'utf8', env: { ...process.env, WP32_DATA: shellPath(data), WP32_FULL: shellPath(full) } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(data, 'utf8'), 'DATA_ONLY');
    assert.equal(readFileSync(full, 'utf8'), 'FULL_WITH_PHOTOS');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('corruption injection completes enumeration before bounded writes to every encrypted fixture', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-corruption-'));
  const calls = path.join(directory, 'calls.txt');
  writeFileSync(calls, '');
  try {
    const fakeAdb = path.join(directory, 'adb');
    writeFileSync(fakeAdb, `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == 'shell run-as com.spendwise.app find files -type f' ]]; then
  touch "$WP32_CORRUPT_DIR/enumerating"
  printf 'files/expense-attachments/secure/one.swm1\\r\\nfiles/expense-attachments/secure/eight.swm1\\r\\nfiles/expense-attachments/plain.jpg\\r\\n'
  sleep 0.2
  rm "$WP32_CORRUPT_DIR/enumerating"
elif [[ "$*" == 'exec-out run-as com.spendwise.app tee '* ]]; then
  [[ ! -f "$WP32_CORRUPT_DIR/enumerating" ]] || { echo 'Nested adb while enumeration is open' >&2; exit 70; }
  cat > "$WP32_CORRUPT_DIR/\${5##*/}"
elif [[ "$*" == 'shell run-as com.spendwise.app sh -c '* ]]; then
  [[ ! -f "$WP32_CORRUPT_DIR/enumerating" ]] || { echo 'Nested adb while enumeration is open' >&2; exit 70; }
  printf '%s\\n' "$*" >> "$WP32_CALLS"
  mkdir -p "$WP32_CORRUPT_DIR/files/expense-attachments/secure"
  (cd "$WP32_CORRUPT_DIR"; bash -c "sh -c \${*:6}")
elif [[ "$*" == 'exec-out run-as com.spendwise.app cat '* ]]; then
  cat "$WP32_CORRUPT_DIR/$5"
else
  echo "Unexpected adb operation: $*" >&2
  exit 71
fi
`);
    chmodSync(fakeAdb, 0o755);
    const result = spawnSync(bash, ['-c', `
set -euo pipefail
APP_ID=com.spendwise.app
PATH="$(dirname "$WP32_FAKE_ADB"):$PATH"
source scripts/wp32-android-helpers.sh
corrupt_secure_media_files
`], { encoding: 'utf8', timeout: 5000, env: { ...process.env,
      WP32_FAKE_ADB: shellPath(fakeAdb).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
      WP32_CALLS: shellPath(calls), WP32_CORRUPT_DIR: shellPath(directory),
    } });
    assert.equal(result.status, 0, result.stderr);
    const commands = readFileSync(calls, 'utf8');
    assert.match(commands, /one\.swm1/);
    assert.match(commands, /eight\.swm1/);
    assert.doesNotMatch(commands, /plain\.jpg|\r/);
    assert.equal(commands.trim().split('\n').length, 2);
    assert.equal(readFileSync(path.join(directory, 'files/expense-attachments/secure/one.swm1'), 'utf8'), 'WP32_CORRUPTED_CIPHERTEXT');
    assert.equal(readFileSync(path.join(directory, 'files/expense-attachments/secure/eight.swm1'), 'utf8'), 'WP32_CORRUPTED_CIPHERTEXT');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const failure of ['enumeration', 'missing', 'write-hang', 'verification']) {
  test(`corruption injection fails explicitly on ${failure}`, () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'wp32-corruption-failure-'));
    try {
      const fakeAdb = path.join(directory, 'adb');
      writeFileSync(fakeAdb, `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == 'shell run-as com.spendwise.app find files -type f' ]]; then
  [[ "$WP32_FAILURE" != enumeration ]] || exit 9
  [[ "$WP32_FAILURE" != missing ]] || exit 0
  printf 'files/expense-attachments/secure/one.swm1\\n'
elif [[ "$*" == 'shell run-as com.spendwise.app sh -c '* ]]; then
  [[ "$WP32_FAILURE" != write-hang ]] || exec sleep 60
elif [[ "$*" == 'exec-out run-as com.spendwise.app cat '* ]]; then
  printf 'UNCHANGED_CIPHERTEXT'
else
  exit 71
fi
`);
      chmodSync(fakeAdb, 0o755);
      const result = spawnSync(bash, ['-c', `
set -euo pipefail
APP_ID=com.spendwise.app
PATH="$(dirname "$WP32_FAKE_ADB"):$PATH"
source scripts/wp32-android-helpers.sh
corrupt_secure_media_files
`], { encoding: 'utf8', timeout: 20000, env: { ...process.env,
        WP32_FAILURE: failure,
        WP32_FAKE_ADB: shellPath(fakeAdb).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
      } });
      assert.equal(result.error, undefined, 'helper must terminate before the outer test deadline');
      assert.equal(result.status, 1, result.stderr);
      const expected = {
        enumeration: /Could not enumerate/,
        missing: /No encrypted attachment/,
        'write-hang': /Could not corrupt/,
        verification: /corruption was not verified/,
      }[failure];
      assert.match(result.stdout, expected!);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('upgrade seeds the legacy fixture before enabling Android device credentials', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-upgrade-order-'));
  try {
    const result = spawnSync(bash, ['-c', `
set -euo pipefail
pin=0
seeded=0
adb() {
  if [[ "$*" == 'shell locksettings set-pin 2468' ]]; then pin=1; fi
  if [[ "$*" == 'shell locksettings clear --old 2468' ]]; then pin=0; fi
  if [[ "$1" == install && "$2" == -r ]]; then
    [[ "$pin" == 1 && "$seeded" == 1 ]] || return 34
  fi
}
maestro() {
  if [[ "\${@: -1}" == .maestro/migration/v14-seed.yaml ]]; then
    [[ "$pin" == 0 ]] || { echo 'Device keyguard can obscure the legacy seed' >&2; return 33; }
    seeded=1
  else
    [[ "$pin" == 1 && "$seeded" == 1 ]] || return 35
  fi
}
source scripts/run-wp32-isolated-gate.sh
`], { encoding: 'utf8', env: { ...process.env, WP32_TARGET: 'hardened-upgrade',
      RESULT_ROOT: shellPath(directory).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
    } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /isolated target passed: hardened-upgrade/);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
