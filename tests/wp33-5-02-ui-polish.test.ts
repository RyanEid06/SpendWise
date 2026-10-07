import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatSettingsPhotoCount } from '../src/features/settings/settingsCopy.ts';

const home = readFileSync('src/components/TopExpensesSection.tsx', 'utf8');
const statistics = readFileSync('src/screens/StatisticsScreen.tsx', 'utf8');
const settings = readFileSync('src/screens/SettingsScreen.tsx', 'utf8');
const settingsOverview = readFileSync('src/features/settings/SettingsOverview.tsx', 'utf8');
const bootstrap = readFileSync('src/main.tsx', 'utf8');
const setup = readFileSync('src/screens/SetupWizardScreen.tsx', 'utf8');
const translations = readFileSync('src/utils/translations.ts', 'utf8');

test('WP33.5-02 Home amount owns its column and cannot wrap', () => {
  assert.match(home, /SingleLineAmount/);
  const amount = readFileSync('src/components/SingleLineAmount.tsx', 'utf8');
  assert.match(amount, /data-home-amount="single-line"/);
  assert.match(amount, /whitespace-nowrap/);
  assert.doesNotMatch(amount, /overflow-wrap:anywhere/);
  assert.match(home, /expense\.description[\s\S]*truncate/);
});

test('WP33.5-02 Largest Expense by Month defaults to Top 3 with an expandable remainder', () => {
  assert.match(statistics, /rankedLargestExpenses\.slice\(0, 3\)/);
  assert.match(statistics, /visibleLargestExpenses\.map/);
  assert.match(statistics, /rankedLargestExpenses\.length > 3/);
  assert.match(statistics, /setShowAllLargestExpenses\(\(current\) => !current\)/);
  assert.match(statistics, /aria-expanded=\{showAllLargestExpenses\}/);
  assert.match(statistics, /\{rank\}/);
  assert.doesNotMatch(statistics, /\{'#' \+ rank\}/);
  assert.match(translations, /showAll: 'Show all'/);
  assert.match(translations, /showAll: 'Tout afficher'/);
  assert.match(translations, /showAll: 'عرض الكل'/);
});

test('WP33.5-02 monthly rows use a clear calendar icon with light/dark contrast', () => {
  assert.match(statistics, /CalendarDays/);
  assert.match(statistics, /text-indigo-600 dark:text-indigo-400/);
});

test('WP33.5-02 Settings summary is photo-count only with localized number forms', () => {
  assert.match(settings, /formatSettingsPhotoCount\(mediaSummary\?\.photoCount \?\? 0, currentLanguage\)/);
  const storageValueLine = settings.split('\n').find((line) => line.includes('const storageValue =')) ?? '';
  assert.doesNotMatch(storageValueLine, /humanBytes/);
  assert.equal(formatSettingsPhotoCount(0, 'en'), '0 photos');
  assert.equal(formatSettingsPhotoCount(1, 'en'), '1 photo');
  assert.equal(formatSettingsPhotoCount(2, 'en'), '2 photos');
  assert.equal(formatSettingsPhotoCount(0, 'fr'), '0 photos');
  assert.equal(formatSettingsPhotoCount(1, 'fr'), '1 photo');
  assert.equal(formatSettingsPhotoCount(2, 'fr'), '2 photos');
  assert.equal(formatSettingsPhotoCount(0, 'ar'), '0 صور');
  assert.equal(formatSettingsPhotoCount(1, 'ar'), '1 صورة');
  assert.equal(formatSettingsPhotoCount(2, 'ar'), '2 صورتان');
  assert.equal(formatSettingsPhotoCount(5, 'ar'), '5 صور');
});

test('WP33.5-02 removes diagnostics from normal Settings but preserves the failure path', () => {
  assert.doesNotMatch(settings, /TechnicalDiagnostics/);
  assert.doesNotMatch(settingsOverview, /technicalDiagnostics/);
  assert.match(bootstrap, /TechnicalDiagnostics/);
  assert.match(bootstrap, /renderStorageFailure/);
  assert.match(bootstrap, /<TechnicalDiagnostics language=\{bootstrapLanguage\(\)\} \/>/);
  assert.match(readFileSync('src/services/diagnostics/diagnostics.ts', 'utf8'), /DiagnosticStore/);
  assert.match(readFileSync('src/services/diagnostics/exportDiagnostics.ts', 'utf8'), /exportTechnicalDiagnostics/);
});

test('WP33.5-02 legal agreement keeps separate links and a dedicated accessible checkbox target', () => {
  assert.match(setup, /data-legal-agreement="terms-privacy"/);
  assert.match(setup, /htmlFor="setup-legal-agreement"/);
  assert.match(setup, /id="setup-legal-agreement"/);
  assert.match(setup, /aria-describedby="setup-legal-agreement-copy"/);
  assert.match(setup, /min-w-\[44px\] min-h-\[44px\]/);
  assert.match(setup, /setLegalKind\('terms'\)/);
  assert.match(setup, /setLegalKind\('privacy'\)/);
  assert.doesNotMatch(setup, /<label className="min-h-\[56px\][\s\S]*setLegalKind\('terms'\)[\s\S]*setLegalKind\('privacy'\)[\s\S]*<\/label>/);
});
