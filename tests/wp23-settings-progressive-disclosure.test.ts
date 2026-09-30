import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');

function indexOfRequired(marker: string): number {
  const index = settings.indexOf(marker);
  assert.ok(index >= 0, 'missing marker: ' + marker);
  return index;
}

function includesRequired(marker: string): void {
  assert.ok(settings.includes(marker), 'missing marker: ' + marker);
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

  includesRequired('data-settings-overview="compact"');
  assert.equal(settings.includes('Setup & privacy'), false);
  assert.equal(settings.includes('100% Local & Private Guarantee'), false);
});

test('Appearance, Language and Currency use inline disclosure semantics', () => {
  includesRequired('data-inline-settings="appearance"');
  includesRequired('data-inline-settings="language"');
  includesRequired('data-inline-settings="currency"');
  includesRequired('indicator="expand"');
  includesRequired('<ChevronDown');
  includesRequired('<ChevronUp');
});

test('complex settings areas use dedicated internal sub-screens', () => {
  includesRequired("type SettingsPage = 'overview' | 'app-lock' | 'storage-media' | 'backup-restore'");
  includesRequired("setSettingsPage('app-lock')");
  includesRequired("setSettingsPage('storage-media')");
  includesRequired("setSettingsPage('backup-restore')");
  includesRequired('indicator="navigate"');
  includesRequired('rtl:rotate-180');
});

test('App Lock keeps PIN validation, toggle and timeout controls', () => {
  includesRequired('StorageManager.hasLockPin()');
  includesRequired('StorageManager.setLockPin(newPin)');
  includesRequired("if (!/^\\d{4,8}$/.test(newPin)");
  includesRequired('onAppLockToggle(enabled)');
  includesRequired('onLockTimeoutChange(option.seconds)');
  includesRequired('pinRequiredToEnable');
});

test('Storage and backup capabilities remain reachable without engine rewrites', () => {
  includesRequired('StorageManager.getMediaStorageSummary()');
  includesRequired('setShowMediaLibrary(true)');
  includesRequired('StorageManager.createBackupV2(includeMedia)');
  includesRequired('StorageManager.createBackupJson()');
  includesRequired('StorageManager.createCsvExport()');
  includesRequired('StorageManager.restoreBackup(pendingImportBackup, replaceExisting)');
  includesRequired('StorageManager.restoreBackupV2(pendingV2Backup.file, replaceExisting)');
  includesRequired('BACKUP_CURRENCY_MISMATCH');
});

test('currency changes retain the existing conversion safeguard', () => {
  includesRequired('if (!hasFinancialData)');
  includesRequired('setPendingCurrencyCode(code)');
  includesRequired('<CurrencyConversionModal');
  includesRequired('await onCurrencyChange(targetCode, targetUnitsPerSourceUnit)');
});

test('setup replay and destructive clear both remain confirmation protected', () => {
  includesRequired('showSetupReplayModal');
  includesRequired('setupConfirmMessage');
  includesRequired('onReviewSetup()');
  includesRequired('showClearModal');
  includesRequired('isDestructive={true}');
  includesRequired('await onClearAllData()');
});

test('legal screens and installed version information remain available', () => {
  includesRequired("setLegalKind('terms')");
  includesRequired("setLegalKind('privacy')");
  includesRequired('APP_VERSION_NAME');
  includesRequired('APP_VERSION_CODE');
});

test('native Back closes nested layers before returning a settings sub-screen to overview', () => {
  const backHandler = settings.slice(
    settings.indexOf('const handleNativeBack'),
    settings.indexOf("window.addEventListener('spendwise-native-back'")
  );
  for (const marker of [
    'pendingCurrencyCode',
    'pendingV2Backup',
    'pendingImportBackup',
    'showClearModal',
    'showSetupReplayModal',
    'showMediaLibrary || legalKind',
    "settingsPage !== 'overview'",
    "setSettingsPage('overview')",
  ]) {
    assert.ok(backHandler.includes(marker), 'native Back missing marker: ' + marker);
  }
});

test('EN FR AR copy and RTL-safe directional affordances are explicit', () => {
  includesRequired('en: {');
  includesRequired('fr: {');
  includesRequired('ar: {');
  includesRequired('العربية');
  includesRequired('rtl:rotate-180');
  includesRequired('rtl:text-right');
});
