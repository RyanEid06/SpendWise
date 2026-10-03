import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createBackupV2Archive } from '../src/utils/backupV2';
import type { ExpenseAttachment } from '../src/types';
import type { FinancialState } from '../src/utils/financialState';

const output = process.argv[2] || 'artifacts/android-e2e/fixtures';
await mkdir(output, { recursive: true });
const photoBytes = await readFile(new URL('../tests/fixtures/media/wp32-photo-01.jpg', import.meta.url));
// History opens the emulator's current month. Keep dates and budgets aligned;
// an override makes the same archive generation reproducible in regression tests.
const monthKey = process.env.WP32_FIXTURE_MONTH || new Date().toISOString().slice(0, 7);
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) throw new Error('Invalid WP32 fixture month');
const now = Date.parse(`${monthKey}-01T12:00:00Z`);
const settings = { currencyCode: 'USD', themeMode: 'LIGHT' as const, language: 'en' as const };

const legacy = JSON.parse(await readFile(new URL('../tests/fixtures/backup-v1.json', import.meta.url), 'utf8'));
legacy.metadata.exportedAt = now;
legacy.metadata.exportedAtFormatted = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
legacy.expenses.forEach((expense: { date: number; dateFormatted: string; createdAt: number }, index: number) => {
  expense.date = now + index * 3_600_000;
  expense.createdAt = expense.date;
  expense.dateFormatted = new Date(expense.date).toISOString().slice(0, 10);
});
legacy.monthlyBudgets.forEach((budget: { monthKey: string; updatedAt: number }) => {
  budget.monthKey = monthKey;
  budget.updatedAt = now;
});
await writeFile(path.join(output, 'wp32-v1.json'), JSON.stringify(legacy, null, 2));

function attachment(id: string, expenseId: number): ExpenseAttachment {
  return {
    id, expenseId, storageKey: 'expense-attachments/' + id + '.jpg',
    mimeType: 'image/jpeg', createdAt: now, originalFilename: 'wp32-photo.jpg',
    kind: 'proof', byteSize: photoBytes.byteLength, width: 1024, height: 1024,
  };
}

async function save(name: string, state: FinancialState, includeMedia: boolean) {
  const blob = await createBackupV2Archive({
    appVersion: '1.4.0-wp32-fixture', state, settings, includeMedia,
    readMedia: async () => new Blob([photoBytes], { type: 'image/jpeg' }),
  });
  await writeFile(path.join(output, name), Buffer.from(await blob.arrayBuffer()));
}

await save('wp32-v2-data.zip', {
  expenses: [{ id: 201, amount: 21.5, description: 'WP32 V2 Data', category: 'Food & Dining', date: now, note: 'synthetic data-only compatibility fixture', createdAt: now }],
  budgets: [{ monthKey, startingAmount: 1250, updatedAt: now }],
  attachments: [], currencyCode: 'USD',
}, false);

await save('wp32-v2-full.zip', {
  expenses: [{ id: 202, amount: 45.75, description: 'WP32 V2 Full', category: 'Transportation', date: now, note: 'synthetic full compatibility fixture', createdAt: now }],
  budgets: [{ monthKey, startingAmount: 1250, updatedAt: now }],
  attachments: [attachment('wp32-v2-photo', 202)], currencyCode: 'USD',
}, true);

console.log('Generated WP32 portable fixtures in ' + output);
