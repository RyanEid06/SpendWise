import { expect, test } from '@playwright/test';

const url = '/tests/e2e/components/wp38-gemini.html';
const actionNames = { analysis: /Analyze My Spending|Re-Analyze Spending/, statistics: /Explain|Refresh/, smart: /Analyze with Gemini/i, receipt: /Analyze Receipt/i };

for (const mode of ['analysis', 'statistics', 'smart', 'receipt'] as const) {
  test(`${mode}: quota exhaustion gates primary and progress retry, preserves context, and resets on new context`, async ({ page }) => {
    await page.goto(`${url}?mode=${mode}`);
    const action = page.getByRole('button', { name: actionNames[mode] });
    await action.click();
    await expect(page.getByText(/daily AI quota is exhausted/).first()).toBeVisible();
    await expect(action).toBeDisabled();
    await expect(page.locator('.ai-progress').getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
    if (mode === 'smart' || mode === 'receipt') await expect(page.locator('img')).toHaveCount(1);
    if (mode === 'analysis') {
      await page.evaluate(() => window.__WP38_GEMINI__.analyze());
      expect(await page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(1);
      expect(await page.evaluate(() => window.__WP38_GEMINI__.cache()?.isAiGenerated)).toBe(false);
    }
    await page.getByRole('button', { name: 'Change context' }).click();
    await expect(action).toBeEnabled();
    await action.click();
    await expect.poll(() => page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(2);
  });
  test(`${mode}: Retry-After restores quota actions without changing context`, async ({ page }) => {
    await page.goto(`${url}?mode=${mode}&retryAfter`);
    const action = page.getByRole('button', { name: actionNames[mode] });
    await action.click();
    await expect(action).toBeDisabled();
    await expect(action).toBeEnabled({ timeout: 4000 });
    await action.click();
    await expect.poll(() => page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(2);
  });
}

for (const mode of ['smart', 'receipt'] as const) {
  test(`${mode}: retain previously reviewed result and photo after quota failure`, async ({ page }) => {
    await page.goto(`${url}?mode=${mode}&previousResult`);
    await expect(page.getByText(/Previously reviewed synthetic/)).toBeVisible();
    await page.getByRole('button', { name: actionNames[mode] }).click();
    await expect(page.getByText(/daily AI quota is exhausted/).first()).toBeVisible();
    await expect(page.getByText(/Previously reviewed synthetic/)).toBeVisible();
    await expect(page.locator('img')).toHaveCount(1);
  });
}

for (const [mode, failure] of [['analysis', 'summary'], ['analysis', 'fallback'], ['statistics', 'fallback']] as const) {
  test(`${mode}: throwing ${failure} clears operation state without caching an incomplete fallback`, async ({ page }) => {
    await page.goto(`${url}?mode=${mode}&failLocal=${failure}`);
    const action = page.getByRole('button', { name: actionNames[mode] });
    await action.click();
    await expect(page.locator('[data-ai-stage="error"]')).toBeVisible();
    await expect(action).toBeEnabled();
    expect(await page.evaluate(() => window.__WP38_GEMINI__.cache())).toBeNull();
    expect(await page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(0);
    if (mode === 'analysis') await expect(page.getByTestId('analysis-state')).toHaveText('false/error/false');
    await page.evaluate(() => { window.__WP38_GEMINI__.failLocal = false; });
    await action.click();
    await expect(page.locator('[data-ai-stage="local"]')).toBeVisible();
    expect(await page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(1);
  });
}

test('analysis: cancellation invalidates late fallback and leaves cache empty', async ({ page }) => {
  await page.goto(`${url}?slow`);
  await page.getByRole('button', { name: 'Analyze My Spending', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(1);
  await page.getByRole('button', { name: 'Cancel AI request' }).click();
  await expect(page.getByTestId('analysis-state')).toHaveText('false/cancelled/false');
  await page.evaluate(() => window.__WP38_GEMINI__.releaseResponse());
  await page.waitForTimeout(100); // Let the deliberately late result cross its promise boundary.
  expect(await page.evaluate(() => window.__WP38_GEMINI__.cache())).toBeNull();
  await expect(page.locator('[data-ai-stage="local"]')).toHaveCount(0);
});

test('analysis: a throwing fallback cache write still releases loading, progress and duplicate gate', async ({ page }) => {
  await page.goto(`${url}?transient&failCache`);
  const action = page.getByRole('button', { name: 'Analyze My Spending', exact: true });
  await action.click();
  await expect(page.getByTestId('analysis-state')).toHaveText('false/error/false');
  expect(await page.evaluate(() => window.__WP38_GEMINI__.cache())).toBeNull();
  await page.evaluate(() => { window.__WP38_GEMINI__.failCache = false; });
  await action.click();
  await expect(page.getByTestId('analysis-state')).toHaveText('false/local/false');
  expect(await page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(2);
});

test('analysis: changing context invalidates late provider fallback before it can cache', async ({ page }) => {
  await page.goto(`${url}?slow`);
  await page.getByRole('button', { name: 'Analyze My Spending', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(1);
  await page.getByRole('button', { name: 'Change context' }).click();
  await page.evaluate(() => window.__WP38_GEMINI__.releaseResponse());
  await expect(page.getByTestId('analysis-state')).toHaveText('false/idle/false');
  expect(await page.evaluate(() => window.__WP38_GEMINI__.cache())).toBeNull();
});

test('analysis: duplicate handler calls share a single active request', async ({ page }) => {
  await page.goto(`${url}?slow`);
  await page.getByRole('button', { name: 'Analyze My Spending', exact: true }).click();
  await page.evaluate(() => { void window.__WP38_GEMINI__.analyze(); void window.__WP38_GEMINI__.analyze(); });
  expect(await page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(1);
  await page.evaluate(() => window.__WP38_GEMINI__.releaseResponse());
  await expect(page.getByTestId('analysis-state')).toHaveText('false/local/false');
});

for (const [language, actionName, reason] of [
  ['fr', /Analyser mes dépenses|Réanalyser les dépenses/, /quota quotidien de l’IA est épuisé/],
  ['ar', /تحليل نفقاتي|إعادة تحليل النفقات/, /تم استنفاد الحصة اليومية/],
] as const) {
  test(`analysis: existing ${language} quota copy accompanies disabled actions`, async ({ page }) => {
    await page.goto(`${url}?lang=${language}`);
    const action = page.getByRole('button', { name: actionName });
    await action.click();
    await expect(page.getByText(reason).first()).toBeVisible();
    await expect(action).toBeDisabled();
  });
}

test('analysis: transient provider failure retains ordinary retry', async ({ page }) => {
  await page.goto(`${url}?transient`);
  const action = page.getByRole('button', { name: /Analyze My Spending|Re-Analyze Spending/ });
  await action.click();
  await expect(page.locator('[data-ai-stage="local"]')).toBeVisible();
  await expect(action).toBeEnabled();
  await page.locator('.ai-progress').getByRole('button', { name: 'Retry', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__WP38_GEMINI__.requests)).toBe(2);
});
