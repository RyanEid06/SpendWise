import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisRouter } from '../server/routes/analysis';
import { geminiService } from '../server/services/GeminiService';
import { createAiFailure } from '../server/geminiReliability';
import { SpendingAnalyzer } from '../src/utils/spendingAnalyzer';
import { matchesGeminiSchema } from '../server/validation/geminiSchema';
import { spendingFacts } from '../server/validation/spendingFacts';
import { parseAnalysisResult } from '../src/utils/aiResultValidation';

const summary = new SpendingAnalyzer().computeHistoricalSummary([
  { id: 1, amount: 12.5, description: 'Synthetic coffee', category: 'Food', date: Date.UTC(2026, 9, 1), note: null, createdAt: 1 },
  { id: 2, amount: 37.5, description: 'Synthetic groceries', category: 'Groceries', date: Date.UTC(2026, 9, 2), note: null, createdAt: 2 },
  { id: 3, amount: 100, description: 'Synthetic prior groceries', category: 'Groceries', date: Date.UTC(2026, 8, 1), note: null, createdAt: 3 },
], { year: 2026, month: 10 });

async function invoke(value: unknown, language = 'en') {
  const original = geminiService.generateJson;
  geminiService.generateJson = async request => {
    if (!matchesGeminiSchema(value, request.responseJsonSchema)) throw createAiFailure('AI_INVALID_RESPONSE');
    const parsed = request.validate(value);
    if (parsed == null) throw createAiFailure('AI_INVALID_RESPONSE');
    return parsed;
  };
  let status = 200; let payload: any;
  const res: any = { locals: {}, status(s: number) { status = s; return this; }, json(v: any) { payload = v; return this; } };
  try {
    await (analysisRouter as any).stack[0].route.stack[0].handle({ body: { summary, currencyCode: 'USD', language } }, res);
    return { status, payload };
  } finally { geminiService.generateJson = original; }
}

test('spending rejects fabricated transactions/totals/trends even when their numbers occur in the input', async () => {
  for (const spendingOverview of ['You spent 100 on a yacht this month', 'Spending increased this month']) {
    const result = await invoke({ spendingOverview, historyContext: '', biggestChanges: [], unusualExpenses: [], recurringSpending: [], areasToReview: [] });
    assert.equal(result.status, 502); assert.equal(result.payload.error, 'AI_INVALID_RESPONSE');
  }
});

test('spending accepts only verified fact IDs and preserves localized public response groups', async () => {
  for (const [language, name] of [['en', 'Food & Beverage'], ['fr', 'Restauration et boissons'], ['ar', 'الطعام والمشروبات']]) {
    const result = await invoke({ insightIds: ['category-0'] }, language);
    assert.equal(result.status, 200); assert.equal(result.payload.analyzedMonthKey, '2026-10');
    assert.equal(result.payload.isAiGenerated, true); assert.ok(result.payload.areasToReview[0].title.includes(name));
    assert.ok(parseAnalysisResult(result.payload, '2026-10'));
    assert.equal(result.payload.areasToReview[0].category, 'Food');
    assert.equal(result.payload.biggestChanges.length, 0); assert.equal(result.payload.recurringSpending.length, 0);
    assert.doesNotMatch(JSON.stringify(result.payload), /yacht|increased/);
  }
});

test('spending facts preserve measured values and avoid trend claims for sparse/partial history', () => {
  const facts = spendingFacts(summary, 'USD', 'en');
  const valid = facts.validate({ insightIds: ['category-0', 'comparison-1'] })!;
  assert.match(valid.spendingOverview, /\$50\.00/);
  assert.match(valid.biggestChanges[0].numbers, /37\.50.*100\.00/);
  assert.match(valid.biggestChanges[0].explanation, /may be incomplete/);
  const empty = spendingFacts({ ...summary, currentMonthTotal: 0, previousMonthTotal: null, historicalMonthlyAverage: 0,
    totalMonthsRecorded: 0, categoryBaselines: [], recurringCandidates: [], currentMonthExpenses: [] }, 'USD', 'en');
  assert.deepEqual(empty.catalog, []);
  assert.match(empty.validate({ insightIds: [] })!.spendingOverview, /\$0\.00/);
  const repeated = spendingFacts({ ...summary, recurringCandidates: [{ descriptionGroup: 'Synthetic coffee', category: 'Food',
    countThisMonth: 3, totalAmountThisMonth: 37.5, averageAmount: 12.5 }] }, 'USD', 'en');
  const selected = repeated.validate({ insightIds: ['recurring-0'] })!;
  assert.match(selected.recurringSpending[0].explanation, /3 transactions totaling \$37\.50/);
  assert.equal(selected.unusualExpenses.length, 0);
});

test('unknown/duplicate/oversized IDs and extra free prose fail the spending quality gate', async () => {
  for (const value of [{ insightIds: ['invented'] }, { insightIds: ['category-0', 'category-0'] },
    { insightIds: Array(4).fill('category-0') }, { insightIds: [], spendingOverview: 'invented' }, { insightIds: ['month-0'] }]) {
    assert.equal((await invoke(value)).status, 502);
  }
});
