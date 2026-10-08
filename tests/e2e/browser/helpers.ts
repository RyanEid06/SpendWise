import { expect, type Page } from '@playwright/test';

export const BACKUP_PASSPHRASE = 'wp32-public-fixture-passphrase';

export async function clearBrowserState(page: Page) {
  await page.goto('/');
  // Startup writes its initialization marker asynchronously. Wait for that
  // first document before clearing it, so it cannot race the fresh reload.
  await page.waitForFunction(() => localStorage.getItem('spendwise_clean_init_v3') === 'true');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

export async function completeOnboarding(page: Page, language: 'en' | 'fr' | 'ar' = 'en') {
  await expect(page.getByRole('heading', { name: 'Set up SpendWise' })).toBeVisible();
  if (language === 'fr') {
    await page.getByRole('button', { name: 'Français' }).click();
    await expect(page.getByRole('heading', { name: 'Configurer SpendWise' })).toBeVisible();
  }
  if (language === 'ar') {
    await page.getByRole('button', { name: 'العربية' }).click();
    await expect(page.getByRole('heading', { name: 'إعداد SpendWise' })).toBeVisible();
  }
  const next = language === 'fr' ? 'Suivant' : language === 'ar' ? 'التالي' : 'Next';
  await page.getByRole('button', { name: next }).click();
  await page.getByRole('button', { name: next }).click();
  const checkbox = page.locator('input[type="checkbox"]').last();
  await checkbox.check();
  const finish = language === 'fr' ? 'Terminer' : language === 'ar' ? 'إنهاء الإعداد' : 'Finish setup';
  await page.getByRole('button', { name: finish }).click();
  await expect(page.getByRole('button', { name: language === 'fr' ? 'Ajouter une dépense' : language === 'ar' ? 'إضافة مصروف' : 'Add Expense' }).first()).toBeVisible();
}

export async function startFresh(page: Page, language: 'en' | 'fr' | 'ar' = 'en') {
  await clearBrowserState(page);
  await completeOnboarding(page, language);
}

export async function addExpense(page: Page, description = 'WP32 Coffee', amount = '12.50') {
  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add Expense' });
  await expect(dialog).toBeVisible();
  await dialog.getByText('Amount *').locator('..').getByRole('spinbutton').fill(amount).catch(async () => {
    await dialog.locator('input').nth(0).fill(amount);
  });
  await dialog.getByPlaceholder(/Supermarket|Coffee Shop/).fill(description);
  await dialog.getByRole('button', { name: 'Save Expense' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(description).first()).toBeVisible();
}

export async function setBudget(page: Page, amount = '1250') {
  await page.getByRole('button', { name: /Set Budget/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Monthly Budget' });
  await expect(dialog).toBeVisible();
  await dialog.locator('input').first().fill(amount);
  await dialog.getByRole('button', { name: 'Save Budget' }).click();
  await expect(dialog).toBeHidden();
}

export async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}
