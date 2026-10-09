import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/wp33-5-06-candidate.yml', 'utf8');
const runner = readFileSync('scripts/wp33-5-06-fileprovider-instrumentation.sh', 'utf8');
const build = readFileSync('android/app/build.gradle', 'utf8');
const providerTest = readFileSync('android/app/src/androidTest/java/com/spendwise/app/FileProviderBoundaryTest.java', 'utf8');

test('API36 FileProvider instrumentation is an independent debug-only job', () => {
  assert.match(workflow, /fileprovider-api36-instrumentation:/);
  const job = workflow.slice(workflow.indexOf('fileprovider-api36-instrumentation:'));
  assert.match(job, /api-level: 36/);
  assert.match(job, /avd-name: wp33-fileprovider-api36/);
  assert.match(job, /scripts\/wp33-5-06-fileprovider-instrumentation\.sh/);
  assert.match(job, /if: always\(\)/);
  assert.match(job, /android-fileprovider-api36/);
  assert.match(runner, /TEST-\*\.xml/);
  assert.match(job, /path: artifacts\/android-fileprovider-api36\//);
  assert.match(runner, /logcat\.txt/);
  assert.doesNotMatch(job, /SPENDWISE_KEYSTORE|assembleRelease|signed-candidate/);
});

test('instrumentation runner guards a disposable synthetic API36 AVD before Gradle can install', () => {
  assert.match(runner, /WP36_ALLOW_EMULATOR_MUTATION=1/);
  assert.match(runner, /emulator-/);
  assert.match(runner, /ro\.kernel\.qemu/);
  assert.match(runner, /ro\.build\.version\.sdk/);
  assert.match(runner, /emu avd name/);
  assert.match(runner, /wp33-fileprovider-api36/);
  assert.match(runner, /connectedDebugAndroidTest/);
  assert.match(runner, /logcat -d/);
  assert.match(runner, /androidTest-results/);
});

test('native provider instrumentation has AndroidX runner dependencies and real boundary assertions', () => {
  assert.match(build, /testInstrumentationRunner\s+"androidx\.test\.runner\.AndroidJUnitRunner"/);
  assert.match(build, /androidTestImplementation\s+"androidx\.test\.ext:junit:/);
  assert.match(build, /androidTestImplementation\s+"androidx\.test\.espresso:espresso-core:/);
  assert.match(providerTest, /shareCacheAndCameraPicturesProduceFileProviderUris/);
  assert.match(providerTest, /privateDatabaseSharedRootCacheSiblingsAndTraversalAreDenied/);
  assert.match(providerTest, /symlinkInsideShareDirectoryCannotExposeItsSiblingTarget/);
});
