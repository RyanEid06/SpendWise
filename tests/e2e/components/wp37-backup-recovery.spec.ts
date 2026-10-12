import { test, expect } from '@playwright/test';
import { backupRestoreCopy } from '../../../src/features/backup/restoreCopy';
import { AUTHENTICATION_LIMIT_COPY } from '../../../src/security/authenticationCopy';
import { overviewCopy } from '../../../src/features/settings/settingsCopy';
import { t } from '../../../src/utils/translations';

for (const format of [1, 2, 3]) {
  for (const refreshFailure of [false, true]) {
  test(`V${format} incomplete recovery ${refreshFailure ? 'retains the warning when preference and media readback fail' : 'reconciles the displayed ledger and appearance without claiming success'}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`/tests/e2e/components/wp37-backup-recovery.html?format=${format}${refreshFailure ? '&refreshFailure' : ''}`);
    await expect(page.getByTestId('rendered-ledger')).toHaveText('1/0/USD/LIGHT/en');
    await expect(page.getByTestId('cached-overview')).toHaveText('Old ledger cached claim');
    await page.getByText('Backup & Restore', { exact: true }).click();
    const file = await page.evaluate(() => window.__WP37_RECOVERY_FILE__!);
    await page.locator('input[type="file"]').first().setInputFiles({ name: file.name, mimeType: file.mimeType, buffer: Buffer.from(file.base64, 'base64') });
    if (format === 3) {
      const unlock = page.getByRole('dialog');
      await unlock.locator('input[type="password"]').fill('wp37 synthetic recovery password');
      await unlock.getByRole('button', { name: 'Unlock backup', exact: true }).click();
    }
    const preview = page.getByRole('dialog');
    if (format === 1) await preview.getByRole('radio').last().check();
    else await preview.getByRole('button', { name: 'Replace', exact: true }).first().click();
    await preview.getByRole('checkbox', { name: /Restore app language and appearance/ }).check();
    await preview.getByRole('button', { name: format === 1 ? 'Replace & Restore' : 'Replace', exact: true }).last().click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(backupRestoreCopy.en.recoveryIncomplete);
    if (refreshFailure) await expect(alert).toContainText(backupRestoreCopy.en.recoveryRefreshFailed);
    await expect(alert).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(0);
    const persisted = await page.evaluate(() => window.__WP37_REOPEN_RECOVERY__!());
    expect(persisted).toEqual({ count: 2, currency: 'EUR', theme: 'DARK', language: 'en' });
    await expect(page.getByTestId('cached-overview')).toHaveText('No cached insights');
    await expect(page.getByTestId('rendered-ledger')).toHaveText(`2/1/EUR/${refreshFailure ? 'LIGHT' : 'DARK'}/en`);
    if (!refreshFailure) {
      await expect(page.locator('html')).toHaveClass(/dark/);
      await expect(page.getByTestId('reconciliations')).toHaveText('1');
    }
    expect(pageErrors).toEqual([]);
  });
  }
}

for (const language of ['en', 'fr', 'ar'] as const) {
  test(`native immediate-lock credential limitation uses specific ${language} copy`, async ({ page }) => {
    await page.goto(`/tests/e2e/components/wp37-backup-recovery.html?authLimit&lang=${language}`);
    await page.getByText(overviewCopy[language].appLock, { exact: true }).first().click();
    const appLock = page.getByRole('checkbox', { name: t(language, 'appLockTitle'), exact: true });
    await appLock.focus();
    await appLock.press('Space');
    await expect(page.getByRole('alert')).toContainText(AUTHENTICATION_LIMIT_COPY[language]);
    await expect(page.getByRole('checkbox', { name: t(language, 'appLockTitle'), exact: true })).not.toBeChecked();
  });
}
