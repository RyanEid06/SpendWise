import { expect, test } from '@playwright/test';
import { t } from '../../../src/utils/translations';

for (const [language, categoryLabel, fallback] of [
  ['en', 'Transportation', 'Transportation'],
  ['fr', 'Transports & Carburant', 'Transports & Carburant'],
  ['ar', 'مواصلات ووقود', 'مواصلات ووقود'],
] as const) {
  test(`blank manual description resolves final category on save in ${language}`, async ({ page }) => {
    await page.goto(`/tests/e2e/components/index.html?case=expense&lang=${language}`);
    const dialog = page.getByRole('dialog');
    const description = dialog.getByRole('textbox', { name: t(language, 'descriptionLabel') });
    await expect(description).toHaveValue('');
    await dialog.locator('input').first().fill('20');
    await dialog.locator('[data-expense-categories] button').filter({ hasText: categoryLabel }).click();
    await description.fill('   ');
    await dialog.getByRole('button', { name: t(language, 'saveExpenseBtn'), exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain(`expense-save:20:${fallback}:Transportation`);
    await expect(description).toHaveValue('   '); // fallback is never a prefilled input
  });
}

test('custom and existing descriptions survive save and category changes; double click saves once', async ({ page }) => {
  for (const edit of [false, true]) {
    await page.goto(`/tests/e2e/components/index.html?case=expense${edit ? '&edit=1' : ''}`);
    const dialog = page.getByRole('dialog');
    await dialog.locator('input').first().fill('70');
    const description = dialog.getByRole('textbox', { name: t('en', 'descriptionLabel') });
    if (!edit) await description.fill('  New shoes  ');
    await dialog.locator('[data-expense-categories] button').filter({ hasText: 'Shopping' }).click();
    await dialog.getByRole('button', { name: t('en', edit ? 'updateExpenseBtn' : 'saveExpenseBtn'), exact: true }).dblclick();
    const expected = `expense-save:70:${edit ? 'WP32 Coffee' : 'New shoes'}:Shopping`;
    await expect.poll(() => page.evaluate(value => window.__WP32_EVENTS__?.filter(e => e === value).length, expected)).toBe(1);
  }
});

test('Food keeps its stable category identifier and saves the Food & Beverage display label', async ({ page }) => {
  await page.goto('/tests/e2e/components/index.html?case=expense');
  const dialog = page.getByRole('dialog');
  await dialog.locator('input').first().fill('15');
  await dialog.getByRole('button', { name: 'Food & Beverage', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save Expense', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('expense-save:15:Food & Beverage:Food');
});
