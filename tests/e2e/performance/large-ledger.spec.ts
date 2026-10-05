import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { BENCHMARK_SIZES, FIXTURE_CLOCK, FIXTURE_SEED, createSyntheticLedger } from '../../../scripts/wp33/fixtures';

for (const size of BENCHMARK_SIZES) for (const distribution of ['distributed', 'concentrated'] as const) {
  test(`synthetic ${size} ${distribution}: actual History and Statistics rendering stays correct`, async ({ page, browser }, testInfo) => {
    // Date is fixed; performance.now, requestAnimationFrame and timers remain real.
    await page.clock.setFixedTime(FIXTURE_CLOCK);
    const state = createSyntheticLedger(size);
    const monthly = distribution === 'concentrated' ? state.expenses.map((item, index) => ({ ...item, date: Date.UTC(2026, 9, 1 + index % 28, 12), createdAt: Date.UTC(2026, 9, 1 + index % 28, 12) + index })) : state.expenses.filter((item) => new Date(item.date).getUTCMonth() === 9);
    const expectedSearch = monthly.filter((item) => item.description.toLowerCase().includes('fixture 17'));
    const rows: unknown[] = [];
    for (let sample = 0; sample < 5; sample++) {
      await page.goto(`/tests/e2e/performance/index.html?screen=history&size=${size}&distribution=${distribution}`);
      await page.waitForFunction(() => Boolean((window as any).__WP33_METRICS__?.profiles.length));
      expect(await page.evaluate(() => Date.now())).toBe(FIXTURE_CLOCK);
      const deleteButtons = page.locator('button[aria-label^="Delete expense: Fixture "]');
      await expect(deleteButtons).toHaveCount(monthly.length);
      const initial = await page.evaluate(() => (window as any).__WP33_METRICS__);
      const searchStart = await page.evaluate(() => performance.now());
      await page.getByRole('searchbox').fill('fixture 17');
      await expect(deleteButtons).toHaveCount(expectedSearch.length);
      const search = await page.evaluate(async (started) => { await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); return { wallMs: performance.now() - started, profile: (window as any).__WP33_METRICS__.profiles.at(-1) }; }, searchStart);
      // Read every visible synthetic description, including deterministic order after search.
      const renderedDescriptions = await deleteButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')!.slice('Delete expense: '.length)));
      const sorted = [...expectedSearch].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt).map((item) => item.description);
      expect(renderedDescriptions).toEqual(sorted);
      rows.push({ sample, operation: 'history', size, distribution, initial, search, renderedCount: monthly.length, searchedCount: expectedSearch.length });

      await page.goto(`/tests/e2e/performance/index.html?screen=statistics&size=${size}&distribution=${distribution}`);
      await page.waitForFunction(() => Boolean((window as any).__WP33_METRICS__?.profiles.length));
      await page.getByRole('tab', { name: 'All Time', exact: true }).click();
      await expect(page.getByText(`${size} total transactions`, { exact: true })).toBeVisible();
      const total = state.expenses.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
      const formatted = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      await expect(page.getByText(formatted, { exact: true }).first()).toBeVisible();
      if (size) { await page.getByRole('button', { name: /^Expand category:/ }).first().click(); await expect(page.locator('button[aria-expanded="true"]').first()).toBeVisible(); }
      const statistics = await page.evaluate(() => (window as any).__WP33_METRICS__);
      rows.push({ sample, operation: 'statistics', size, distribution, statistics, totalTransactions: size });
    }
    const output = testInfo.outputPath('browser-measurements.json');
    await writeFile(output, JSON.stringify({ format: 'spendwise-browser-benchmark-v1', browser: browser.version(), environment: 'pinned-chromium-react-development-harness', timezone: 'UTC', fixture: { seed: FIXTURE_SEED, clockTimestamp: FIXTURE_CLOCK, version: 1 }, timingPolicy: 'warning-only; browser and Node timings are separate', rows }, null, 2));
    await testInfo.attach('browser-measurements', { path: output, contentType: 'application/json' });
  });
}
