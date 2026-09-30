import { AiAnalysisResult, InsightCardItem } from '../types';

const severityWeight: Record<InsightCardItem['severity'], number> = {
  REVIEW: 4,
  NOTABLE: 3,
  INFO: 2,
  POSITIVE: 1,
};

export interface SelectedInsight {
  item: InsightCardItem;
  source: 'areasToReview' | 'biggestChanges' | 'recurringSpending' | 'unusualExpenses';
}

export function selectPrimaryInsights(result: AiAnalysisResult, limit = 3): SelectedInsight[] {
  const candidates: SelectedInsight[] = [
    ...result.areasToReview.map((item) => ({ item, source: 'areasToReview' as const })),
    ...result.biggestChanges.map((item) => ({ item, source: 'biggestChanges' as const })),
    ...result.recurringSpending.map((item) => ({ item, source: 'recurringSpending' as const })),
    ...result.unusualExpenses.map((item) => ({ item, source: 'unusualExpenses' as const })),
  ];

  const seen = new Set<string>();
  return candidates
    .filter(({ item }) => {
      const key = [item.category || '', item.title.trim().toLocaleLowerCase()].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => severityWeight[b.item.severity] - severityWeight[a.item.severity])
    .slice(0, Math.max(0, Math.min(3, limit)));
}
