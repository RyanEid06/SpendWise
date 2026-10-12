import { test, expect } from '@playwright/test';
import { getLocalizedMonthName, t } from '../../../src/utils/translations';

const emptyAnalysisCopy = {
  en: 'No expenses recorded yet. Please add some expenses before analyzing your spending.',
  fr: 'Aucune dépense enregistrée pour le moment. Ajoutez des dépenses avant d’analyser vos habitudes.',
  ar: 'لا توجد مصاريف مسجلة بعد. أضف بعض المصاريف قبل تحليل إنفاقك.',
};
for (const language of ['en', 'fr', 'ar'] as const) {
  for (const emptyMonth of [false, true]) {
    test(`empty ${emptyMonth ? 'month' : 'ledger'} analysis uses ${language} copy without a provider request`, async ({ page }) => {
      const requests: string[] = [];
      page.on('request', request => { if (request.url().includes('/api/gemini/')) requests.push(request.url()); });
      await page.goto(`/tests/e2e/components/wp37.html?mode=emptyAnalysis&lang=${language}${emptyMonth ? '&emptyMonth' : ''}`);
      await page.getByRole('button', { name: t(language, 'analyzeBtn'), exact: true }).click();
      const expected = emptyMonth ? t(language, 'noExpensesForAi', { month: getLocalizedMonthName({ year: 2025, month: 12 }, language) }) : emptyAnalysisCopy[language];
      await expect(page.getByText(expected, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: t(language, 'analyzeBtn'), exact: true })).toBeEnabled();
      expect(requests).toEqual([]);
    });
  }
}

test('English truncated expense content keeps its LTR beginning inside Arabic chrome', async ({ page }) => {
  await page.goto('/tests/e2e/components/wp37.html?lang=ar');
  const description = page.getByText('Three Day Summer Trip to the Mediterranean coast', { exact: true }).first();
  await expect(description).toHaveAttribute('dir', 'auto');
  expect(await description.evaluate(el => ({ direction: getComputedStyle(el).direction, overflow: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow }))).toEqual({ direction: 'ltr', overflow: true, ellipsis: 'ellipsis' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('Arabic user text follows content direction in English chrome', async ({ page }) => {
  await page.goto('/tests/e2e/components/wp37.html?lang=en&text=' + encodeURIComponent('رحلة صيفية طويلة إلى البحر المتوسط'));
  const description = page.getByText('رحلة صيفية طويلة إلى البحر المتوسط', { exact: true }).first();
  await expect(description).toHaveAttribute('dir', 'auto');
  expect(await description.evaluate(el => getComputedStyle(el).direction)).toBe('rtl');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('expense description and note inputs follow the typed content', async ({ page }) => {
  await page.goto('/tests/e2e/components/index.html?case=expense&lang=ar');
  const description = page.getByRole('textbox', { name: t('ar', 'descriptionLabel'), exact: true });
  const note = page.getByRole('textbox', { name: t('ar', 'optionalNoteLabel'), exact: true });
  for (const field of [description, note]) {
    await expect(field).toHaveAttribute('dir', 'auto');
    await field.fill('2026 Summer Trip');
    expect(await field.evaluate(el => getComputedStyle(el).direction)).toBe('ltr');
    await field.fill('رحلة صيفية');
    expect(await field.evaluate(el => getComputedStyle(el).direction)).toBe('rtl');
  }
});

test('Arabic legal Back uses a directional back arrow and retains navigation', async ({ page }) => {
  await page.goto('/tests/e2e/components/wp37.html?lang=ar&mode=legal');
  const back = page.getByRole('button', { name: 'رجوع', exact: true });
  await expect(back.locator('svg.lucide-arrow-right')).toHaveCount(1);
  await back.click();
  await expect(page.locator('body')).toHaveAttribute('data-closed', 'true');
});

test('expense detail isolates English description and Arabic note independently', async ({ page }) => {
  await page.goto('/tests/e2e/components/wp37.html?lang=ar&mode=detail');
  for (const [text, direction] of [['Three Day Summer Trip to the Mediterranean coast', 'ltr'], ['ملاحظة عربية', 'rtl']]) {
    const content = page.getByText(text, { exact: true });
    await expect(content).toHaveAttribute('dir', 'auto');
    expect(await content.evaluate(el => getComputedStyle(el).direction)).toBe(direction);
  }
});

test('Media Library thumbnail and preview preserve content direction in Arabic chrome', async ({ page }) => {
  await page.goto('/tests/e2e/components/wp37.html?lang=ar&mode=media');
  const thumbnail = page.getByText('Three Day Summer Trip to the Mediterranean coast', { exact: true });
  await expect(thumbnail).toHaveAttribute('dir', 'auto');
  expect(await thumbnail.evaluate(el => getComputedStyle(el).direction)).toBe('ltr');
  await thumbnail.click();
  const preview = page.getByRole('dialog');
  await expect(preview).toBeVisible();
  const descriptions = preview.getByText('Three Day Summer Trip to the Mediterranean coast', { exact: true });
  await expect(descriptions).toHaveCount(2);
  for (const description of await descriptions.all()) {
    await expect(description).toHaveAttribute('dir', 'auto');
    expect(await description.evaluate(el => getComputedStyle(el).direction)).toBe('ltr');
  }
});

for (const language of ['en', 'fr', 'ar']) {
  test(`contextual progress belongs to parent, wraps and supports reduced motion in ${language}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/tests/e2e/components/wp37.html?lang=${language}&dark`);
    const colors: string[] = [];
    for (const tone of ['indigo', 'cyan', 'purple']) {
      const panel = page.locator(`[data-feature="${tone}"] .ai-progress`);
      await expect(panel).toHaveAttribute('data-ai-tone', tone);
      await expect(panel.getByRole('status')).toBeVisible();
      colors.push(await panel.locator('.ai-progress-bar').evaluate(el => getComputedStyle(el).backgroundColor));
      expect(await panel.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      expect(await panel.locator('.ai-progress-bar').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await panel.getByRole('button').first().click();
      await expect(page.locator('body')).toHaveAttribute('data-cancelled', 'true');
    }
    expect(new Set(colors).size).toBe(3);
  });
}

for (const stage of ['ready', 'local', 'cancelled', 'error']) {
  test(`${stage} progress is quiet and never animates`, async ({ page }) => {
    await page.goto(`/tests/e2e/components/wp37.html?lang=fr&stage=${stage}`);
    await expect(page.locator('.ai-progress-track')).toHaveCount(0);
    await expect(page.locator('.ai-progress').first().getByRole('status')).toBeVisible();
  });
}
