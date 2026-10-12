import { test, expect, type Page } from '@playwright/test';
import { startFresh, addExpense, mockReadyAuthenticatedBackend } from './helpers';
import { t } from '../../../src/utils/translations';
import { ta } from '../../../src/utils/attachmentTranslations';
import { mkdir } from 'node:fs/promises';

const capture = { description: 'Synthetic coffee', category: 'Food', amount: 12.5, merchantOrBrand: null,
  notes: null, confidence: 'high', uncertaintyReason: null, priceVisible: true, detectedCurrencyCode: 'USD', currencyMismatch: false };
const receipt = { merchant: 'Synthetic cafe', totalAmount: 12.5, dateMillis: null, dateFormatted: null,
  category: 'Food', items: [], notesSummary: '', detectedCurrencyCode: 'USD', currencyMismatch: false, isUncertain: false, uncertaintyReason: null };
const analysis = { timestamp: Date.now(), analyzedMonthKey: '2026-10', isAiGenerated: true, spendingOverview: 'Synthetic overview',
  historyContext: '', biggestChanges: [], unusualExpenses: [], recurringSpending: [], areasToReview: [] };
const trend = { timestamp: Date.now(), periodLabel: 'All Time', summary: 'Synthetic trend', keyObservations: [], categoryHighlights: [], recommendation: '' };
const features = [
  { name: 'smart', path: 'smart-capture', action: 'Analyze with Gemini', result: capture },
  { name: 'receipt', path: 'scan-receipt', action: t('en', 'receiptAnalyzePhoto'), result: receipt },
  { name: 'analysis', path: 'analyze', action: 'Analyze My Spending', result: analysis },
  { name: 'trend', path: 'explain-trends', action: 'Explain', result: trend },
] as const;

test.beforeEach(async ({ page }) => {
  await mockReadyAuthenticatedBackend(page);
});

async function openFeature(page: Page, name: typeof features[number]['name'], language: 'en' | 'fr' | 'ar' = 'en') {
  await startFresh(page, language);
  if (name === 'smart' || name === 'receipt') {
    await page.getByRole('button', { name: t(language, 'addExpenseBtn'), exact: true }).first().click();
    const editor = page.getByRole('dialog', { name: t(language, 'modalAddTitle') });
    await editor.getByRole('spinbutton').fill('7.25');
    await editor.getByTestId(`tool-${name}-button`).click();
    const chooser = page.waitForEvent('filechooser');
    await editor.getByRole('button', { name: ta(language, 'choosePhoto'), exact: true }).click();
    await (await chooser).setFiles('tests/fixtures/media/wp32-photo-01.jpg');
  } else {
    if (language === 'en') await addExpense(page, 'Synthetic baseline');
    else {
      await page.getByRole('button', { name: t(language, 'addExpenseBtn'), exact: true }).first().click();
      const editor = page.getByRole('dialog');
      await editor.getByRole('spinbutton').fill('12.50');
      await editor.getByRole('textbox').first().fill('Synthetic baseline');
      await editor.getByRole('button', { name: t(language, 'saveExpenseBtn'), exact: true }).click();
      await expect(editor).toBeHidden();
    }
    await page.getByRole('button', { name: t(language, name === 'analysis' ? 'navInsights' : 'navStatistics'), exact: true }).click();
  }
}

for (const authPhase of ['challenge', 'verify']) {
  test(`combined client shows held health then ${authPhase}, and preserves the draft on Cancel`, async ({ page }) => {
    let ready!: () => void; let authenticated!: () => void; let complete!: () => void;
    const healthGate = new Promise<void>(resolve => { ready = resolve; });
    const authGate = new Promise<void>(resolve => { authenticated = resolve; });
    const responseGate = new Promise<void>(resolve => { complete = resolve; });
    await page.route('**/api/health', async route => { await healthGate; await route.fulfill({ json: { ok: true } }).catch(() => {}); });
    await page.route(`**/api/auth/${authPhase}`, async route => {
      await authGate;
      await route.fulfill({ json: authPhase === 'challenge'
        ? { challengeId: 'held-challenge', payload: 'synthetic', expiresAt: Date.now() + 60_000 }
        : { accessToken: 'synthetic-held-token'.repeat(3), expiresAt: Date.now() + 600_000, tokenType: 'Bearer' } }).catch(() => {});
    });
    let sends = 0;
    await page.route('**/api/gemini/smart-capture', async route => { sends++; await responseGate; await route.fulfill({ json: capture }).catch(() => {}); });
    try {
      await openFeature(page, 'smart');
      await page.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
      const panel = page.locator('.ai-progress:visible');
      await expect(panel).toHaveAttribute('data-ai-stage', 'connecting');
      expect(sends).toBe(0);
      ready();
      await expect(panel).toHaveAttribute('data-ai-stage', 'authenticating');
      expect(sends).toBe(0);
      authenticated();
      await expect(panel).toHaveAttribute('data-ai-stage', 'sending');
      await panel.getByRole('button', { name: 'Cancel AI request', exact: true }).click();
      await expect(panel).toHaveAttribute('data-ai-stage', 'cancelled');
      await expect(page.getByRole('spinbutton')).toHaveValue('7.25');
      expect(sends).toBe(1);
    } finally { ready(); authenticated(); complete(); }
  });
}

for (const feature of features) {
  test(`${feature.name}: observable wait, cancel, retry, duplicate guard and no late result`, async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await page.route(`**/api/gemini/${feature.path}`, async route => {
      requests++;
      if (requests === 1) await gate;
      await route.fulfill({ json: feature.result }).catch(() => {});
    });
    await openFeature(page, feature.name);
    await page.getByRole('button', { name: feature.action, exact: true }).click();
    const panel = page.locator('.ai-progress:visible');
    await expect(panel).toHaveAttribute('data-ai-stage', 'sending');
    await expect(panel.getByRole('status')).toHaveText('Waiting for the AI service…');
    await expect(page.getByRole('button', { name: feature.action, exact: true })).toBeDisabled();
    expect(await panel.textContent()).not.toMatch(/\d\s*%|Gemini is analyzing|alternative model/i);
    await expect(panel.locator('[aria-valuenow]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel AI request', exact: true }).click();
    await expect(panel).toHaveAttribute('data-ai-stage', 'cancelled');
    release();
    await expect(page.getByText('Ready to review', { exact: true })).toHaveCount(0);
    if (feature.name === 'smart' || feature.name === 'receipt') await expect(page.getByRole('spinbutton')).toHaveValue('7.25');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(panel).toHaveAttribute('data-ai-stage', 'ready');
    expect(requests).toBe(2);
    if (feature.name === 'smart' || feature.name === 'receipt') {
      await expect(page.getByRole('spinbutton')).toHaveValue('7.25');
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });
}

for (const feature of features.slice(2)) {
  test(`${feature.name}: outage displays verified local fallback separately`, async ({ page }) => {
    await page.route(`**/api/gemini/${feature.path}`, route => route.fulfill({ status: 503, json: { error: 'AI_TEMPORARILY_UNAVAILABLE' } }));
    await openFeature(page, feature.name);
    await page.getByRole('button', { name: feature.action, exact: true }).click();
    await expect(page.locator('.ai-progress:visible')).toHaveAttribute('data-ai-stage', 'local');
    await expect(page.getByText(t('en', 'localBadge'), { exact: true })).toBeVisible();
    await expect(page.getByText(t('en', 'geminiBadge'), { exact: true })).toHaveCount(0);
  });
}

test('Add/Edit uses propagated insets once, adapts keyboard viewport and keeps controls reachable', async ({ page }) => {
  await startFresh(page, 'fr');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '28px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
    document.documentElement.classList.add('dark');
  });
  await page.getByRole('button', { name: t('fr', 'addExpenseBtn'), exact: true }).first().click();
  const overlay = page.locator('.expense-editor-viewport');
  await expect(overlay).toHaveCSS('padding-top', '42px');
  await expect(overlay).toHaveCSS('padding-bottom', '38px');
  await page.setViewportSize({ width: 640, height: 360 });
  await page.getByRole('spinbutton').fill('7.25');
  await expect(page.getByRole('button', { name: t('fr', 'saveExpenseBtn'), exact: true })).toBeInViewport();
  await page.evaluate(() => {
    // Native-consumed bars / IME report zero, not another system-bar padding.
    document.documentElement.style.setProperty('--safe-area-inset-top', '0px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '0px');
  });
  await expect(overlay).toHaveCSS('padding-top', '14px');
  await expect(overlay).toHaveCSS('padding-bottom', '14px');
  await expect(page.getByRole('spinbutton')).toHaveValue('7.25');
});

for (const feature of features) for (const language of ['en', 'fr', 'ar'] as const) for (const dark of [false, true]) {
  test(`${feature.name}: ${language} ${dark ? 'dark' : 'light'} status, reduced motion and screenshot`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/gemini/${feature.path}`, async route => {
      await gate;
      await route.fulfill({ json: feature.result }).catch(() => {});
    });
    await openFeature(page, feature.name, language);
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    const key = feature.name === 'smart' ? 'smartCaptureAnalyze' : feature.name === 'receipt' ? 'receiptAnalyzePhoto' : feature.name === 'analysis' ? 'analyzeBtn' : 'explainBtn';
    await page.getByRole('button', { name: t(language, key), exact: true }).click();
    const panel = page.locator('.ai-progress:visible');
    await expect(panel).toHaveAttribute('data-ai-stage', 'sending');
    await expect(panel.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await expect(panel).toHaveAttribute('data-ai-tone', feature.name === 'smart' ? 'cyan' : feature.name === 'receipt' ? 'purple' : 'indigo');
    await expect(panel).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(panel.locator('.ai-progress-bar')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    expect(await panel.textContent()).not.toMatch(/\d\s*%/);
    const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await mkdir('artifacts/wp35-3/screenshots', { recursive: true });
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/wp35-3/screenshots/${feature.name}-${language}-${dark ? 'dark' : 'light'}.png` });
    await panel.getByRole('button').click();
    await expect(panel).toHaveAttribute('data-ai-stage', 'cancelled');
    release();
  });
}

test('visualViewport keyboard simulation keeps Add/Edit header, footer and focused input reachable', async ({ page }) => {
  await startFresh(page);
  await page.getByRole('button', { name: 'Add Expense', exact: true }).first().click();
  const editor = page.getByRole('dialog');
  const amount = editor.getByRole('spinbutton');
  await amount.fill('7.25');
  await page.evaluate(() => {
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport, 'height', { configurable: true, value: 360 });
    Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: 25 });
    viewport.dispatchEvent(new Event('resize'));
  });
  await expect(editor).toHaveCSS('height', '360px');
  await expect(editor).toHaveCSS('top', '25px');
  const save = editor.getByRole('button', { name: 'Save Expense', exact: true });
  const footer = await save.boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(371);
  await expect(editor.getByRole('heading', { name: 'Add Expense' })).toBeInViewport();
  await expect(amount).toBeFocused();
  await expect(amount).toHaveValue('7.25');
  await mkdir('artifacts/wp35-3/screenshots', { recursive: true });
  await page.screenshot({ path: 'artifacts/wp35-3/screenshots/keyboard-simulated.png' });
});

test('known daily quota is truthful and does not offer brief Retry', async ({ page }) => {
  await page.route('**/api/gemini/smart-capture', route => route.fulfill({ status: 429, json: { error: 'AI_QUOTA_EXHAUSTED' } }));
  await openFeature(page, 'smart');
  await page.getByRole('button', { name: 'Analyze with Gemini', exact: true }).click();
  await expect(page.locator('.ai-progress:visible')).toHaveAttribute('data-ai-stage', 'error');
  await expect(page.getByText(/daily AI quota is exhausted/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton')).toHaveValue('7.25');
});

test('observed timeout offers Retry and preserves the manual photo draft', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/gemini/smart-capture', async route => { await gate; await route.fulfill({ json: capture }).catch(() => {}); });
  await openFeature(page, 'smart');
  const analyze = page.getByRole('button', { name: 'Analyze with Gemini', exact: true });
  await expect(analyze).toBeEnabled();
  await page.clock.install();
  await analyze.click();
  await expect(page.locator('.ai-progress:visible')).toHaveAttribute('data-ai-stage', 'sending');
  await page.clock.fastForward(116_000);
  await expect(page.locator('.ai-progress:visible')).toHaveAttribute('data-ai-stage', 'error');
  await expect(page.getByText(t('en', 'aiErrorTimeout'), { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton')).toHaveValue('7.25');
  release();
});
