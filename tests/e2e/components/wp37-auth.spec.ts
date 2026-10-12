import { expect, test } from '@playwright/test';

async function backgroundLock(page: import('@playwright/test').Page) {
  await page.goto('/tests/e2e/components/wp37-auth.html');
  await expect(page.getByTestId('secure-lock-surface')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__WP37_AUTH__.ready)).toBe(true);
}

test('WP37 background-mounted native auto unlock waits for foreground then starts once', async ({ page }) => {
  await backgroundLock(page);
  expect(await page.evaluate(() => (window as any).__WP37_AUTH__.calls)).toBe(0);
  await page.evaluate(() => (window as any).__WP37_AUTH__.foreground());
  await expect.poll(() => page.evaluate(() => (window as any).__WP37_AUTH__.calls)).toBe(1);
  await expect(page.getByRole('button', { name: 'Unlock SpendWise', exact: true })).toBeEnabled();
});

test('WP37 a cancelled queued native auto unlock never starts on later foreground', async ({ page }) => {
  await backgroundLock(page);
  await page.evaluate(() => { const auth = (window as any).__WP37_AUTH__; auth.cancel(); auth.foreground(); });
  await expect(page.getByRole('button', { name: 'Unlock SpendWise', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__WP37_AUTH__.calls)).toBe(0);
});

test('WP37 a disposed background lock presentation never starts authentication', async ({ page }) => {
  await backgroundLock(page);
  await page.evaluate(() => { const auth = (window as any).__WP37_AUTH__; auth.unmount(); auth.foreground(); });
  await expect(page.getByTestId('secure-lock-surface')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__WP37_AUTH__.calls)).toBe(0);
});
