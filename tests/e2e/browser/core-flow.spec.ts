import { expect, test } from '@playwright/test';
import { addExpense, openSettings, setBudget, startFresh } from './helpers';

test('fresh onboarding -> budget -> expense -> reload persists', async ({ page }) => {
  await startFresh(page);
  await setBudget(page);
  await addExpense(page, 'WP32 Persistence', '18.75');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 Persistence')).toBeVisible();

  await page.reload();
  await expect(page.getByText('WP32 Persistence')).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByText(/1,250|1250/).first()).toBeVisible();
});

test('delete -> Undo restores the expense', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP32 Undo', '9.25');
  await page.getByRole('button', { name: 'History' }).click();
  const deleteButton = page.getByRole('button', { name: /Delete.*WP32 Undo/i });
  await deleteButton.focus();
  await deleteButton.click();
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(page.getByText('WP32 Undo')).toBeVisible();
});

test('Settings subpage back returns to Settings overview', async ({ page }) => {
  await startFresh(page);
  await openSettings(page);
  await page.getByText('Backup & Restore', { exact: true }).click();
  await expect(page.getByText('Backup v3 · Data only')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Backup & Restore', { exact: true })).toBeVisible();
});

for (const [language, dir, settingsLabel] of [
  ['en', 'ltr', 'Settings'],
  ['fr', 'ltr', 'Paramètres'],
  ['ar', 'rtl', 'الإعدادات'],
] as const) {
  test(`representative first-run flow works in ${language}`, async ({ page }) => {
    await startFresh(page, language);
    await expect(page.locator('html')).toHaveAttribute('dir', dir);
    await expect(page.getByText(settingsLabel, { exact: false }).first()).toBeAttached();
  });
}
