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


test('expense create -> read -> update remains durable', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP32 CRUD Original', '15.00');
  await page.getByRole('button', { name: 'History' }).click();

  const card = page.getByRole('button', { name: /WP32 CRUD Original,/ });
  await card.focus();
  await card.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Expense Details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).first().click();

  await page.getByRole('button', { name: 'Home' }).click();
  const homeCard = page.getByRole('button', { name: /WP32 CRUD Original,/ });
  await homeCard.focus();
  await homeCard.press('Enter');

  const editor = page.getByRole('dialog', { name: 'Edit Expense' });
  await expect(editor).toBeVisible();
  await editor.getByRole('spinbutton', { name: /Amount/ }).fill('27.50');
  await editor.getByRole('textbox', { name: /Description/ }).fill('WP32 CRUD Updated');
  await editor.getByRole('button', { name: 'Update Expense' }).click();
  await expect(editor).toBeHidden();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 CRUD Updated')).toBeVisible();
  await page.reload();
  await expect(page.getByText('WP32 CRUD Updated')).toBeVisible();
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
    const openSettingsName =
      language === 'fr' ? 'Ouvrir les paramètres' :
      language === 'ar' ? 'فتح الإعدادات' :
      'Open Settings';
    await expect(page.getByRole('button', { name: openSettingsName })).toBeVisible();
  });
}


test('AI backend interruption falls back locally without crashing or mutating the ledger', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP32 Offline AI', '22.40');
  await page.route('**/api/gemini/analyze', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'AI Insights' }).click();
  await page.getByRole('button', { name: 'Analyze My Spending' }).click();

  await expect(page.getByText(/AI is unavailable right now.*local statistical analysis/i)).toBeVisible();
  await expect(page.getByText('Local analysis', { exact: false }).first()).toBeAttached();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 Offline AI')).toBeVisible();
});
