import { getLocalizedCategoryName } from '../../src/utils/translations';
import { asObject, type SupportedLanguage, sanitizeStatistics } from './requests';

type Statistics = NonNullable<ReturnType<typeof sanitizeStatistics>>;

/** Gemini selects facts; it never authors financial numbers, rankings or conclusions. */
export function trendFacts(stats: Statistics, currency: string, language: SupportedLanguage) {
  const locale = language === 'ar' ? 'ar' : language === 'fr' ? 'fr' : 'en';
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  const average = stats.totalTransactions > 0 ? stats.totalSpent / stats.totalTransactions : 0;
  const summary = language === 'fr'
    ? `Total des dépenses : ${money(stats.totalSpent)} pour ${stats.totalTransactions} transactions. Moyenne : ${money(average)}.`
    : language === 'ar'
      ? `إجمالي الإنفاق: ${money(stats.totalSpent)} عبر ${stats.totalTransactions} معاملات. المتوسط: ${money(average)}.`
      : `Total spending: ${money(stats.totalSpent)} across ${stats.totalTransactions} transactions. Average: ${money(average)}.`;
  const observations = stats.monthlyStats.map((month, index) => ({ id: `month-${index}`, text:
    language === 'fr' ? `${month.monthKey} : dépenses de ${money(month.totalSpent)}.`
      : language === 'ar' ? `${month.monthKey}: الإنفاق ${money(month.totalSpent)}.`
        : `${month.monthKey}: spending of ${money(month.totalSpent)}.` }));
  const completeMonths = [...stats.monthlyStats].filter(month => !month.isPartialMonth).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (completeMonths.length >= 2) {
    const previous = completeMonths.at(-2)!; const latest = completeMonths.at(-1)!;
    stats.categoryTrends.forEach((category, index) => {
      const before = category.monthlyData.find(month => month.monthKey === previous.monthKey);
      const after = category.monthlyData.find(month => month.monthKey === latest.monthKey);
      // Missing/zero-base history is not a percentage decrease or stability claim.
      if (!before || !after || before.amount <= 0) return;
      const change = (after.amount - before.amount) / before.amount;
      if (!Number.isFinite(change)) return;
      const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(change);
      const name = getLocalizedCategoryName(category.category, language);
      observations.push({ id: `trend-${index}`, text: language === 'fr'
        ? `${name} : variation de ${percent} entre les mois complets ${previous.monthKey} et ${latest.monthKey}.`
        : language === 'ar' ? `${name}: تغير بنسبة ${percent} بين الشهرين الكاملين ${previous.monthKey} و${latest.monthKey}.`
          : `${name}: change of ${percent} between complete months ${previous.monthKey} and ${latest.monthKey}.` });
    });
  }
  const ordered = [...stats.categoryTrends].sort((a, b) => b.totalSpent - a.totalSpent || a.category.localeCompare(b.category));
  const categories = ordered.map((category, index) => {
    const name = getLocalizedCategoryName(category.category, language);
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(stats.totalSpent > 0 ? category.totalSpent / stats.totalSpent : 0);
    // Equal totals have the same rank; alphabetical order never invents a winner.
    const rank = ordered.findIndex(item => item.totalSpent === category.totalSpent) + 1;
    return { id: `category-${index}`, text: language === 'fr'
      ? `${name} : ${money(category.totalSpent)}, soit ${percent} des dépenses (rang ${rank}).`
      : language === 'ar' ? `${name}: ${money(category.totalSpent)}، أي ${percent} من الإنفاق (المرتبة ${rank}).`
        : `${name}: ${money(category.totalSpent)}, ${percent} of spending (rank ${rank}).` };
  });
  const recommendation = language === 'fr' ? 'Consultez vos dépenses et votre budget avant de décider de changements.'
    : language === 'ar' ? 'راجع مصروفاتك وميزانيتك قبل اتخاذ قرار بالتغيير.'
      : 'Review your expenses and budget before deciding on changes.';
  const schema = { type: 'object', additionalProperties: false, required: ['observationIds', 'categoryIds'], properties: {
    observationIds: { type: 'array', items: { type: 'string' } },
    categoryIds: { type: 'array', items: { type: 'string' } },
  } };
  const select = (ids: unknown, facts: { id: string; text: string }[]) => {
    if (!Array.isArray(ids) || ids.length > 3 || new Set(ids).size !== ids.length) return null;
    const result: string[] = [];
    for (const id of ids) {
      const fact = facts.find(f => f.id === id);
      if (!fact) return null;
      result.push(fact.text);
    }
    return result;
  };
  return {
    schema, catalog: { observations, categories },
    validate(value: unknown) {
      const obj = asObject(value);
      if (!obj || Object.keys(obj).length !== 2) return null;
      const keyObservations = select(obj.observationIds, observations);
      const categoryHighlights = select(obj.categoryIds, categories);
      if (!keyObservations || !categoryHighlights) return null;
      return { summary, keyObservations, categoryHighlights, recommendation };
    },
  };
}
