import { test, expect } from '@playwright/test';

for (const dark of [false, true]) {
  test(`WP38 Arabic lock keeps concise RTL copy and isolated Latin brand on a narrow ${dark ? 'dark' : 'light'} phone`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/tests/e2e/components/index.html?case=lock-native&lang=ar');
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    const lock = page.getByTestId('secure-lock-surface');
    await expect(lock).toHaveAttribute('dir', 'rtl');
    await expect(lock.getByRole('heading')).toHaveText('SpendWise مقفل');
    await expect(lock.getByText('استخدم بصمة الإصبع أو قفل شاشة هاتفك لفتح SpendWise.', { exact: true })).toBeVisible();
    const brands = lock.locator('bdi[dir="ltr"]');
    await expect(brands).toHaveCount(3);
    for (const brand of await brands.all()) {
      await expect(brand).toHaveText('SpendWise');
      expect(await brand.evaluate(el => getComputedStyle(el).unicodeBidi)).toBe('isolate');
    }
    expect(await lock.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const unlock = lock.getByRole('button', { name: 'فتح SpendWise', exact: true });
    await unlock.click();
    await expect(lock.getByText('تم إلغاء التحقق. يمكنك المحاولة مجددًا.', { exact: true })).toBeVisible();
    await expect(unlock).toBeEnabled();
    await page.screenshot({ path: `artifacts/wp38/arabic-lock-${dark ? 'dark' : 'light'}.png` });
  });
}

for (const [language, title, description, button, cancelled] of [
  ['en', 'SpendWise is Locked', 'Use your Android screen lock or strong biometric to unlock SpendWise.', 'Unlock SpendWise', 'Authentication was cancelled.'],
  ['fr', 'SpendWise est verrouillé', 'Utilisez le verrouillage Android ou une biométrie forte pour déverrouiller SpendWise.', 'Déverrouiller SpendWise', 'Authentification annulée.'],
]) {
  test(`WP38 keeps existing ${language} lock copy and cancel recovery`, async ({ page }) => {
    await page.goto(`/tests/e2e/components/index.html?case=lock-native&lang=${language}`);
    const lock = page.getByTestId('secure-lock-surface');
    await expect(lock.getByRole('heading')).toHaveText(title);
    await expect(lock.getByText(description, { exact: true })).toBeVisible();
    await expect(lock.locator('bdi')).toHaveCount(0);
    await lock.getByRole('button', { name: button, exact: true }).click();
    await expect(lock.getByText(cancelled, { exact: true })).toBeVisible();
    await expect(lock.getByRole('button', { name: button, exact: true })).toBeEnabled();
  });
}
