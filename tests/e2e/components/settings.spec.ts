import { expect, test } from '@playwright/test';

test('Settings overview renders real interactive sections and navigation actions', async ({ page }) => {
  await page.goto('/tests/e2e/components/index.html?case=settings');
  await expect(page.getByText('Appearance', { exact: true })).toBeVisible();
  await page.getByText('Appearance', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByText('Language', { exact: true }).click();
  await page.getByRole('button', { name: /العربية/ }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('اللغة', { exact: true })).toBeVisible();

  await page.getByText('قفل التطبيق', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('app-lock');
});

for (const [lang, dir, label] of [
  ['en', 'ltr', 'Backup & Restore'],
  ['fr', 'ltr', 'Sauvegarde'],
  ['ar', 'rtl', 'النسخ الاحتياطي'],
] as const) {
  test(`Settings keeps accessible labels in ${lang}`, async ({ page }) => {
    await page.goto(`/tests/e2e/components/index.html?case=settings&lang=${lang}`);
    await expect(page.locator('html')).toHaveAttribute('dir', dir);
    await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    const buttons = page.getByRole('button');
    expect(await buttons.count()).toBeGreaterThan(3);
  });
}
