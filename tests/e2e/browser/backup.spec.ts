import { expect, test } from '@playwright/test';
import { addExpense, BACKUP_PASSPHRASE, openSettings, setBudget, startFresh } from './helpers';

test('Backup v3 data-only survives clear and replace restore', async ({ page }) => {
  await startFresh(page);
  await setBudget(page, '1250');
  await addExpense(page, 'WP32 Disaster Recovery', '73.40');
  await openSettings(page);
  await page.getByText('Backup & Restore', { exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Backup v3 · Data only', { exact: true }).click();
  const modal = page.getByRole('dialog');
  const passwords = modal.locator('input[type="password"]');
  await passwords.nth(0).fill(BACKUP_PASSPHRASE);
  await passwords.nth(1).fill(BACKUP_PASSPHRASE);
  await modal.getByRole('button', { name: 'Create secure backup' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByText('Clear App Data', { exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: /Erase|Delete|Clear/i }).click();
  await expect(page.getByText('0 expenses', { exact: false }).first()).toBeAttached();

  await page.getByText('Backup & Restore', { exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  const unlock = page.getByRole('dialog');
  await unlock.locator('input[type="password"]').fill(BACKUP_PASSPHRASE);
  await unlock.getByRole('button', { name: 'Unlock backup' }).click();

  const preview = page.getByRole('dialog');
  await preview.getByRole('button', { name: 'Replace', exact: true }).first().click();
  await preview.getByRole('button', { name: 'Replace', exact: true }).last().click();

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 Disaster Recovery')).toBeVisible();
  await page.reload();
  await expect(page.getByText('WP32 Disaster Recovery')).toBeVisible();
});

test('wrong Backup v3 passphrase is surfaced without mutating ledger', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP32 Protected Ledger', '31.10');
  await openSettings(page);
  await page.getByText('Backup & Restore', { exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Backup v3 · Data only', { exact: true }).click();
  let modal = page.getByRole('dialog');
  let passwords = modal.locator('input[type="password"]');
  await passwords.nth(0).fill(BACKUP_PASSPHRASE);
  await passwords.nth(1).fill(BACKUP_PASSPHRASE);
  await modal.getByRole('button', { name: 'Create secure backup' }).click();
  const backupPath = await (await downloadPromise).path();

  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  modal = page.getByRole('dialog');
  await modal.locator('input[type="password"]').fill('definitely-wrong');
  await modal.getByRole('button', { name: 'Unlock backup' }).click();
  await expect(modal).toContainText(/Wrong passphrase|tampered backup|invalid Backup v3/i);
  await modal.getByRole('button', { name: 'Cancel' }).first().click();

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 Protected Ledger')).toBeVisible();
});
