import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateBackupV2Archive } from '../src/utils/backupV2';

const bash = process.env.WP32_BASH || (process.platform === 'win32'
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const shellPath = (value: string) => value.replace(/\\/g, '/');

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
    printf 'cache/spendwise_backup_v3_full_2026-10-03.swb3\\r\\ncache/spendwise_backup_v3_data_2026-10-03.swb3\\r\\ncache/unrelated.swb3\\r\\n'
  elif [[ "$*" == 'exec-out run-as com.spendwise.app cat cache/spendwise_backup_v3_data_2026-10-03.swb3' ]]; then
    printf 'DATA_ONLY'
  elif [[ "$*" == 'exec-out run-as com.spendwise.app cat cache/spendwise_backup_v3_full_2026-10-03.swb3' ]]; then
    printf 'FULL_WITH_PHOTOS'
  else
    echo "Unexpected adb arguments: $*" >&2
    return 1
  fi
}
extract_backup_prefix spendwise_backup_v3_data_ "$WP32_DATA"
extract_backup_prefix spendwise_backup_v3_full_ "$WP32_FULL"
`], { encoding: 'utf8', env: { ...process.env, WP32_DATA: shellPath(data), WP32_FULL: shellPath(full) } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(data, 'utf8'), 'DATA_ONLY');
    assert.equal(readFileSync(full, 'utf8'), 'FULL_WITH_PHOTOS');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('corruption injection touches every encrypted fixture file and no plaintext media', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp32-corruption-'));
  const calls = path.join(directory, 'calls.txt');
  writeFileSync(calls, '');
  try {
    const result = spawnSync(bash, ['-c', `
set -euo pipefail
APP_ID=com.spendwise.app
source scripts/wp32-android-helpers.sh
adb() {
  if [[ "$*" == 'shell run-as com.spendwise.app find files -type f' ]]; then
    printf 'files/expense-attachments/secure/one.swm1\\r\\nfiles/expense-attachments/secure/eight.swm1\\r\\nfiles/expense-attachments/plain.jpg\\r\\n'
  else
    [[ "$1" == exec-out && "$2" == run-as && "$3" == com.spendwise.app && "$4" == tee ]] || return 1
    printf '%s\\n' "$*" >> "$WP32_CALLS"
    cat > "$WP32_CORRUPT_DIR/\${5##*/}"
  fi
}
corrupt_secure_media_files
`], { encoding: 'utf8', env: { ...process.env, WP32_CALLS: shellPath(calls), WP32_CORRUPT_DIR: shellPath(directory) } });
    assert.equal(result.status, 0, result.stderr);
    const commands = readFileSync(calls, 'utf8');
    assert.match(commands, /one\.swm1/);
    assert.match(commands, /eight\.swm1/);
    assert.doesNotMatch(commands, /plain\.jpg|\r/);
    assert.equal(commands.trim().split('\n').length, 2);
    assert.equal(readFileSync(path.join(directory, 'one.swm1'), 'utf8'), 'WP32_CORRUPTED_CIPHERTEXT');
    assert.equal(readFileSync(path.join(directory, 'eight.swm1'), 'utf8'), 'WP32_CORRUPTED_CIPHERTEXT');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
