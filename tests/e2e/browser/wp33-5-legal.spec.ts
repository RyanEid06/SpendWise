import { expect, test } from '@playwright/test';
import { clearBrowserState } from './helpers';

test('Arabic legal agreement follows reading order and links stay independent', async ({ page }) => {
  await clearBrowserState(page);
  await page.getByRole('button', { name: 'العربية' }).click();
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByRole('button', { name: 'التالي' }).click();
  const checkbox = page.getByRole('checkbox').last();
  const text = page.locator('#setup-legal-agreement-copy');
  const box = await checkbox.boundingBox();
  const copy = await text.boundingBox();
  expect(box!.x).toBeGreaterThan(copy!.x + copy!.width);
  const links = text.getByRole('button');
  await links.first().click();
  await page.getByRole('button', { name: 'رجوع', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
});
