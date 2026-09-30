import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CURRENT_LEGAL_VERSION,
  CURRENT_SETUP_VERSION,
  SETUP_KEYS,
  completeInitialSetup,
  directionForLanguage,
  getSetupVersion,
  hasAcknowledgedCurrentLegal,
  initializeSetupState,
  isValidSetupPin,
  shouldShowFirstRun,
} from '../src/utils/setupState';
import {
  MAX_LOCK_DELAY_MS,
  clearLockThrottle,
  lockDelayForFailures,
  nextLockThrottleState,
  readLockThrottleState,
  recordLockFailure,
  remainingLockDelayMs,
} from '../src/utils/lockThrottle';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  snapshot() { return new Map(this.values); }
}

const appSource = readFileSync('src/app/AppShell.tsx', 'utf8');
const ledgerSource = readFileSync('src/app/hooks/useExpenseLedger.ts', 'utf8');
const setupSource = readFileSync('src/screens/SetupWizardScreen.tsx', 'utf8');
const settingsSource = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
const imageSource = readFileSync('src/utils/imageAcquisition.ts', 'utf8');
const attachmentCopy = readFileSync('src/utils/attachmentTranslations.ts', 'utf8');
const navSource = readFileSync('src/components/Navigation.tsx', 'utf8');
const historySource = readFileSync('src/screens/HistoryScreen.tsx', 'utf8');
const detailSource = readFileSync('src/components/ExpenseDetailModal.tsx', 'utf8');
const insightSource = readFileSync('src/utils/insightSelection.ts', 'utf8');
const statisticsSource = readFileSync('src/screens/StatisticsScreen.tsx', 'utf8');
const serverSource = [
  readFileSync('server.ts', 'utf8'),
  readFileSync('server/config.ts', 'utf8'),
  readFileSync('server/middleware/rateLimit.ts', 'utf8'),
  readFileSync('server/middleware/requestLimits.ts', 'utf8'),
  readFileSync('server/validation/requests.ts', 'utf8'),
  readFileSync('server/routes/smartCapture.ts', 'utf8'),
  readFileSync('server/routes/receiptScan.ts', 'utf8'),
].join('\n');
const rateLimitSource = readFileSync('server/middleware/rateLimit.ts', 'utf8');
const requestLimitsSource = readFileSync('server/middleware/requestLimits.ts', 'utf8');
const validationSource = readFileSync('server/validation/requests.ts', 'utf8');
const configSource = readFileSync('server/config.ts', 'utf8');
const expenseServiceSource = readFileSync('src/features/expenses/ExpenseService.ts', 'utf8');

test('fresh state is explicitly marked pending and shows first-run setup', () => {
  const storage = new MemoryStorage();
  assert.equal(initializeSetupState(storage), 'fresh');
  assert.equal(shouldShowFirstRun(storage), true);
  assert.equal(storage.getItem(SETUP_KEYS.PENDING), 'true');
  assert.equal(getSetupVersion(storage), 0);
});

test('completed setup persists version and current legal acknowledgement', () => {
  const storage = new MemoryStorage();
  initializeSetupState(storage);
  completeInitialSetup(storage);
  assert.equal(shouldShowFirstRun(storage), false);
  assert.equal(getSetupVersion(storage), CURRENT_SETUP_VERSION);
  assert.equal(hasAcknowledgedCurrentLegal(storage), true);
  assert.equal(storage.getItem(SETUP_KEYS.LEGAL_VERSION), String(CURRENT_LEGAL_VERSION));
});

test('existing pre-WP18 installation migrates without fake onboarding', () => {
  const storage = new MemoryStorage();
  storage.setItem(SETUP_KEYS.LEGACY_INITIALIZED, 'true');
  assert.equal(initializeSetupState(storage), 'migrated');
  assert.equal(shouldShowFirstRun(storage), false);
  assert.equal(getSetupVersion(storage), CURRENT_SETUP_VERSION);
  assert.equal(hasAcknowledgedCurrentLegal(storage), false);
});

test('older zero-expense install with only durable preferences migrates as existing', () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_language', 'fr');
  storage.setItem('spendwise_theme', 'DARK');
  assert.equal(initializeSetupState(storage), 'migrated');
  assert.equal(shouldShowFirstRun(storage), false);
  assert.equal(getSetupVersion(storage), CURRENT_SETUP_VERSION);
});

test('setup migration is idempotent', () => {
  const storage = new MemoryStorage();
  storage.setItem(SETUP_KEYS.LEGACY_INITIALIZED, 'true');
  assert.equal(initializeSetupState(storage), 'migrated');
  const once = storage.snapshot();
  assert.equal(initializeSetupState(storage), 'complete');
  assert.deepEqual(storage.snapshot(), once);
});

test('an interrupted genuine first-run stays first-run after legacy init marker appears', () => {
  const storage = new MemoryStorage();
  assert.equal(initializeSetupState(storage), 'fresh');
  storage.setItem(SETUP_KEYS.LEGACY_INITIALIZED, 'true');
  assert.equal(initializeSetupState(storage), 'fresh');
  assert.equal(shouldShowFirstRun(storage), true);
});

test('setup state does not mutate financial ledger keys', () => {
  const storage = new MemoryStorage();
  storage.setItem('spendwise_expenses', '[{"id":1}]');
  storage.setItem('spendwise_budgets', '[{"monthKey":"2026-09"}]');
  storage.setItem('spendwise_expense_attachments_v1', '[{"id":"a"}]');
  const before = {
    expenses: storage.getItem('spendwise_expenses'),
    budgets: storage.getItem('spendwise_budgets'),
    attachments: storage.getItem('spendwise_expense_attachments_v1'),
  };
  initializeSetupState(storage);
  completeInitialSetup(storage);
  assert.deepEqual({
    expenses: storage.getItem('spendwise_expenses'),
    budgets: storage.getItem('spendwise_budgets'),
    attachments: storage.getItem('spendwise_expense_attachments_v1'),
  }, before);
});

test('language direction applies immediately and correctly', () => {
  assert.equal(directionForLanguage('ar'), 'rtl');
  assert.equal(directionForLanguage('en'), 'ltr');
  assert.equal(directionForLanguage('fr'), 'ltr');
  assert.match(setupSource, /document\.documentElement\.setAttribute\('dir', directionForLanguage\(language\)\)/);
});

test('initial setup has one required Terms and Privacy acknowledgement', () => {
  assert.match(setupSource, /mode === 'first-run' && !accepted/);
  assert.match(setupSource, /disabled=\{mode === 'first-run' && !accepted\}/);
  assert.match(setupSource, /setLegalKind\('terms'\)/);
  assert.match(setupSource, /setLegalKind\('privacy'\)/);
  assert.equal((setupSource.match(/type="checkbox"/g) || []).length, 1);
});

test('replay is separate from first-run completion and does not clear consent', () => {
  assert.match(appSource, /'first-run' \| 'replay'/);
  assert.match(settingsSource, /onReviewSetup/);
  assert.match(appSource, /setSetupMode\('replay'\)/);
  assert.match(setupSource, /if \(mode === 'first-run'\) SetupState\.completeInitialSetup\(\)/);
  assert.doesNotMatch(setupSource, /removeItem\(SETUP_KEYS\.LEGAL_VERSION/);
});

test('PIN setup is optional and only matching 4-8 digit PINs are valid', () => {
  assert.equal(isValidSetupPin('', ''), false);
  assert.equal(isValidSetupPin('1234', '1234'), true);
  assert.equal(isValidSetupPin('12345678', '12345678'), true);
  assert.equal(isValidSetupPin('123', '123'), false);
  assert.equal(isValidSetupPin('123456789', '123456789'), false);
  assert.equal(isValidSetupPin('1234', '4321'), false);
  assert.match(setupSource, /const wantsPin = pin\.length > 0 \|\| confirmPin\.length > 0/);
});

test('lock throttling is bounded, temporary, deterministic, and resettable', () => {
  assert.equal(lockDelayForFailures(4), 0);
  assert.equal(lockDelayForFailures(5), 5_000);
  assert.equal(lockDelayForFailures(7), 15_000);
  assert.equal(lockDelayForFailures(9), MAX_LOCK_DELAY_MS);
  assert.equal(lockDelayForFailures(100), MAX_LOCK_DELAY_MS);

  const state = nextLockThrottleState({ failedAttempts: 8, blockedUntil: 0 }, 1_000);
  assert.deepEqual(state, { failedAttempts: 9, blockedUntil: 31_000 });
  assert.equal(remainingLockDelayMs(state, 16_000), 15_000);

  const storage = new MemoryStorage();
  for (let i = 0; i < 5; i++) recordLockFailure(10_000, storage);
  assert.equal(readLockThrottleState(storage).failedAttempts, 5);
  assert.equal(remainingLockDelayMs(readLockThrottleState(storage), 10_000), 5_000);
  clearLockThrottle(storage);
  assert.deepEqual(readLockThrottleState(storage), { failedAttempts: 0, blockedUntil: 0 });
});

test('camera permission remains contextual and gallery remains independent', () => {
  const takePhotoBody = imageSource.slice(imageSource.indexOf('export async function takePhoto'), imageSource.indexOf('export async function choosePhotos'));
  const galleryBody = imageSource.slice(imageSource.indexOf('export async function choosePhotos'));
  assert.match(takePhotoBody, /ensureCameraPermission\(\)/);
  assert.match(takePhotoBody, /saveToGallery: false/);
  assert.doesNotMatch(galleryBody, /ensureCameraPermission\(\)/);
  assert.doesNotMatch(appSource, /requestPermissions/);
  assert.doesNotMatch(setupSource, /requestPermissions|ensureCameraPermission|takePhoto\(/);
  assert.match(attachmentCopy, /system settings|réglages système|إعدادات النظام/);
});

test('replay currency changes preserve existing conversion safeguards', () => {
  assert.match(setupSource, /if \(hasFinancialData\) setPendingCurrencyCode\(currency\.code\)/);
  assert.match(setupSource, /<CurrencyConversionModal/);
  assert.match(setupSource, /await onCurrencyChange\(pendingCurrencyCode, rate\)/);
  assert.match(expenseServiceSource, /throw new Error\('A conversion rate is required for an existing financial ledger\.'\)/);
});


test('backend AI rate limiting remains per-IP, bounded, and exposes Retry-After', () => {
  assert.match(rateLimitSource, /const key = req\.ip \|\| req\.socket\.remoteAddress/);
  assert.match(configSource, /rateBucketMaxEntries: 2_000/);
  assert.match(rateLimitSource, /cleanupRateBuckets\(rateBuckets, now, serverConfig\.rateBucketMaxEntries\)/);
  assert.match(rateLimitSource, /'Retry-After'/);
  assert.match(rateLimitSource, /res\.status\(429\)/);
});

test('backend request and AI image input bounds remain enforced', () => {
  assert.match(requestLimitsSource, /express\.json\(\{ limit: '16mb' \}\)/);
  assert.match(configSource, /maxImageBase64Length: 12_000_000/);
  assert.match(serverSource, /imageBase64\.length > serverConfig\.maxImageBase64Length/);
  assert.match(validationSource, /safeString\(/);
  assert.match(validationSource, /safeInsightArray\(/);
});

test('WP17 product shape remains frozen', () => {
  const entries = navSource.match(/\{ screen: '(home|history|insights|statistics)'/g) || [];
  assert.equal(entries.length, 4);
  assert.match(historySource, /\['ALL',[\s\S]*\['DAY',[\s\S]*\['CATEGORY'/);
  assert.doesNotMatch(detailSource, /onEdit|Edit2|onDelete/);
  assert.match(insightSource, /Math\.min\(3, limit\)/);
  assert.match(statisticsSource, /CategoryStatisticsSection/);
});

test('v1.4 Android update identity and release metadata stay aligned', () => {
  const version = JSON.parse(readFileSync('version.json', 'utf8')) as {
    versionName: string;
    versionCode: number;
  };
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
    version: string;
    packages?: Record<string, { version?: string }>;
  };
  const gradle = readFileSync('android/app/build.gradle', 'utf8');
  const capacitor = readFileSync('capacitor.config.json', 'utf8');
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  const workflow = readFileSync('.github/workflows/android-build.yml', 'utf8');

  assert.equal(version.versionName, '1.4.0');
  assert.equal(version.versionCode, 5);
  assert.equal(packageJson.version, version.versionName);
  assert.equal(packageLock.version, version.versionName);
  assert.equal(packageLock.packages?.['']?.version, version.versionName);
  assert.match(gradle, /applicationId "com\.spendwise\.app"/);
  assert.match(gradle, /versionCode spendwiseVersion\.versionCode/);
  assert.match(gradle, /versionName spendwiseVersion\.versionName/);
  assert.match(capacitor, /"appId": "com\.spendwise\.app"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(workflow, /Build signed release APK[\s\S]*assembleRelease/);
  assert.match(workflow, /Validate release tag and version/);
  assert.match(workflow, /SPENDWISE_KEYSTORE_BASE64/);
});

test('final audit leaves no stale browser-only clear-data copy or old backend version id', () => {
  const translations = readFileSync('src/utils/translations.ts', 'utf8');
  const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
  assert.doesNotMatch(serverSource, /SpendWise\/1\.1/);
  assert.doesNotMatch(translations, /from your browser|de votre navigateur|من المتصفح/);
  assert.match(settings, /financialDataCleared/);
  assert.match(settings, /financialDataClearFailed/);
});
