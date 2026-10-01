import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createBackupV2Archive } from '../src/utils/backupV2';
import type { ExpenseAttachment } from '../src/types';
import type { FinancialState } from '../src/utils/financialState';

const output = process.argv[2] || 'artifacts/android-e2e/fixtures';
await mkdir(output, { recursive: true });
const photoBytes = await readFile(new URL('../tests/fixtures/wp32-photo.jpg', import.meta.url));
const now = 1780339200000;
const settings = { currencyCode: 'USD', themeMode: 'LIGHT' as const, language: 'en' as const };

function attachment(id: string, expenseId: number): ExpenseAttachment {
  return {
    id, expenseId, storageKey: 'expense-attachments/' + id + '.jpg',
    mimeType: 'image/jpeg', createdAt: now, originalFilename: 'wp32-photo.jpg',
    kind: 'proof', byteSize: photoBytes.byteLength, width: 1, height: 1,
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
  budgets: [{ monthKey: '2026-10', startingAmount: 1250, updatedAt: now }],
  attachments: [], currencyCode: 'USD',
}, false);

await save('wp32-v2-full.zip', {
  expenses: [{ id: 202, amount: 45.75, description: 'WP32 V2 Full', category: 'Transportation', date: now, note: 'synthetic full compatibility fixture', createdAt: now }],
  budgets: [{ monthKey: '2026-10', startingAmount: 1250, updatedAt: now }],
  attachments: [attachment('wp32-v2-photo', 202)], currencyCode: 'USD',
}, true);

console.log('Generated WP32 portable fixtures in ' + output);
