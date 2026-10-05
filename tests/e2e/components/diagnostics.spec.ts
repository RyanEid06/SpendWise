import { expect, test } from '@playwright/test';

for (const [language, heading, preview, clear] of [
  ['en', 'Technical diagnostics', 'Inspect report', 'Clear diagnostics'],
  ['fr', 'Diagnostic technique', 'Voir le rapport', 'Effacer les diagnostics'],
  ['ar', 'التشخيص التقني', 'عرض التقرير', 'مسح التشخيص'],
] as const) {
  test(`WP33 explicit technical report controls are accessible in ${language}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spendwise_technical_diagnostics_v1', JSON.stringify({ version: 1, recentErrors: [{ operation: 'storage.open', code: 'STORAGE_OPEN_FAILED', outcome: 'failure', timestamp: Date.now(), token: 'forbidden-private-token', description: 'forbidden-receipt' }], state: { platform: 'web' } })));
    await page.goto(`/tests/e2e/components/index.html?case=diagnostics&lang=${language}`);
    await expect(page.getByText(heading, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: preview }).click();
    const report = page.getByTestId('technical-report'); await expect(report).toContainText('STORAGE_OPEN_FAILED'); await expect(report).not.toContainText('forbidden');
    await page.getByRole('button', { name: clear }).click(); await expect(report).not.toContainText('STORAGE_OPEN_FAILED');
    const exportButton = page.getByRole('button', { name: language === 'en' ? 'Export technical report' : language === 'fr' ? 'Exporter le rapport technique' : 'تصدير التقرير التقني' });
    const download = page.waitForEvent('download'); await exportButton.click(); expect((await download).suggestedFilename()).toMatch(/^SpendWise-technical-diagnostics-.*\.json$/);
  });
}

test('startup failure still exposes technical diagnostics when preference storage cannot be read', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('forbidden-private-storage-error'); }; });
  await page.goto('/');
  await expect(page.getByText('SpendWise could not safely open local data', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect report' }).click();
  await expect(page.getByTestId('technical-report')).toContainText('STORAGE_INIT_FAILED');
  await expect(page.getByTestId('technical-report')).not.toContainText('forbidden');
});
