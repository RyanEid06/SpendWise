import { expect, test } from '@playwright/test';
import { t } from '../../../src/utils/translations';
import { statisticsText } from '../../../src/features/statistics/copy';
import { mockReadyAuthenticatedBackend } from '../browser/helpers';

for (const language of ['en','fr','ar'] as const) {
  test(`Statistics full-period data survives All-Time detail disclosure in ${language}`, async ({page}) => {
    await mockReadyAuthenticatedBackend(page);
    await page.goto(`/tests/e2e/components/index.html?case=statistics&lang=${language}`);
    await expect(page.getByRole('tablist',{name:statisticsText(language,'timePeriod')})).toBeVisible();
    await expect(page.locator('h2')).toHaveCount(1);
    const detail = page.locator('[data-statistics-month-detail]');
    for (const [key,count] of [['period3M',3],['period6M',6],['period12M',12]] as const) {
      await page.getByRole('tab',{name:t(language,key),exact:true}).click();
      await expect(detail).toHaveCount(count);
    }
    await page.getByRole('tab',{name:t(language,'periodAll'),exact:true}).click();
    await expect(detail).toHaveCount(6);
    await expect(detail.first()).toHaveAttribute('data-statistics-month-detail','2025-07');
    await expect(detail.last()).toHaveAttribute('data-statistics-month-detail','2025-12');
    await expect(page.locator('[data-statistics-chart-month]')).toHaveCount(36);
    await expect(page.locator('[data-stat-summary-cell]').first()).toContainText('$360.00');
    await expect(page.locator('[data-category-spend-base]').first()).toContainText('$360.00');
    const showAll = page.getByRole('button',{name:statisticsText(language,'showAllMonths',{count:36}),exact:true});
    await showAll.click();
    await expect(detail).toHaveCount(36);
    await page.getByRole('button',{name:statisticsText(language,'showLatest'),exact:true}).click();
    await expect(detail).toHaveCount(6);
    await showAll.click();
    await page.getByRole('tab',{name:t(language,'period3M'),exact:true}).click();
    await expect(detail).toHaveCount(3);
    await page.getByRole('tab',{name:t(language,'periodAll'),exact:true}).click();
    await expect(detail).toHaveCount(6);

    let receivedMonths=0;
    await page.route('**/api/gemini/explain-trends',async route=>{
      receivedMonths=route.request().postDataJSON().stats.monthlyStats.length;
      await route.fulfill({json:{timestamp:1,periodLabel:'All Time',summary:'Verified summary',keyObservations:['Verified observation'],
        categoryHighlights:['Verified category change'],recommendation:''}});
    });
    await page.getByRole('button',{name:t(language,'explainBtn'),exact:true}).click();
    await expect.poll(()=>receivedMonths).toBe(36);
    await expect(page.getByText('Verified category change',{exact:true})).toBeVisible();
    await expect(page.getByText('Verified category change',{exact:true})).toHaveAttribute('dir','auto');
    const userDescription=page.getByText('Statistics trip 2025-12',{exact:true}).first();
    await expect(userDescription).toHaveAttribute('dir','auto');
    await expect(userDescription).toHaveCSS('unicode-bidi','isolate');
  });
}
