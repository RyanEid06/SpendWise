import { expect, test } from '@playwright/test';
import { openSettings, startFresh } from '../browser/helpers';

test('empty Home keeps viewport controls operable after returning from Settings', async ({ page }) => {
  await startFresh(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Back to previous screen' }).click();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  for (const name of ['History', 'AI Insights', 'Statistics', 'Home']) {
    const tab = navigation.getByRole('button', { name, exact: true });
    await tab.focus();
    await tab.press('Enter');
    await expect(tab).toHaveAttribute('aria-current', 'page');
  }
  const add = page.getByRole('button', { name: 'Add Expense', exact: true });
  await add.focus();
  await add.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Add Expense' })).toBeVisible();
});

test('critical navigation and forms expose accessible names', async ({ page }) => {
  await startFresh(page);
  for (const name of ['Home', 'History', 'AI Insights', 'Statistics', 'Open Settings', 'Add Expense']) {
    await expect(page.getByRole('button', { name }).first()).toBeAttached();
  }

  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Expense' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('spinbutton', { name: 'Amount *' })).toBeAttached();
  await expect(dialog.getByRole('textbox', { name: 'Description / Merchant *' })).toBeAttached();
  await expect(dialog.getByRole('textbox', { name: 'Optional Note / Breakdown' })).toBeAttached();
  const closeButton = dialog.getByLabel('Cancel', { exact: true });
  await expect(closeButton).toBeAttached();
  await closeButton.click();

  await openSettings(page);
  await page.getByText('Backup & Restore', { exact: true }).click();
  await expect(page.getByText(/CSV is plaintext/)).toBeVisible();
  await page.getByText('Create encrypted backup', { exact: true }).click();
  const backupDialog = page.getByRole('dialog');
  await expect(backupDialog.locator('input[type="password"]').first()).toBeFocused();
});

test('Arabic RTL keeps semantic navigation operable', async ({ page }) => {
  await startFresh(page, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const add = page.getByRole('button', { name: 'إضافة مصروف' }).first();
  await add.focus();
  await expect(add).toBeFocused();
  await add.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});
