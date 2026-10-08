import { expect, test } from '@playwright/test';
import { t } from '../../../src/utils/translations';

for (const language of ['en', 'fr', 'ar'] as const) {
  for (const dark of [false, true]) {
    test(`Add/Edit focused fields and actions fit a short IME viewport in ${language}/${dark ? 'dark' : 'light'}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 390 });
      for (const edit of [false, true]) {
        await page.goto(`/tests/e2e/components/index.html?case=expense&lang=${language}${edit ? '&edit=1' : ''}`);
        await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const note = dialog.getByRole('textbox', { name: t(language, 'optionalNoteLabel') });
        await note.fill('Long note '.repeat(45));
        await note.focus();
        const save = dialog.getByRole('button', { name: t(language, edit ? 'updateExpenseBtn' : 'saveExpenseBtn'), exact: true });
        const bounds = await save.boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(390);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        await expect(note).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const categoryButtons = dialog.locator('[data-expense-categories] button');
        await expect(categoryButtons).toHaveCount(12);
        const rows = await categoryButtons.evaluateAll(elements => {
          const counts = new Map<number, number>();
          elements.forEach(element => { const y = Math.round(element.getBoundingClientRect().top); counts.set(y, (counts.get(y) ?? 0) + 1); });
          return [...counts.values()];
        });
        expect(rows.every(count => count === 2)).toBe(true);
      }
    });
  }
}
