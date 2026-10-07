import { expect, test } from '@playwright/test';
import { formatCurrency, SUPPORTED_CURRENCIES } from '../../../src/utils/currency';

for (const language of ['en', 'fr', 'ar']) {
  test(`Home retains full values in every supported currency in ${language}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 844 });
    for (const currency of SUPPORTED_CURRENCIES) {
      for (const amount of [5, 165, 1250, 12999.99]) {
        await page.goto(`/tests/e2e/components/index.html?case=amounts&lang=${language}&currency=${currency.code}&amount=${amount}`);
        const values = page.locator('[data-home-amount]');
        await expect(values).toHaveCount(6);
        for (const value of await values.all()) {
          await expect(value).toHaveText(formatCurrency(amount, currency.code));
          expect(await value.evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element.querySelector('span')!);
            const rect = element.getBoundingClientRect();
            return new Set(Array.from(range.getClientRects(), part => Math.round(part.top))).size === 1
              && range.getBoundingClientRect().width <= rect.width + 1;
          })).toBe(true);
        }
      }
    }
  });
}

for (const language of ['en', 'fr', 'ar']) {
  for (const currency of ['USD', 'LBP', 'AED']) {
    test(`Home preserves full single-line amounts at 320px in ${language}/${currency}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(`/tests/e2e/components/index.html?case=amounts&lang=${language}&currency=${currency}&amount=999999999999999`);
      const amounts = page.locator('[data-home-amount], div[dir="ltr"].tabular-nums');
      await expect(amounts).toHaveCount(6);
      for (const amount of await amounts.all()) {
        const geometry = await amount.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element.querySelector('span') ?? element);
          const bounds = element.getBoundingClientRect();
          const text = range.getBoundingClientRect();
          return { lines: new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size, fits: text.width <= bounds.width + 1,
            inside: bounds.left >= 0 && bounds.right <= innerWidth };
        });
        expect(geometry.lines).toBe(1);
        expect(geometry.fits).toBe(true);
        expect(geometry.inside).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('Include photos has a 48px touch target and toggles by keyboard', async ({ page }) => {
  await page.goto('/tests/e2e/components/index.html?case=backup-create');
  const toggle = page.getByRole('switch', { name: 'Include photos' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const bounds = await toggle.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(48);
  expect(bounds!.width).toBeGreaterThanOrEqual(48);
  await toggle.focus();
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
});

test('Backup fields remain reachable above the actions at keyboard-sized height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto('/tests/e2e/components/index.html?case=backup-create');
  const password = page.getByLabel('Backup password', { exact: true });
  const confirm = page.getByLabel('Confirm password', { exact: true });
  await password.fill('wp32-public-fixture-passphrase');
  await confirm.fill('wp32-public-fixture-passphrase');
  await confirm.focus();
  const field = await confirm.boundingBox();
  const action = await page.getByRole('button', { name: 'Create encrypted backup' }).boundingBox();
  expect(field!.y + field!.height).toBeLessThanOrEqual(action!.y);
  await confirm.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__))
    .toContain('passphrase:wp32-public-fixture-passphrase');
});
