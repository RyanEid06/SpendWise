import { test, expect } from '@playwright/test';
import { backupRestoreCopy } from '../../../src/features/backup/restoreCopy';

for (const [language, replace, merge] of [['en', 'Replace', 'Merge'], ['fr', 'Remplacer', 'Fusionner'], ['ar', 'استبدال', 'دمج']] as const) {
  test(`restore appearance/language requires explicit intent and resets across modes in ${language}`, async ({ page }) => {
    await page.goto(`/tests/e2e/components/index.html?case=backup-preview&lang=${language}`);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByText(backupRestoreCopy[language].mergePreferences, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: replace, exact: true }).first().click();
    const option = page.getByRole('checkbox');
    await expect(option).not.toBeChecked();
    await expect(page.getByText(backupRestoreCopy[language].restorePreferences, { exact: true })).toBeVisible();
    await option.check();
    await page.getByRole('button', { name: merge, exact: true }).first().click();
    await expect(option).toHaveCount(0);
    await page.getByRole('button', { name: replace, exact: true }).first().click();
    await expect(option).not.toBeChecked();
    await option.check();
    await page.getByRole('button', { name: replace, exact: true }).last().click();
    await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('restore-preferences:true');
    expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}
