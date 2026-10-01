import { expect, test, type Page } from '@playwright/test';
import { addExpense, openSettings, startFresh } from '../browser/helpers';

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.document, 'document horizontal overflow').toBeLessThanOrEqual(1);
  expect(overflow.body, 'body horizontal overflow').toBeLessThanOrEqual(1);
}

for (const width of [320, 360, 390, 412]) {
  test(`critical shell has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await startFresh(page);
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Add Expense' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Add Expense' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'History' }).click();
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await assertNoHorizontalOverflow(page);
    await openSettings(page);
    await assertNoHorizontalOverflow(page);
  });
}

for (const [language, theme] of [
  ['en', 'LIGHT'],
  ['en', 'SYSTEM'],
  ['fr', 'DARK'],
  ['ar', 'LIGHT'],
] as const) {
  test(`${language}/${theme} representative layout remains usable`, async ({ page }) => {
    await startFresh(page, language);
    const settingsName = language === 'fr' ? 'Paramètres' : language === 'ar' ? 'الإعدادات' : 'Settings';
    await page.getByRole('button', { name: settingsName }).click();

    const appearance = language === 'fr' ? 'Apparence' : language === 'ar' ? 'المظهر' : 'Appearance';
    await page.getByText(appearance, { exact: true }).click();
    const themeLabel = theme === 'DARK'
      ? (language === 'fr' ? 'Sombre' : language === 'ar' ? 'داكن' : 'Dark')
      : theme === 'SYSTEM'
        ? (language === 'fr' ? 'Système' : language === 'ar' ? 'النظام' : 'System')
        : (language === 'fr' ? 'Clair' : language === 'ar' ? 'فاتح' : 'Light');
    await page.getByRole('button', { name: themeLabel }).click();
    await assertNoHorizontalOverflow(page);
    if (language === 'ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
}
