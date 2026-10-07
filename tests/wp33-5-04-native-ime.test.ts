import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('WP04 native gate refuses to save when the software keyboard is absent', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wp04-ime-'));
  try {
    const result = spawnSync(process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash', ['-c', `
set -euo pipefail
source scripts/wp33-5-04-native-continuity.sh
adb() { printf 'mInputShown=false\\n'; }
app_is_foreground() { return 0; }
sleep() { :; }
run_flow() { printf '%s\\n' "$1" >> "$RESULT_ROOT/flows.txt"; }
run_wp04_continuity
`], { encoding: 'utf8', env: { ...process.env, RESULT_ROOT: directory.replace(/\\/g, '/') } });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /soft IME was not visibly shown before add Save/);
    assert.deepEqual(readFileSync(path.join(directory, 'flows.txt'), 'utf8').trim().split('\n'), ['wp04-add-ime']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
