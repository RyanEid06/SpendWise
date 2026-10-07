import { expect, test } from '@playwright/test';
import { t } from '../../../src/utils/translations';

for (const language of ['en', 'fr', 'ar'] as const) {
  test(`protected editor keeps Note and Save reachable in ${language} at IME height`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 390 });
    await page.goto(`/tests/e2e/components/index.html?case=expense&protect=1&lang=${language}`);
    const editor = page.getByRole('dialog');
    const note = editor.getByRole('textbox', { name: t(language, 'optionalNoteLabel') });
    await note.fill('WP05 note '.repeat(50));
    await note.focus();
    await expect(note).toBeInViewport();
    const save = editor.getByRole('button', { name: t(language, 'saveExpenseBtn') });
    const bounds = (await save.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(editor.getByTestId('draft-status')).not.toHaveText(/Could not|impossible|تعذرت/);
  });
}
