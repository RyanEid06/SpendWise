import test from 'node:test';
import assert from 'node:assert/strict';
import { trendsRouter } from '../server/routes/trends';
import { geminiService } from '../server/services/GeminiService';
import { createAiFailure } from '../server/geminiReliability';
import { trendFacts } from '../server/validation/trendFacts';
import { matchesGeminiSchema } from '../server/validation/geminiSchema';
import { sanitizeStatistics } from '../server/validation/requests';

const stats = { periodLabel: 'Synthetic period', totalSpent: 100, totalTransactions: 4, averageTransactionAmount: 25,
  overallLargestExpense: null, monthlyStats: [], categoryTrends: [
    { category: 'Food', totalSpent: 60, percentageOfPeriod: 60, trendPercent: 0, trendDirection: 'STABLE', monthlyData: [] },
    { category: 'Transportation', totalSpent: 40, percentageOfPeriod: 40, trendPercent: 0, trendDirection: 'STABLE', monthlyData: [] },
  ] };

test('fact selections pass the actual fail-closed Gemini schema boundary', () => {
  const facts = trendFacts(stats as any, 'USD', 'en');
  assert.equal(matchesGeminiSchema({ observationIds: [], categoryIds: ['category-0'] }, facts.schema), true);
});

test('trend facts compare complete months, exclude the partial month, and preserve zero-base uncertainty', () => {
  const input = { ...stats, monthlyStats: [
    { monthKey: '2026-08', totalSpent: 20, transactionCount: 1, startingBudget: 0, remainingMoney: -20, isPartialMonth: false },
    { monthKey: '2026-09', totalSpent: 40, transactionCount: 1, startingBudget: 0, remainingMoney: -40, isPartialMonth: false },
    { monthKey: '2026-10', totalSpent: 1, transactionCount: 1, startingBudget: 0, remainingMoney: -1, isPartialMonth: true },
  ], categoryTrends: [{ ...stats.categoryTrends[0], monthlyData: [
    { monthKey: '2026-08', amount: 20, count: 1 }, { monthKey: '2026-09', amount: 40, count: 1 }, { monthKey: '2026-10', amount: 1, count: 1 },
  ] }] };
  const catalog = trendFacts(sanitizeStatistics(input)!, 'USD', 'en').catalog;
  const changes = catalog.observations.filter(fact => fact.id.startsWith('trend-'));
  assert.equal(changes.length, 1);
  assert.match(changes[0].text, /100%/);
  assert.match(changes[0].text, /2026-08.*2026-09/);
  assert.doesNotMatch(changes[0].text, /2026-10/);
  input.categoryTrends[0].monthlyData[0].amount = 0;
  assert.equal(trendFacts(sanitizeStatistics(input)!, 'USD', 'en').catalog.observations.filter(f => f.id.startsWith('trend-')).length, 0);
});

test('rank ties, zero totals and empty history do not invent a trend or a category winner', () => {
  const tied = trendFacts({ ...stats, categoryTrends: stats.categoryTrends.map(c => ({ ...c, totalSpent: 50 })) } as any, 'USD', 'en');
  assert.ok(tied.catalog.categories.every(fact => fact.text.includes('rank 1')));
  const empty = trendFacts({ ...stats, totalSpent: 0, totalTransactions: 0, categoryTrends: [] } as any, 'USD', 'en');
  assert.deepEqual(empty.catalog, { observations: [], categories: [] });
  assert.ok(empty.validate({ observationIds: [], categoryIds: [] }));
});

async function invoke(value: unknown, language = 'en') {
  const original = geminiService.generateJson;
  geminiService.generateJson = async request => {
    const parsed = request.validate(value);
    if (parsed == null) throw createAiFailure('AI_INVALID_RESPONSE');
    return parsed;
  };
  let status = 200; let payload: any;
  const res: any = { locals: {}, status(s: number) { status = s; return this; }, json(v: any) { payload = v; return this; } };
  try {
    await (trendsRouter as any).stack[0].route.stack[0].handle({ body: { stats, currencyCode: 'USD', language } }, res);
    return { status, payload };
  } finally { geminiService.generateJson = original; }
}

for (const summary of [
  'You spent $999.', 'Transportation represents 80%.', 'Transportation is the largest category.',
  'Spending fell despite no comparable history.', 'You bought a yacht.', 'You spent $100 but Food is only 40%.',
]) test(`valid JSON with unverified statistical prose is rejected: ${summary}`, async () => {
  const result = await invoke({ summary, keyObservations: [], categoryHighlights: [], recommendation: 'Spend less.' });
  assert.equal(result.status, 502);
  assert.equal(result.payload.error, 'AI_INVALID_RESPONSE');
});

test('Gemini can select verified facts but cannot supply totals, percentages, rankings or prose', async () => {
  const result = await invoke({ observationIds: [], categoryIds: ['category-0', 'category-1'] });
  assert.equal(result.status, 200);
  assert.equal(result.payload.isAiGenerated, true);
  assert.match(result.payload.summary, /100/);
  assert.match(result.payload.summary, /4/);
  assert.match(result.payload.summary, /25/);
  assert.match(result.payload.categoryHighlights[0], /Food & Beverage.*60/);
  assert.match(result.payload.categoryHighlights[1], /Transportation.*40/);
  assert.ok(!JSON.stringify(result.payload).includes('999'));
});

test('unknown, duplicate, wrong-section and oversized selections fail closed without a retry', async () => {
  for (const value of [
    { observationIds: [], categoryIds: ['invented'] },
    { observationIds: [], categoryIds: ['category-0', 'category-0'] },
    { observationIds: ['category-0'], categoryIds: [] },
    { observationIds: [], categoryIds: [], summary: '999' },
    { observationIds: [], categoryIds: Array(11).fill('category-0') },
  ]) assert.equal((await invoke(value)).status, 502);
});

for (const [language, label] of [['fr', 'Restauration et boissons'], ['ar', 'الطعام والمشروبات']] as const) {
  test(`verified statistics render the current localized category in ${language}`, async () => {
    const result = await invoke({ observationIds: [], categoryIds: ['category-0'] }, language);
    assert.equal(result.status, 200);
    assert.ok(result.payload.categoryHighlights[0].includes(label));
  });
}
