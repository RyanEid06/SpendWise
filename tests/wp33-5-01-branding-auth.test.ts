import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const main = readFileSync('src/main.tsx', 'utf8');
const lock = readFileSync('src/screens/LockScreen.tsx', 'utf8');
const startup = readFileSync('src/screens/SecureStartupScreen.tsx', 'utf8');
const logo = readFileSync('src/components/SpendWiseLogo.tsx', 'utf8');
const appShell = readFileSync('src/app/AppShell.tsx', 'utf8');
const homeFrameTiming = readFileSync('src/app/startup/StartupHomeFrameTiming.ts', 'utf8');
const plugin = readFileSync(
  'android/app/src/main/java/com/spendwise/app/SpendWiseSecurityPlugin.java',
  'utf8'
);
const styles = readFileSync('android/app/src/main/res/values/styles.xml', 'utf8');
const nightStyles = readFileSync('android/app/src/main/res/values-night/styles.xml', 'utf8');
const diagnosticsContract = readFileSync('src/services/diagnostics/contract.ts', 'utf8');
const databaseService = readFileSync('src/data/NativeEncryptedDatabaseService.ts', 'utf8');
const version = JSON.parse(readFileSync('version.json', 'utf8')) as {
  versionName: string;
  versionCode: number;
};

test('WP33.5-01 paints privacy-safe branded startup before async security work', () => {
  assert.match(main, /renderSecureStartup\(\);\s*void bootstrap\(\);/);
  assert.match(startup, /data-testid="secure-startup-surface"/);
  assert.match(startup, /<SpendWiseLogo/);
  assert.doesNotMatch(startup, /expense|balance|transaction|budget/i);
  assert.match(main, /renderBootstrapLock\(security\.unlockMode !== 'legacy-native-migration'\)/);
});

test('WP33.5-01 successful authentication keeps secure UI up until protected storage is ready', () => {
  const unlockStart = main.indexOf('const result = await secureSessionService.unlock(credential)');
  const failureGuard = main.indexOf('if (!result.ok) return result;', unlockStart);
  const storageOpen = main.indexOf('await openProtectedStorage(homeFrameTiming)', failureGuard);
  const renderHome = main.indexOf('renderApp(homeFrameTiming)', main.indexOf('async function openProtectedStorage'));
  const storageInit = main.indexOf("measureDiagnostic('storage.init'", main.indexOf('async function openProtectedStorage'));

  assert.ok(unlockStart >= 0);
  assert.ok(failureGuard > unlockStart);
  assert.ok(storageOpen > failureGuard);
  assert.ok(renderHome > storageInit);
  assert.match(lock, /\{busy \? copy\.unlocking : buttonText\}/);
  assert.match(lock, /data-testid="secure-lock-surface"/);
});

test('WP33.5-01 native auto authentication is one-shot and cancellation leaves an Unlock action', () => {
  assert.match(lock, /autoAttempted = useRef\(false\)/);
  assert.match(lock, /autoAttempted\.current = true/);
  assert.match(lock, /if \(!canAutoUnlock \|\| autoAttempted\.current\) return/);
  assert.match(lock, /cancel: 'Authentication was cancelled\.'/);
  assert.match(lock, /generic: 'Authentication failed\. Try again\.'/);
  assert.match(lock, /else \{\s*setError\(messageFor\(result\)\);\s*\}/);
  assert.match(lock, /nativeButton: 'Unlock SpendWise'/);
  assert.match(appShell, /autoUnlock=\{appLock\.securityMode === 'native'\}/);
});

test('WP33.5-01 keeps Android system strong biometric plus device credential authentication', () => {
  assert.match(plugin, /BIOMETRIC_STRONG\s*\|\s*BiometricManager\.Authenticators\.DEVICE_CREDENTIAL/);
  assert.match(plugin, /setDeviceCredentialAllowed\(true\)/);
  assert.match(plugin, /ERROR_USER_CANCELED/);
  assert.doesNotMatch(plugin, /Camera|camera|FaceDetector|face recognition/i);
});

test('WP33.5-01 uses approved light and dark logo assets in-app and launcher assets remain adaptive', () => {
  assert.equal(existsSync('docs/assets/spendwise-logo-light-dark-reference.png'), true);
  assert.equal(existsSync('public/spendwise-logo-light.png'), true);
  assert.equal(existsSync('public/spendwise-logo-dark.png'), true);
  assert.match(logo, /spendwise-logo-light\.png/);
  assert.match(logo, /spendwise-logo-dark\.png/);
  assert.equal(existsSync('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'), true);
  assert.equal(existsSync('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png'), true);
  const adaptive = readFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'utf8');
  assert.match(adaptive, /@color\/ic_launcher_background/);
  assert.match(adaptive, /@mipmap\/ic_launcher_foreground/);
});

test('WP33.5-01 native launch and WebView surfaces have light/dark non-black-transition themes', () => {
  assert.match(styles, /windowSplashScreenAnimatedIcon.*spendwise_splash_icon/);
  assert.match(styles, /postSplashScreenTheme.*AppTheme\.NoActionBar/);
  assert.match(styles, /windowBackground.*spendwise_launch_background/);
  assert.match(nightStyles, /windowBackground.*spendwise_launch_background/);
  assert.equal(existsSync('android/app/src/main/res/drawable-nodpi/spendwise_splash_icon.png'), true);
  assert.equal(existsSync('android/app/src/main/res/drawable-night-nodpi/spendwise_splash_icon.png'), true);
});

test('WP33.5-01 records segmented post-auth startup timing without financial payload fields', () => {
  for (const operation of [
    'security.post_auth_key',
    'security.secret_prime',
    'startup.secure_init',
    'startup.home_frame',
  ]) {
    assert.match(diagnosticsContract, new RegExp(operation.replace('.', '\\.')));
  }
  assert.match(plugin, /postAuthKeyVerifyDurationMs/);
  assert.match(main, /measureDiagnostic\('startup\.secure_init'/);
  assert.match(homeFrameTiming, /operation: 'startup\.home_frame'/);
  assert.match(main, /elapsedSinceAuthentication\(authSucceededAtElapsedRealtimeMs\)/);
  assert.match(appShell, /useStartupHomeFrameTiming\(/);
  assert.match(appShell, /setupMode === null && !appLock\.isLocked && navigation\.currentScreen === 'home'/);
});

test('WP33.5-01 steady-state cleanup optimization only skips duplicate validation after durable completion', () => {
  assert.match(
    databaseService,
    /cleanupAlreadyComplete = journal\?\.phase === 'complete' && !sourceExists/
  );
  assert.match(databaseService, /journal\?\.phase !== 'active' && !cleanupAlreadyComplete/);

  const cleanup = databaseService.slice(databaseService.indexOf('async finalizePlaintextSourceCleanup'));
  assert.match(cleanup, /journal\?\.phase === 'complete' && !sourceExists/);
  assert.ok(
    cleanup.indexOf("journal?.phase === 'complete' && !sourceExists") <
      cleanup.indexOf('isDatabase(ENCRYPTED_DATABASE_NAME)')
  );
  assert.match(cleanup, /assertSpendWiseDatabaseIntegrity\(destination\)/);
});

test('WP06 uses the owner-selected candidate version and upgrade code', () => {
  assert.deepEqual(version, { versionName: '2.0.2', versionCode: 8 });
});
