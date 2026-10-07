import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addExpense, BACKUP_PASSPHRASE, openSettings, setBudget, startFresh } from './helpers';

test('Backup v3 data-only survives clear and replace restore', async ({ page }) => {
  await startFresh(page);
  await setBudget(page, '1250');
  await addExpense(page, 'WP32 Disaster Recovery', '73.40');
  await addExpense(page, 'WP32 Second Recovery', '11.50');
  await openSettings(page);
  await page.getByText('Backup & Restore', { exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Create encrypted backup', { exact: true }).click();
  const modal = page.getByRole('dialog');
  const passwords = modal.locator('input[type="password"]');
  await passwords.nth(0).fill(BACKUP_PASSPHRASE);
  await passwords.nth(1).fill(BACKUP_PASSPHRASE);
  await modal.getByRole('button', { name: 'Create encrypted backup' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('Clear App Data', { exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: /Erase|Delete|Clear/i }).click();
  await expect(page.getByText('0 expenses', { exact: false }).first()).toBeAttached();
  await page.getByRole('button', { name: 'Back to previous screen', exact: true }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 Disaster Recovery')).toHaveCount(0);

  await openSettings(page);
  await page.getByText('Backup & Restore', { exact: true }).click();
  const restoreButton = page.getByRole('button', { name: /^Restore backup/ });
  await restoreButton.focus();
  await page.locator('input[accept=".swb3,.zip,application/octet-stream,application/zip"]').setInputFiles(backupPath!);
  const unlock = page.getByRole('dialog');
  await unlock.locator('input[type="password"]').fill(BACKUP_PASSPHRASE);
  await unlock.getByRole('button', { name: 'Unlock backup' }).click();

  const preview = page.getByRole('dialog', { name: 'Backup restore', exact: true });
  const previewCancel = preview.getByRole('button', { name: 'Cancel', exact: true }).first();
  await expect(previewCancel).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(preview.getByRole('button', { name: 'Merge', exact: true }).last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(previewCancel).toBeFocused();
  await preview.getByRole('button', { name: 'Replace', exact: true }).first().click();
  await preview.getByRole('button', { name: 'Replace', exact: true }).last().click();

  // Maestro's native selector matches the entire visible label. Exercise that
  // same selector against a real two-expense restore, including summary counts.
  const nativeFlow = readFileSync('.maestro/current/import-v3-data.yaml', 'utf8');
  const summaryPattern = nativeFlow.match(/visible: "(Backup restored[^"]*)"/)?.[1];
  expect(summaryPattern).toBeTruthy();
  await expect(page.getByText(new RegExp(`^(?:${summaryPattern})$`))).toBeVisible();
  await expect(restoreButton).toBeFocused();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back to previous screen', exact: true }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 Disaster Recovery')).toBeVisible();
  await expect(page.getByText('WP32 Second Recovery')).toBeVisible();
  await page.reload();
  await expect(page.getByText('WP32 Disaster Recovery')).toBeVisible();
});

test('wrong Backup v3 passphrase is surfaced without mutating ledger', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP32 Protected Ledger', '31.10');
  await openSettings(page);
  await page.getByText('Backup & Restore', { exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByText('Create encrypted backup', { exact: true }).click();
  let modal = page.getByRole('dialog');
  let passwords = modal.locator('input[type="password"]');
  await passwords.nth(0).fill(BACKUP_PASSPHRASE);
  await passwords.nth(1).fill(BACKUP_PASSPHRASE);
  await modal.getByRole('button', { name: 'Create encrypted backup' }).click();
  const backupPath = await (await downloadPromise).path();

  const restoreButton = page.getByRole('button', { name: /^Restore backup/ });
  await restoreButton.focus();
  await page.locator('input[accept=".swb3,.zip,application/octet-stream,application/zip"]').setInputFiles(backupPath!);
  modal = page.getByRole('dialog');
  await expect(modal.locator('input[type="password"]')).toBeFocused();
  await modal.locator('input[type="password"]').fill('definitely-wrong');
  await modal.getByRole('button', { name: 'Unlock backup' }).click();
  await expect(modal).toContainText(/Wrong backup password|tampered backup|invalid encrypted backup/i);
  await modal.getByRole('button', { name: 'Cancel' }).first().click();
  await expect(restoreButton).toBeFocused();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back to previous screen', exact: true }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('WP32 Protected Ledger')).toBeVisible();
});
