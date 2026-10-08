const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync, execFileSync} = require('node:child_process');
const {test} = require('node:test');

// Execute the actual workflow receipt code against captured tool output.
// Reverting to the old-only parser or ignoring an additional signer must fail.
const root = path.resolve(__dirname, '..');
for (const workflowPath of ['.github/workflows/android-build.yml', '.github/workflows/wp33-5-06-candidate.yml']) {
  assert.ok(fs.existsSync(path.join(root, workflowPath)), 'Artifact-only candidate verification must exist');
  const workflow = fs.readFileSync(path.join(root, workflowPath), 'utf8').replace(/\r\n/g, '\n');
  const block = workflow.match(/node <<'NODE'\n([\s\S]*?)\n          NODE/);
  assert.ok(block, 'APK verification script exists');
  const script = block[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
  const pin = 'e279124cd9d2cd6d4c191e2644fd71063993e42d13441a46759fa922f16d5965';
  const other = 'a'.repeat(64);
  const source = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();

  function verify(signature, badging = "package: name='com.spendwise.app' versionCode='6' versionName='2.0.0'\n") {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spendwise-signing-test-'));
    try {
      fs.mkdirSync(path.join(dir, 'release'));
      fs.writeFileSync(path.join(dir, 'release/signature.txt'), signature);
      fs.writeFileSync(path.join(dir, 'release/apk-badging.txt'), badging);
      const result = spawnSync(process.execPath, ['-e', script], {
        cwd: dir, encoding: 'utf8',
        env: {...process.env, GIT_DIR: path.join(root, '.git'), APK_VERSION: '2.0.0', APK_CODE: '6', GITHUB_RUN_ID: 'fixture-run'},
      });
      const receiptPath = path.join(dir, 'release/build-receipt.json');
      return {...result, receipt: fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : undefined};
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  }

  for (const [name, output] of [
    ['SDK37 V2 Signer output', `Verified using v2 scheme (APK Signature Scheme v2): true\nV2 Signer: certificate SHA-256 digest: ${pin}\n`],
    ['older Signer #1 output', `Signer #1 certificate SHA-256 digest: ${pin}\n`],
    ['CRLF and uppercase digest', `V2 Signer: certificate SHA-256 digest: ${pin.toUpperCase()}\r\n`],
    ['repeated same identity across schemes', `Signer #1 certificate SHA-256 digest: ${pin}\nV2 Signer: certificate SHA-256 digest: ${pin}\n`],
  ]) {
    test(`${workflowPath}: writes accurate provenance for ${name}`, () => {
      const result = verify(output);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.receipt, {package: 'com.spendwise.app', versionName: '2.0.0', versionCode: 6, source, signingCertificateSha256: pin, runId: 'fixture-run'});
    });
  }

  for (const [name, output] of [
    ['missing signer', 'Verified using v2 scheme (APK Signature Scheme v2): true\n'],
    ['different certificate', `V2 Signer: certificate SHA-256 digest: ${other}\n`],
    ['additional unexpected signer', `Signer #1 certificate SHA-256 digest: ${pin}\nSigner #2 certificate SHA-256 digest: ${other}\n`],
    ['different scheme identity', `Signer #1 certificate SHA-256 digest: ${pin}\nV2 Signer: certificate SHA-256 digest: ${other}\n`],
    ['truncated digest', `V2 Signer: certificate SHA-256 digest: ${pin.slice(0, 63)}\n`],
  ]) {
    test(`${workflowPath}: rejects ${name} without writing a receipt`, () => {
      const result = verify(output);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /APK signing identity differs/);
      assert.equal(result.receipt, undefined);
    });
  }

  test(`${workflowPath}: rejects a version mismatch before writing a receipt`, () => {
    const result = verify(`Signer #1 certificate SHA-256 digest: ${pin}\n`, "package: name='com.spendwise.app' versionCode='5' versionName='1.4.0'\n");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /APK package\/version mismatch/);
    assert.equal(result.receipt, undefined);
  });
}
