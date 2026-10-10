import { expect, test } from '@playwright/test';
import { addExpense, mockReadyAuthenticatedBackend, startFresh } from './helpers';

test.beforeEach(async ({ page }) => {
  await mockReadyAuthenticatedBackend(page);
});

test('unfinished Add restores all meaningful fields after restart and clears after Save', async ({ page }) => {
  await startFresh(page);
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByRole('spinbutton').fill('37.25');
  await editor.getByRole('textbox', { name: /Description/ }).fill('WP05 private merchant');
  await editor.getByRole('button', { name: 'Food & Beverage', exact: true }).click();
  await editor.getByLabel('Date').fill('2026-10-03');
  await editor.getByRole('textbox', { name: /Note/ }).fill('WP05 private note');
  await expect(editor.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  const values = await page.evaluate(() => Object.values(localStorage));
  expect(values.join('')).not.toContain('WP05 private merchant');
  expect(values.join('')).not.toContain('WP05 private note');
  await page.reload();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('spinbutton')).toHaveValue('37.25');
  await expect(editor.getByRole('textbox', { name: /Description/ })).toHaveValue('WP05 private merchant');
  await expect(editor.getByLabel('Date')).toHaveValue('2026-10-03');
  await expect(editor.getByRole('textbox', { name: /Note/ })).toHaveValue('WP05 private note');
  await expect(editor.getByRole('button', { name: 'Food & Beverage', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor.getByRole('button', { name: 'Save Expense' }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  await expect(editor).toBeHidden();
  await expect(page.getByText('WP05 private merchant', { exact: true })).toHaveCount(1);
});

test('interrupted Edit restores identity and attachment removals without creating an expense', async ({ page }) => {
  await startFresh(page);
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add Expense' });
  await add.getByRole('spinbutton').fill('5');
  await add.getByRole('textbox', { name: /Description/ }).fill('WP05 Original');
  await add.getByTestId('tool-photos-button').click();
  const chooser = page.waitForEvent('filechooser');
  await add.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await chooser).setFiles('tests/fixtures/media/wp32-photo-01.jpg');
  await expect(add.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  await add.getByRole('button', { name: 'Save Expense', exact: true }).click();
  await expect(add).toBeHidden();
  await page.getByRole('button', { name: /^WP05 Original,/ }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Expense' });
  await editor.getByRole('spinbutton').fill('31.75');
  await editor.getByRole('textbox', { name: /Description/ }).fill('WP05 Edited');
  await editor.getByTestId('tool-photos-button').click();
  await editor.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(editor.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  await page.reload();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('spinbutton')).toHaveValue('31.75');
  await expect(editor.getByRole('button', { name: 'Remove photo', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Update Expense' }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  const expenses = await page.evaluate(() => JSON.parse(localStorage.getItem('spendwise_expenses')!));
  expect(expenses).toHaveLength(1);
  expect(expenses[0]).toMatchObject({ id: 1, amount: 31.75, description: 'WP05 Edited', category: 'Food' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spendwise_expense_attachments_v1') || '[]'))).toHaveLength(0);
});

test('malformed draft reaches authenticated Retry/Discard and Back never destroys work', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP05 valid ledger', '5');
  await page.evaluate(() => localStorage.setItem('spendwise_encrypted_expense_draft_v1', '{broken'));
  await page.reload();
  const prompt = page.getByRole('alertdialog', { name: 'Unfinished expense' });
  await expect(prompt).toBeVisible();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new Event('spendwise-native-back')));
  await expect(prompt).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('spendwise_encrypted_expense_draft_v1'))).toBe('{broken');
  await prompt.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(prompt).toBeHidden();
  await expect(page.getByText('WP05 valid ledger', { exact: true })).toHaveCount(1);
});

test('interrupted Smart Capture restores its photo and offers manual retry without duplicate Apply', async ({ page }) => {
  await startFresh(page);
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const capture = { description: 'Coffee', merchantOrBrand: 'WP05 Cafe', category: 'Food', amount: 12.5, notes: 'Suggested note', confidence: 'high', uncertaintyReason: null, priceVisible: true, detectedCurrencyCode: 'USD', currencyMismatch: false };
  await page.route('**/api/gemini/smart-capture', async route => {
    requests++;
    if (requests === 1) await pending;
    await route.fulfill({ json: capture }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByRole('spinbutton').fill('7.25');
  await editor.getByTestId('tool-smart-button').click();
  const chooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await chooser).setFiles('tests/fixtures/media/wp32-photo-01.jpg');
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(editor.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  await page.reload();
  await expect(editor.getByText('Analysis was interrupted. Retry when you are ready.')).toBeVisible();
  expect(requests).toBe(1);
  release();
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: /Description/ })).toHaveValue('Coffee (WP05 Cafe)');
  await expect(editor.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  await page.reload();
  await editor.getByTestId('tool-smart-button').click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await expect(editor.getByTestId('tool-photos-button')).toHaveText(/1/);
  expect(requests).toBe(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spendwise_expenses') || '[]'))).toHaveLength(0);
});

test('App Lock hides a protected draft until authentication and reopens it after unlock', async ({ page }) => {
  await startFresh(page);
  await page.evaluate(() => { localStorage.setItem('spendwise_lock_pin', '2468'); localStorage.setItem('spendwise_app_lock_enabled', 'true'); });
  await page.reload();
  await page.getByRole('textbox', { name: 'PIN' }).fill('2468');
  await page.getByRole('button', { name: 'Unlock SpendWise', exact: true }).click();
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByRole('textbox', { name: /Description/ }).fill('WP05 locked secret');
  await expect(editor.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  await page.reload();
  await expect(editor).toBeHidden();
  await expect(page.getByText('WP05 locked secret')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'PIN' }).fill('2468');
  await page.getByRole('button', { name: 'Unlock SpendWise', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: /Description/ })).toHaveValue('WP05 locked secret');
});

test('recovered photo remains available and intentional Cancel discards it', async ({ page }) => {
  await startFresh(page);
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByRole('spinbutton').fill('16');
  await editor.getByTestId('tool-photos-button').click();
  const chooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await chooser).setFiles('tests/fixtures/media/wp32-photo-01.jpg');
  await expect(editor.getByRole('button', { name: 'Remove photo', exact: true })).toHaveCount(1);
  await expect(editor.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  await page.reload();
  await expect(editor.getByRole('button', { name: 'Remove photo', exact: true })).toHaveCount(1);
  await expect(editor.locator('img').first()).toHaveJSProperty('naturalWidth', 1024);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(editor).toBeHidden();
  await page.reload();
  await expect(editor).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('spendwise_encrypted_expense_draft_v1'))).toBeNull();
});

test('accepted photo capacity uses encrypted IndexedDB and can recover and Save beyond localStorage quota', async ({ page }) => {
  await startFresh(page);
  // High-entropy pixels make a real JPEG whose prepared copies cannot fit the
  // old localStorage envelope. Exercise actual preparation and encrypted storage.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1600;
    const context = canvas.getContext('2d')!;
    const image = context.createImageData(1600, 1600);
    for (let offset = 0; offset < image.data.length; offset += 65536) crypto.getRandomValues(image.data.subarray(offset, offset + 65536));
    for (let offset = 3; offset < image.data.length; offset += 4) image.data[offset] = 255;
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg', 0.95));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByRole('spinbutton').fill('10');
  await editor.getByRole('textbox', { name: /Description/ }).fill('WP05 capacity');
  await editor.getByTestId('tool-photos-button').click();
  const chooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await chooser).setFiles(Array.from({ length: 8 }, (_, i) => ({ name: `capacity-${i}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(bytes) })));
  await expect(editor.getByRole('button', { name: 'Remove photo', exact: true })).toHaveCount(8);
  await expect(editor.getByTestId('draft-status')).toHaveText('Unfinished expense protected');
  const encryptedBytes = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('spendwise_draft_crypto_v1', 2); request.onsuccess = () => resolve(request.result); });
    const value = await new Promise<any>(resolve => { const request = db.transaction('envelopes').objectStore('envelopes').get('draft'); request.onsuccess = () => resolve(request.result); });
    db.close();
    return value.data.byteLength;
  });
  expect(encryptedBytes).toBeGreaterThan(5 * 1024 * 1024);
  expect((await page.evaluate(() => localStorage.getItem('spendwise_encrypted_expense_draft_v1')))?.length).toBeLessThan(100);
  await page.reload();
  await expect(editor.getByRole('button', { name: 'Remove photo', exact: true })).toHaveCount(8);
  await editor.getByRole('button', { name: 'Save Expense', exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  await expect(page.getByText('WP05 capacity', { exact: true })).toHaveCount(1);
});
