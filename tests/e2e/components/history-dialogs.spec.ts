import { expect, test } from '@playwright/test';

test('History renders rows, filtering, details, and an accessible delete alternative', async ({ page }) => {
  await page.goto('/wp32.component.html?case=history');
  await expect(page.getByText('WP32 Coffee')).toBeVisible();
  await page.getByPlaceholder(/Search description/).fill('Transit');
  await expect(page.getByText('WP32 Transit')).toBeVisible();
  await expect(page.getByText('WP32 Coffee')).toBeHidden();
  await page.getByPlaceholder(/Search description/).fill('');

  const coffeeCard = page.getByRole('button', { name: /WP32 Coffee, .*Food/i });
  await coffeeCard.focus();
  await expect(coffeeCard).toBeFocused();
  await coffeeCard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Expense Details' })).toBeVisible();
  await expect(page.getByText('Rendered details fixture')).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).first().click();

  const deleteButton = page.getByRole('button', { name: /Delete.*WP32 Coffee/i });
  await expect(deleteButton).toBeAttached();
  await deleteButton.focus();
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();
  await expect(page.getByText('WP32 Coffee')).toBeHidden();
});

test('destructive confirmation exposes alertdialog semantics and both paths', async ({ page }) => {
  await page.goto('/wp32.component.html?case=confirm');
  const dialog = page.getByRole('alertdialog', { name: 'Erase fixture?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('destructive WP32 test');
  const cancel = page.getByRole('button', { name: 'Cancel' });
  const erase = page.getByRole('button', { name: 'Erase' });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(erase).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('cancel');
});

test('Backup v3 passphrase validates create mode and reports restore errors', async ({ page }) => {
  await page.goto('/wp32.component.html?case=backup-create');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Create secure backup' }).click();
  await expect(page.getByText(/Passphrases must match/)).toBeVisible();
  const inputs = page.locator('input[type="password"]');
  await inputs.nth(0).fill('wp32-public-passphrase');
  await inputs.nth(1).fill('wp32-public-passphrase');
  await page.getByRole('button', { name: 'Create secure backup' }).click();
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('passphrase:wp32-public-passphrase');

  await page.goto('/wp32.component.html?case=backup-restore-error');
  await expect(page.getByText('Wrong passphrase fixture')).toBeVisible();
});

test('Backup restore presents merge and replace as explicit choices', async ({ page }) => {
  await page.goto('/wp32.component.html?case=backup-preview');
  await expect(page.getByRole('dialog')).toContainText('Backup restore v3');
  await page.getByRole('button', { name: 'Replace', exact: true }).first().click();
  await expect(page.getByText(/fully validates and stages/)).toBeVisible();
  await page.getByRole('button', { name: 'Replace', exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('replace');
});

test('grouped Undo is a live region with a keyboard-accessible action', async ({ page }) => {
  await page.goto('/wp32.component.html?case=undo');
  const status = page.getByRole('status');
  await expect(status).toContainText('2 expenses deleted');
  const undo = page.getByRole('button', { name: 'Undo' });
  await undo.focus();
  await expect(undo).toBeFocused();
  await undo.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('undo');
});

test('web lock rejects an incorrect PIN and accepts the correct credential', async ({ page }) => {
  await page.goto('/wp32.component.html?case=lock-web');
  await expect(page.getByRole('heading', { name: 'SpendWise is Locked' })).toBeVisible();
  const pin = page.getByPlaceholder('Enter PIN');
  await pin.fill('9999');
  await page.getByRole('button', { name: 'Unlock SpendWise' }).click();
  await expect(page.getByText('Incorrect passcode.')).toBeVisible();
  await pin.fill('2468');
  await page.getByRole('button', { name: 'Unlock SpendWise' }).click();
  await expect.poll(() => page.evaluate(() => window.__WP32_EVENTS__)).toContain('unlock:web:2468');
});

test('native lock exposes cancellation without pretending the session unlocked', async ({ page }) => {
  await page.goto('/wp32.component.html?case=lock-native');
  await expect(page.getByText(/Android screen lock|strong biometric/)).toBeVisible();
  const unlock = page.getByRole('button', { name: 'Authenticate & Unlock' });
  await unlock.click();
  await expect(page.getByText('Authentication was cancelled.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SpendWise is Locked' })).toBeVisible();
});
