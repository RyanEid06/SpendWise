import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ExpenseService } from '../src/features/expenses/ExpenseService';
import { parseServerConfig } from '../server/config';
import { tokenMatches } from '../server/middleware/authentication';
import { consumeRateLimit } from '../server/middleware/rateLimit';
import {
  safeCurrency,
  safeLanguage,
  safeString,
  sanitizeHistoricalSummary,
} from '../server/validation/requests';

const read = (path: string) => readFileSync(path, 'utf8');

test('WP27 defines focused repository contracts without React or SQL leakage', () => {
  for (const path of [
    'src/data/ExpenseRepository.ts',
    'src/data/BudgetRepository.ts',
    'src/data/PreferencesRepository.ts',
    'src/data/AttachmentMetadataRepository.ts',
  ]) {
    const source = read(path);
    assert.match(source, /export interface/);
    assert.doesNotMatch(source, /from 'react'|SELECT |INSERT |UPDATE |DELETE /i);
  }
});

test('ExpenseService preserves create update delete budget and currency orchestration', async () => {
  let expenses: any[] = [];
  let budgets: any[] = [];
  let currency = 'USD';
  let nextId = 1;
  const deletedMedia: any[][] = [];

  const expenseRepo: any = {
    list: () => expenses.map((item) => ({ ...item })),
    nextId: () => nextId++,
    createWithAttachments: async (expense: any) => { expenses.push({ ...expense }); },
    updateWithAttachments: async (expense: any) => {
      expenses = expenses.map((item) => item.id === expense.id ? { ...expense } : item);
    },
    deleteMany: async (ids: number[]) => {
      expenses = expenses.filter((item) => !ids.includes(item.id));
      return [{ id: 'a', expenseId: ids[0], storageKey: 'x' }];
    },
    getCurrencyCode: () => currency,
    setCurrencyCode: async (code: string) => { currency = code; },
    replaceLedgerAmountsAndCurrency: async (nextExpenses: any[], nextBudgets: any[], code: string) => {
      expenses = nextExpenses.map((item) => ({ ...item }));
      budgets = nextBudgets.map((item) => ({ ...item }));
      currency = code;
    },
    clearFinancialData: async () => {
      expenses = [];
      budgets = [];
      return [];
    },
  };

  const budgetRepo: any = {
    list: () => budgets.map((item) => ({ ...item })),
    upsert: async (monthKey: string, startingAmount: number, updatedAt: number) => {
      const next = { monthKey, startingAmount, updatedAt };
      const index = budgets.findIndex((item) => item.monthKey === monthKey);
      if (index >= 0) budgets[index] = next;
      else budgets.push(next);
    },
  };

  const media: any = {
    prepareExpenseAttachmentChanges: async () => ({
      nextAttachments: [],
      stagedAttachments: [],
      removedAttachments: [],
    }),
    deleteDetachedFiles: async (items: any[]) => { deletedMedia.push(items); },
  };

  const service = new ExpenseService(expenseRepo, budgetRepo, media);
  const emptyAttachments = { newAttachments: [], removedAttachmentIds: [] };

  const created = await service.create(
    { amount: 10, description: 'Lunch', category: 'Food', date: 1_780_000_000_000, note: null },
    emptyAttachments
  );
  assert.equal(created.id, 1);
  assert.equal(service.listExpenses().length, 1);

  await service.update({ ...created, amount: 20 }, emptyAttachments);
  assert.equal(service.listExpenses()[0].amount, 20);

  await service.upsertBudget('2026-09', 100);
  assert.equal(service.listBudgets()[0].startingAmount, 100);

  await service.changeCurrency('EUR', 2);
  assert.equal(service.getCurrencyCode(), 'EUR');
  assert.equal(service.listExpenses()[0].amount, 40);
  assert.equal(service.listBudgets()[0].startingAmount, 200);

  await service.permanentDelete([created.id]);
  assert.equal(service.listExpenses().length, 0);
  assert.equal(deletedMedia.filter((items) => items.length > 0).length, 1);
  assert.equal(deletedMedia.at(-1)?.[0]?.id, 'a');
});

test('WP27 hooks consume focused services rather than StorageManager', () => {
  for (const path of [
    'src/app/hooks/useExpenseLedger.ts',
    'src/app/hooks/useExpenseDeleteUndo.ts',
    'src/app/hooks/useThemeLanguage.ts',
    'src/app/hooks/useAppLockLifecycle.ts',
  ]) {
    assert.doesNotMatch(read(path), /StorageManager/, path);
  }
  assert.match(read('src/app/hooks/useExpenseLedger.ts'), /expenseService\.changeCurrency/);
  assert.match(read('src/app/hooks/useExpenseDeleteUndo.ts'), /expenseService\.permanentDelete/);
});

test('Preferences repository excludes raw PIN and future cryptographic secrets', () => {
  const preferences = read('src/data/PreferencesRepository.ts');
  assert.doesNotMatch(preferences, /getLockPin|setLockPin|DB encryption key|media key|backup passphrase|private key/i);
  assert.match(read('src/features/security/LegacyAppLockService.ts'), /compatibility boundary for the v1\.4 plaintext custom PIN/i);
});

test('Settings is decomposed while preserving approved overview ordering', () => {
  const screen = read('src/screens/SettingsScreen.tsx');
  const overview = read('src/features/settings/SettingsOverview.tsx');
  const copy = read('src/features/settings/settingsCopy.ts');

  assert.match(screen, /<SettingsOverview/);
  assert.match(screen, /backupService\.createV3/);
  assert.match(screen, /backupService\.restoreV2/);
  assert.match(screen, /mediaService\.getStorageSummary/);
  assert.match(screen, /onSetWebPin\(newPin\)/);
  assert.doesNotMatch(screen, /legacyAppLockService|BiometricPrompt|AndroidKeyStore|KeyGenParameterSpec/);
  assert.doesNotMatch(screen, /StorageManager/);

  const order = [
    'label={copy.appearance}',
    'label={copy.language}',
    'label={copy.currency}',
    'label={copy.appLock}',
    'label={copy.storage}',
    'label={copy.backup}',
    'label={copy.reviewSetup}',
    'label={copy.terms}',
    'label={copy.privacy}',
    'label={copy.clearData}',
  ].map((marker) => overview.indexOf(marker));
  for (const index of order) assert.ok(index >= 0, 'missing Settings marker');
  for (let index = 1; index < order.length; index += 1) {
    assert.ok(order[index - 1] < order[index], 'Settings order regressed');
  }

  for (const marker of ['en: {', 'fr: {', 'ar: {']) assert.ok(copy.includes(marker));
  assert.match(overview, /data-inline-settings="appearance"/);
  assert.match(overview, /data-inline-settings="language"/);
  assert.match(overview, /data-inline-settings="currency"/);
});

test('backend config preserves production limits and model fallback defaults', () => {
  const config = parseServerConfig({});
  assert.equal(config.maxImageBase64Length, 12_000_000);
  assert.equal(config.rateWindowMs, 60_000);
  assert.equal(config.rateLimit, 30);
  assert.equal(config.rateBucketMaxEntries, 2_000);
  assert.equal(config.geminiTimeoutMs, 50_000);
  assert.deepEqual(config.geminiFallbackModels, ['gemini-3.7-flash', 'gemini-3.5-flash-lite']);
});

test('backend authentication and rate limiting are independently testable', () => {
  assert.equal(tokenMatches('same-token', 'same-token'), true);
  assert.equal(tokenMatches('same-token', 'other-token'), false);

  const buckets = new Map<string, { count: number; resetAt: number }>();
  assert.equal(consumeRateLimit(buckets, 'ip', 1000, 60_000, 2).allowed, true);
  assert.equal(consumeRateLimit(buckets, 'ip', 1001, 60_000, 2).allowed, true);
  const blocked = consumeRateLimit(buckets, 'ip', 1002, 60_000, 2);
  assert.equal(blocked.allowed, false);
  assert.ok((blocked.retryAfterSeconds ?? 0) > 0);
});

test('backend validation remains bounded before provider execution', () => {
  assert.equal(safeString('abcdef', 3), 'abc');
  assert.equal(safeCurrency('USD'), 'USD');
  assert.equal(safeCurrency('BTC'), null);
  assert.equal(safeLanguage('ar'), 'ar');
  assert.equal(safeLanguage('de'), null);
  assert.equal(sanitizeHistoricalSummary(null), null);

  const smartRoute = read('server/routes/smartCapture.ts');
  const receiptRoute = read('server/routes/receiptScan.ts');
  for (const route of [smartRoute, receiptRoute]) {
    assert.match(route, /maxImageBase64Length/);
    assert.match(route, /geminiService\.generateJson/);
    assert.ok(route.indexOf('maxImageBase64Length') < route.indexOf('geminiService.generateJson'));
  }
});

test('provider calls and normalized failures are behind dedicated backend boundaries', () => {
  const service = read('server/services/GeminiService.ts');
  const errors = read('server/middleware/errors.ts');
  assert.match(service, /GoogleGenAI/);
  assert.match(service, /executeGeminiJsonWithModelFallback/);
  assert.match(errors, /AiReliabilityError/);

  for (const route of [
    'server/routes/analysis.ts',
    'server/routes/trends.ts',
    'server/routes/smartCapture.ts',
    'server/routes/receiptScan.ts',
  ]) {
    const source = read(route);
    assert.doesNotMatch(source, /GoogleGenAI|models\.generateContent/);
  }
});

test('logging boundary stays metadata-only', () => {
  const logging = read('server/logging/aiLogging.ts');
  assert.match(logging, /endpoint: details\.endpoint/);
  assert.match(logging, /requestId: details\.requestId/);
  assert.doesNotMatch(logging, /description|amount|budget|receipt|imageBase64|PIN|apiKey|token/i);
});

test('WP27 secure seams remain the only app-facing owners after WP28 implementation', () => {
  const key = read('src/security/SecureKeyService.ts');
  const session = read('src/security/SecureSessionService.ts');
  const hook = read('src/app/hooks/useAppLockLifecycle.ts');
  const settings = read('src/screens/SettingsScreen.tsx');
  assert.match(key, /export interface SecureKeyService/);
  assert.match(session, /export interface SecureSessionService/);
  assert.match(hook, /secureSessionService/);
  for (const source of [hook, settings, session]) {
    assert.doesNotMatch(source, /BiometricPrompt|AndroidKeyStore|KeyGenParameterSpec|WindowManager\.LayoutParams\.FLAG_SECURE/);
  }
  assert.doesNotMatch(key, /BiometricPrompt|AndroidKeyStore|KeyGenParameterSpec/);
});

test('WP27 preserves approved release metadata', () => {
  const packageJson = JSON.parse(read('package.json')) as { version: string };
  const versionJson = JSON.parse(read('version.json')) as { versionName: string; versionCode: number };
  assert.equal(packageJson.version, '2.1.0');
  assert.equal(versionJson.versionName, '2.1.0');
  assert.equal(versionJson.versionCode, 10);
});
