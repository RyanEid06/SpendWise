import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');

function indexOfRequired(marker: string): number {
  const index = settings.indexOf(marker);
  assert.ok(index >= 0, 'missing marker: ' + marker);
  return index;
}

test('WP23 compact overview keeps the approved top-level order', () => {
  const order = [
    'label={copy.appearance}',
    'label={copy.language}',
    'label={copy.currency}',
    'label={copy.appLock}',
    'label={copy.storage}',
    'label={copy.backup}',
    'label={copy.reviewSetup}',
    'label={copy.terms}',
    'label={copy.privacy}',
    'label={copy.clearData}',
  ].map(indexOfRequired);

  for (let index = 1; index < order.length; index += 1) {
    assert.ok(order[index - 1] < order[index], 'Settings overview order regressed');
  }

  assert.match(settings, /data-settings-overview="compact"/);
  assert.doesNotMatch(settings, /Setup & privacy|100% Local & Private Guarantee/);
});

test('Appearance, Language and Currency use inline disclosure semantics', () => {
  assert.match(settings, /indicator="expand"[sS]*data-inline-settings="appearance"/);
  assert.match(settings, /indicator="expand"[sS]*data-inline-settings="language"/);
  assert.match(settings, /indicator="expand"[sS]*data-inline-settings="currency"/);
  assert.match(settings, /<ChevronDown/);
  assert.match(settings, /<ChevronUp/);
});

test('complex settings areas use dedicated internal sub-screens', () => {
  assert.match(settings, /type SettingsPage = 'overview' | 'app-lock' | 'storage-media' | 'backup-restore'/);
  assert.match(settings, /setSettingsPage('app-lock')/);
  assert.match(settings, /setSettingsPage('storage-media')/);
  assert.match(settings, /setSettingsPage('backup-restore')/);
  assert.match(settings, /indicator="navigate"/);
  assert.match(settings, /rtl:rotate-180/);
});

test('App Lock keeps PIN validation, toggle and timeout controls', () => {
  assert.match(settings, /StorageManager.hasLockPin()/);
  assert.match(settings, /StorageManager.setLockPin(newPin)/);
  assert.ok(settings.includes("if (!/^\\d{4,8}$/.test(newPin)"));
  assert.match(settings, /onAppLockToggle(enabled)/);
  assert.match(settings, /onLockTimeoutChange(option.seconds)/);
  assert.match(settings, /pinRequiredToEnable/);
});

test('Storage and backup capabilities remain reachable without engine rewrites', () => {
  assert.match(settings, /StorageManager.getMediaStorageSummary()/);
  assert.match(settings, /setShowMediaLibrary(true)/);
  assert.match(settings, /StorageManager.createBackupV2(includeMedia)/);
  assert.match(settings, /StorageManager.createBackupJson()/);
  assert.match(settings, /StorageManager.createCsvExport()/);
  assert.match(settings, /StorageManager.restoreBackup(/);
  assert.match(settings, /StorageManager.restoreBackupV2(/);
  assert.match(settings, /BACKUP_CURRENCY_MISMATCH/);
});

test('currency changes retain the existing conversion safeguard', () => {
  assert.match(settings, /if (!hasFinancialData)/);
  assert.match(settings, /setPendingCurrencyCode(code)/);
  assert.match(settings, /<CurrencyConversionModal/);
  assert.match(settings, /await onCurrencyChange(targetCode, targetUnitsPerSourceUnit)/);
});

test('setup replay and destructive clear both remain confirmation protected', () => {
  assert.match(settings, /showSetupReplayModal/);
  assert.match(settings, /setupConfirmMessage/);
  assert.match(settings, /onReviewSetup()/);
  assert.match(settings, /showClearModal/);
  assert.match(settings, /isDestructive={true}/);
  assert.match(settings, /await onClearAllData()/);
});

test('legal screens and installed version information remain available', () => {
  assert.match(settings, /setLegalKind('terms')/);
  assert.match(settings, /setLegalKind('privacy')/);
  assert.match(settings, /APP_VERSION_NAME/);
  assert.match(settings, /APP_VERSION_CODE/);
});

test('native Back closes nested layers before returning a settings sub-screen to overview', () => {
  const backHandler = settings.slice(
    settings.indexOf('const handleNativeBack'),
    settings.indexOf("window.addEventListener('spendwise-native-back'")
  );
  assert.match(backHandler, /pendingCurrencyCode/);
  assert.match(backHandler, /pendingV2Backup/);
  assert.match(backHandler, /pendingImportBackup/);
  assert.match(backHandler, /showClearModal/);
  assert.match(backHandler, /showSetupReplayModal/);
  assert.match(backHandler, /showMediaLibrary || legalKind/);
  assert.match(backHandler, /settingsPage !== 'overview'/);
  assert.match(backHandler, /setSettingsPage('overview')/);
});

test('EN FR AR copy and RTL-safe directional affordances are explicit', () => {
  assert.match(settings, /en:/);
  assert.match(settings, /fr:/);
  assert.match(settings, /ar:/);
  assert.match(settings, /العربية/);
  assert.match(settings, /rtl:rotate-180/);
  assert.match(settings, /rtl:text-right/);
});
