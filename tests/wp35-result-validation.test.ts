import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnalysisResult, parseTrendResult } from '../src/utils/aiResultValidation';

test('Analysis ready requires the matching month and validated insight groups', () => {
  const valid = { timestamp: 1, analyzedMonthKey: '2026-10', isAiGenerated: true, spendingOverview: 'Synthetic', historyContext: '',
    biggestChanges: [{ title: 'Food', explanation: 'Review', numbers: '$12.50', severity: 'INFO' }], unusualExpenses: [], recurringSpending: [], areasToReview: [] };
  assert.notEqual(parseAnalysisResult(valid, '2026-10'), null);
  assert.equal(parseAnalysisResult(valid, '2026-09'), null);
  assert.equal(parseAnalysisResult({ ...valid, biggestChanges: [{}] }, '2026-10'), null);
  assert.equal(parseAnalysisResult({ ...valid, isAiGenerated: false }, '2026-10'), null);
});
test('Trend ready rejects malformed responses while accepting existing JSON contract', () => {
  const valid = { timestamp: 1, periodLabel: 'All Time', summary: 'Synthetic', keyObservations: ['Stable'], categoryHighlights: [], recommendation: '' };
  assert.notEqual(parseTrendResult(valid), null);
  for (const data of [null, {}, { ...valid, timestamp: Infinity }, { ...valid, keyObservations: [12] }]) {
    assert.equal(parseTrendResult(data), null);
  }
});

test('Analysis preserves the existing server insight title boundary', () => {
  const result = (length: number) => ({ timestamp: 1, analyzedMonthKey: '2026-10', isAiGenerated: true,
    spendingOverview: 'Synthetic', historyContext: '', biggestChanges: [{ title: 'x'.repeat(length),
      explanation: 'Review', numbers: '$12.50', severity: 'INFO' }], unusualExpenses: [], recurringSpending: [], areasToReview: [] });
  for (const length of [200, 201, 240]) assert.notEqual(parseAnalysisResult(result(length), '2026-10'), null);
  assert.equal(parseAnalysisResult(result(241), '2026-10'), null);
});
