import { expect, test } from '@playwright/test';
import { addExpense, openSettings, startFresh } from './helpers';

test('normal Settings hides diagnostics and leaves the financial clear action reachable', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP33 scroll fixture', '17.50');
  await openSettings(page);
  await expect(page.getByText('Technical diagnostics', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Inspect report', exact: true })).toHaveCount(0);
  const clear = page.getByRole('button', { name: /^Clear App Data/ });
  await clear.scrollIntoViewIfNeeded();
  await expect(clear).toBeInViewport();
  await clear.click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Erase Financial Data', exact: true }).click();
  await expect(page.getByText('Financial data has been erased.', { exact: true })).toBeVisible();
  await expect(page.getByText('Financial data has been erased.', { exact: true })).toBeInViewport();
  await expect(page.getByRole('status').filter({ hasText: 'Financial data has been erased.' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to previous screen', exact: true }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('WP33 scroll fixture')).toHaveCount(0);
});
