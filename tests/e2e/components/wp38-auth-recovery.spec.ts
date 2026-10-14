import { expect, test } from '@playwright/test';

test('WP38 hung native request returns to retry only after invalidation and cancellation acknowledgment', async ({ page }) => {
  await page.clock.install();
  await page.goto('/tests/e2e/components/wp38-auth-recovery.html');
  const primary = page.getByRole('button', { name: 'Unlock SpendWise', exact: true });
  await primary.click();
  await expect.poll(() => page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.calls())).toBe(1);
  await page.clock.fastForward(65_000);
  await expect.poll(() => page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.cancellations)).toBe(1);
  await expect(page.getByRole('button', { name: 'Unlocking…', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.snapshot().state)).toBe('locked');
  await page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.acknowledge());
  const retry = page.getByRole('button', { name: 'Try fingerprint again', exact: true });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect.poll(() => page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.calls())).toBe(2);
  await page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.succeed(0));
  expect(await page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.unlocked)).toBe(0);
  expect(await page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.reads)).toBe(0);
  await expect(page.getByRole('button', { name: 'Unlocking…', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.succeed(1));
  await expect.poll(() => page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.unlocked)).toBe(1);
  expect(await page.evaluate(() => (window as any).__WP38_AUTH_RECOVERY__.reads)).toBe(1);
});
