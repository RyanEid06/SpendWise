import type { AiAnalysisResult, AiTrendExplanationResult, InsightCardItem } from '../types';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 10 && value.every(item => text(item, 1000));
const insights = (value: unknown): value is InsightCardItem[] => Array.isArray(value) && value.length <= 10 && value.every(item =>
  object(item) && text(item.title, 240) && text(item.explanation, 2000) && text(item.numbers, 1000) &&
  ['INFO', 'NOTABLE', 'REVIEW', 'POSITIVE'].includes(String(item.severity)) &&
  (item.category == null || text(item.category, 200)));

export function parseAnalysisResult(value: unknown, monthKey: string): AiAnalysisResult | null {
  if (!object(value) || !Number.isFinite(value.timestamp) || value.analyzedMonthKey !== monthKey || value.isAiGenerated !== true ||
    !text(value.spendingOverview, 1200) || !value.spendingOverview.trim() || !text(value.historyContext, 600) ||
    !insights(value.biggestChanges) || !insights(value.unusualExpenses) || !insights(value.recurringSpending) || !insights(value.areasToReview)) return null;
  return value as unknown as AiAnalysisResult;
}

export function parseTrendResult(value: unknown): AiTrendExplanationResult | null {
  if (!object(value) || !Number.isFinite(value.timestamp) || !text(value.periodLabel, 200) ||
    !text(value.summary, 4000) || !value.summary.trim() || !strings(value.keyObservations) || !strings(value.categoryHighlights) ||
    (value.recommendation != null && !text(value.recommendation, 2000))) return null;
  // Retain the WP36 response shape while accepting an omitted optional takeaway.
  // Old backends can return six facts; the new presentation uses one global cap.
  const keyObservations = [...new Set(value.keyObservations)].slice(0, 3);
  const categoryHighlights = [...new Set(value.categoryHighlights)].filter(item => !keyObservations.includes(item)).slice(0, 3-keyObservations.length);
  const generic = new Set([
    'Review your expenses and budget before deciding on changes.',
    'Consultez vos dépenses et votre budget avant de décider de changements.',
    'راجع مصروفاتك وميزانيتك قبل اتخاذ قرار بالتغيير.',
  ]);
  const recommendation = typeof value.recommendation==='string' && !generic.has(value.recommendation) ? value.recommendation : '';
  return {...value, keyObservations, categoryHighlights, recommendation} as unknown as AiTrendExplanationResult;
}
