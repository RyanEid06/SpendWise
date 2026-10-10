import { expect, test, type Page } from '@playwright/test';
import { addExpense, mockReadyAuthenticatedBackend, startFresh } from './helpers';
import { t } from '../../../src/utils/translations';

function deferred() {
  let finish!: () => void;
  const promise = new Promise<void>(resolve => { finish = resolve; });
  return { promise, finish };
}

const trend = { timestamp: 1791201600000, periodLabel: 'All Time', summary: 'WP04 retained trend',
  keyObservations: ['Stable dining'], categoryHighlights: ['Food'], recommendation: 'Review dining' };

const analysis = { timestamp: 1791201600000, analyzedMonthKey: '2026-10', isAiGenerated: true,
  spendingOverview: 'WP04 retained analysis', historyContext: 'Single month', biggestChanges: [],
  unusualExpenses: [], recurringSpending: [], areasToReview: [] };

const capture = { description: 'Coffee', merchantOrBrand: 'WP04 Cafe', category: 'Food & Beverage', amount: 12.5,
  notes: 'Suggested note', confidence: 'high', uncertaintyReason: null, priceVisible: true,
  detectedCurrencyCode: 'USD', currencyMismatch: false };

async function selectCapturePhoto(page: Page, tool: 'smart' | 'receipt' = 'smart') {
  await page.getByRole('button', { name: 'Add Expense', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByTestId(`tool-${tool}-button`).click();
  const chooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await chooser).setFiles('tests/fixtures/media/wp32-photo-01.jpg');
  return editor;
}

test('Smart Capture keeps in-flight work when collapsed and applies its photo only once', async ({ page }) => {
  await startFresh(page);
  const gate = deferred();
  let requests = 0;
  await page.route('**/api/gemini/smart-capture', async route => {
    requests++;
    await gate.promise;
    await route.fulfill({ json: capture });
  });
  const editor = await selectCapturePhoto(page);
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await editor.getByTestId('tool-smart-button').click();
  gate.finish();
  await editor.getByTestId('tool-smart-button').click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: /Description/ })).toHaveValue('Coffee (WP04 Cafe)');
  await editor.getByTestId('tool-smart-button').click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await expect(editor.getByTestId('tool-photos-button')).toHaveText(/1/);
  expect(requests).toBe(1);
});

test('Smart Capture currency mismatch preserves the manually entered amount', async ({ page }) => {
  await startFresh(page);
  await page.route('**/api/gemini/smart-capture', route => route.fulfill({ json: {
    ...capture, detectedCurrencyCode: 'EUR', currencyMismatch: true, amount: 99,
  } }));
  const editor = await selectCapturePhoto(page);
  await editor.getByRole('spinbutton').fill('7.25');
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await expect(editor.getByRole('spinbutton')).toHaveValue('7.25');
  await expect(editor.getByRole('button', { name: 'Food & Beverage', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('Smart Capture can attach its photo after a full draft frees capacity', async ({ page }) => {
  await startFresh(page);
  await page.route('**/api/gemini/smart-capture', route => route.fulfill({ json: capture }));
  await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByTestId('tool-photos-button').click();
  const chooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await chooser).setFiles(Array(8).fill('tests/fixtures/media/wp32-photo-01.jpg'));
  await expect(editor.getByRole('button', { name: 'Remove photo', exact: true })).toHaveCount(8);
  await editor.getByTestId('tool-smart-button').click();
  const captureChooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await captureChooser).setFiles('tests/fixtures/media/wp32-photo-01.jpg');
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await expect(editor.getByTestId('tool-photos-button')).toHaveText(/8/);
  await editor.getByTestId('tool-photos-button').click();
  await editor.getByRole('button', { name: 'Remove photo', exact: true }).first().click();
  await expect(editor.getByTestId('tool-photos-button')).toHaveText(/7/);
  await editor.getByTestId('tool-smart-button').click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await expect(editor.getByTestId('tool-photos-button')).toHaveText(/8/);
});

test('photo viewer owns keyboard focus and returns it to the expense editor', async ({ page }) => {
  await startFresh(page);
  const editor = await selectCapturePhoto(page);
  await page.route('**/api/gemini/smart-capture', route => route.fulfill({ json: capture }));
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true }).click();
  await editor.getByTestId('tool-photos-button').click();
  const preview = editor.getByRole('button', { name: /Preview|View photo/i });
  await preview.focus();
  await preview.press('Enter');
  const close = page.getByRole('button', { name: 'Close photo', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await close.click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('button', { name: /Preview|View photo/i })).toBeFocused();
});

test('resetting a photo rejects its late suggestion and keeps the existing draft', async ({ page }) => {
  await startFresh(page);
  const gate = deferred();
  let started = false;
  await page.route('**/api/gemini/smart-capture', async route => {
    started = true;
    await gate.promise;
    await route.fulfill({ json: capture });
  });
  const editor = await selectCapturePhoto(page);
  await editor.getByRole('textbox', { name: /Description/ }).fill('Manual draft');
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await editor.getByRole('button', { name: t('en', 'smartCaptureRemovePhoto'), exact: true }).click();
  const completed = page.waitForResponse('**/api/gemini/smart-capture');
  gate.finish();
  await completed;
  await expect(editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true })).toHaveCount(0);
  await expect(editor.getByRole('textbox', { name: /Description/ })).toHaveValue('Manual draft');
});

test('failed photo analysis keeps manual fields and cannot apply a missing suggestion', async ({ page }) => {
  await startFresh(page);
  await page.route('**/api/gemini/smart-capture', route => route.fulfill({ status: 503, json: { error: 'AI_TEMPORARILY_UNAVAILABLE' } }));
  const editor = await selectCapturePhoto(page);
  await editor.getByRole('spinbutton').fill('7.25');
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await expect(editor.getByText(t('en', 'aiErrorUnavailable'), { exact: true })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Apply to Expense Draft', exact: true })).toHaveCount(0);
  await expect(editor.getByRole('spinbutton')).toHaveValue('7.25');
});

test('Receipt Apply visibly updates amount, merchant, category, date and notes without saving', async ({ page }) => {
  await startFresh(page);
  await page.route('**/api/gemini/scan-receipt', route => route.fulfill({ json: {
    merchant: 'WP04 Receipt Cafe', totalAmount: 23.4, dateMillis: new Date(2026, 9, 3, 12).getTime(),
    dateFormatted: '2026-10-03', category: 'Food & Beverage', items: ['Coffee'], notesSummary: 'Receipt note',
    detectedCurrencyCode: 'USD', currencyMismatch: false, isUncertain: false, uncertaintyReason: null,
  } }));
  const editor = await selectCapturePhoto(page, 'receipt');
  await editor.getByRole('button', { name: t('en', 'receiptAnalyzePhoto'), exact: true }).click();
  await editor.getByRole('button', { name: t('en', 'receiptApplyDraft'), exact: true }).click();
  await expect(editor.getByRole('spinbutton')).toHaveValue('23.4');
  await expect(editor.getByRole('textbox', { name: /Description/ })).toHaveValue('WP04 Receipt Cafe');
  await expect(editor.getByRole('button', { name: 'Food & Beverage', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(editor.locator('input[type="date"]')).toHaveValue('2026-10-03');
  await expect(editor.getByRole('textbox', { name: /Optional Note/ })).toHaveValue('Receipt note');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spendwise_expenses') || '[]').length)).toBe(0);
});

for (const screen of ['AI Insights', 'Statistics'] as const) {
  for (const failure of [false, true]) {
    test(`${screen} handles ${failure ? 'failure' : 'success'} arriving while hidden without duplicates`, async ({ page }) => {
      await startFresh(page);
      await addExpense(page, 'WP04 Delayed', '20');
      const gate = deferred();
      let requests = 0;
      await page.route(`**/api/gemini/${screen === 'Statistics' ? 'explain-trends' : 'analyze'}`, async route => {
        requests++;
        await gate.promise;
        if (failure) await route.abort('failed');
        else await route.fulfill({ json: screen === 'Statistics' ? trend : analysis });
      });
      await page.getByRole('button', { name: screen, exact: true }).click();
      await page.getByRole('button', { name: screen === 'Statistics' ? 'Explain' : 'Analyze My Spending', exact: true }).click();
      await expect.poll(() => requests).toBe(1);
      for (let index = 0; index < 3; index++) {
        await page.getByRole('button', { name: 'Home', exact: true }).click();
        await expect(page.getByRole('button', { name: /Explaining|Evaluating personal/ })).toHaveCount(0);
        await page.getByRole('button', { name: screen, exact: true }).click();
        await expect(page.getByRole('button', { name: /Explaining|Evaluating personal/ })).toBeDisabled();
      }
      await page.getByRole('button', { name: 'Home', exact: true }).click();
      gate.finish();
      await page.getByRole('button', { name: screen, exact: true }).click();
      if (failure) await expect(page.getByText(t('en', 'aiErrorNetwork'), { exact: screen === 'Statistics' })).toBeVisible();
      else await expect(page.getByText(screen === 'Statistics' ? trend.summary : analysis.spendingOverview)).toBeVisible();
      expect(requests).toBe(1);
    });
  }
}

test('Statistics rejects late results from an earlier period and allows a fresh request', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP04 Context');
  const gate = deferred();
  let requests = 0;
  await page.route('**/api/gemini/explain-trends', async route => {
    const index = ++requests;
    if (index === 1) await gate.promise;
    await route.fulfill({ json: { ...trend, summary: index === 1 ? 'WP04 stale period' : 'WP04 current period' } });
  });
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await page.getByRole('button', { name: 'Explain', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole('tab', { name: 'All Time', exact: true }).click();
  await page.getByRole('button', { name: 'Explain', exact: true }).click();
  await expect(page.getByText('WP04 current period')).toBeVisible();
  gate.finish();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.getByText('WP04 current period')).toBeVisible();
  await expect(page.getByText('WP04 stale period')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('History search/filter and Statistics expansions survive tab switches with scroll', async ({ page }) => {
  await startFresh(page);
  for (let index = 0; index < 4; index++) await addExpense(page, `WP04 Coffee ${index}`, `${index + 1}`);
  await page.evaluate(() => {
    const expenses = JSON.parse(localStorage.getItem('spendwise_expenses')!);
    expenses.forEach((expense: { date: number }, index: number) => { expense.date = new Date(2026, 9 - index, 3, 12).getTime(); });
    localStorage.setItem('spendwise_expenses', JSON.stringify(expenses));
  });
  await page.reload();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('searchbox').fill('Coffee 2');
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await page.getByRole('tab', { name: 'All Time', exact: true }).click();
  await page.getByRole('button', { name: 'Show all', exact: true }).click();
  const category = page.getByRole('button', { name: /Food & Beverage/ }).first();
  await category.click();
  await expect(category).toHaveAttribute('aria-expanded', 'true');
  await page.evaluate(() => window.scrollTo(0, 350));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(350);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Coffee 2');
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(category).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Show top 3', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(350);
});

test('screen reload interrupts work safely and offers retry rather than resuming the request', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP04 Reload');
  let requests = 0;
  const gate = deferred();
  await page.route('**/api/gemini/explain-trends', async route => {
    requests++;
    await gate.promise;
    await route.fulfill({ json: trend }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await page.getByRole('button', { name: 'Explain', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Explain', exact: true })).toBeEnabled();
  expect(requests).toBe(1);
  gate.finish();
  await expect(page.getByText(trend.summary)).toHaveCount(0);
});

test('a completed Analysis cannot reappear under a different language context', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP04 Language');
  await page.route('**/api/gemini/analyze', route => route.fulfill({ json: analysis }));
  await page.getByRole('button', { name: 'AI Insights', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze My Spending', exact: true }).click();
  await expect(page.getByText(analysis.spendingOverview)).toBeVisible();
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await page.getByRole('button', { name: /Language/ }).click();
  await page.getByRole('button', { name: 'Français LTR', exact: true }).click();
  await page.getByRole('button', { name: /Retour.*écran/i }).click();
  await expect(page.getByText(analysis.spendingOverview)).toHaveCount(0);
});

test.beforeEach(async ({ page }) => {
  await mockReadyAuthenticatedBackend(page);
});

test('Statistics retains selected period and in-flight success through repeated tab switches', async ({ page }) => {
  await startFresh(page);
  await addExpense(page, 'WP04 Dining', '18');
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  let requests = 0;
  await page.route('**/api/gemini/explain-trends', async route => {
    requests++;
    await pending;
    await route.fulfill({ json: { timestamp: Date.now(), periodLabel: 'All Time', summary: 'WP04 retained trend',
      keyObservations: ['Stable dining'], categoryHighlights: ['Food'], recommendation: 'Review dining' } });
  });
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await page.getByRole('tab', { name: 'All Time', exact: true }).click();
  await page.getByRole('button', { name: 'Explain', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  for (let index = 0; index < 2; index++) {
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Statistics', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'All Time', exact: true })).toHaveAttribute('aria-selected', 'true');
  }
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  finish();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(page.getByText('WP04 retained trend')).toBeVisible();
  expect(requests).toBe(1);
});

test('new attachments exclude proof', async ({ page }) => {
  await startFresh(page);
  await page.getByRole('button', { name: 'Add Expense', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByTestId('tool-photos-button').click();
  await expect(editor.getByRole('combobox')).not.toHaveValue('proof');
  await expect(editor.getByRole('option', { name: /Proof/ })).toHaveCount(0);
});

test('Apply returns the populated draft to view without saving', async ({ page }) => {
  await startFresh(page);
  await page.getByRole('button', { name: 'Add Expense', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'Add Expense' });
  await editor.getByTestId('tool-smart-button').click();
  await page.route('**/api/gemini/smart-capture', route => route.fulfill({ json: {
    description: 'Coffee', merchantOrBrand: 'WP04 Cafe', category: 'Food', amount: 12.5,
    notes: 'Suggested note', confidence: 'high', uncertaintyReason: null, priceVisible: true,
    detectedCurrencyCode: 'USD', currencyMismatch: false,
  } }));
  const chooser = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Choose Photo', exact: true }).click();
  await (await chooser).setFiles('tests/fixtures/media/wp32-photo-01.jpg');
  await editor.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await editor.getByRole('button', { name: /Apply to expense draft/i }).click();
  const description = editor.getByRole('textbox', { name: /Description/ });
  await expect(description).toHaveValue('Coffee (WP04 Cafe)');
  await expect(editor.getByRole('spinbutton')).toHaveValue('12.5');
  await expect(description).toBeInViewport();
  await expect(editor.getByRole('textbox', { name: /Note/ })).toHaveValue('Suggested note');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('spendwise_expenses') || '[]').length)).toBe(0);
  await description.fill('Inspected suggestion');
  await editor.getByRole('button', { name: 'Save Expense', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText('Inspected suggestion').first()).toBeVisible();
});
