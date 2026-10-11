import { getLocalizedCategoryName } from '../../src/utils/translations';
import { asObject, type SupportedLanguage, type sanitizeHistoricalSummary } from './requests';

type Summary = NonNullable<ReturnType<typeof sanitizeHistoricalSummary>>;
type Group = 'biggestChanges' | 'unusualExpenses' | 'recurringSpending' | 'areasToReview';
type Insight = { title: string; explanation: string; numbers: string; category: string; severity: 'INFO' | 'NOTABLE' };

/** Same verified-fact selection boundary as Statistics; provider prose is never rendered. */
export function spendingFacts(summary: Summary, currency: string, language: SupportedLanguage) {
  const text = (en: string, fr: string, ar: string) => language === 'fr' ? fr : language === 'ar' ? ar : en;
  const money = (n: number) => new Intl.NumberFormat(language, { style: 'currency', currency }).format(n);
  const spendingOverview = text(
    `Recorded spending for ${summary.currentMonthKey}: ${money(summary.currentMonthTotal)}.`,
    `Dépenses enregistrées pour ${summary.currentMonthKey} : ${money(summary.currentMonthTotal)}.`,
    `الإنفاق المسجل لشهر ${summary.currentMonthKey}: ${money(summary.currentMonthTotal)}.`);
  const historyContext = text(
    `Recorded history: ${summary.totalMonthsRecorded} months. Historical monthly average: ${money(summary.historicalMonthlyAverage)}.`,
    `Historique enregistré : ${summary.totalMonthsRecorded} mois. Moyenne mensuelle historique : ${money(summary.historicalMonthlyAverage)}.`,
    `السجل المسجل: ${summary.totalMonthsRecorded} أشهر. المتوسط الشهري التاريخي: ${money(summary.historicalMonthlyAverage)}.`);
  const catalog: { id: string; group: Group; insight: Insight }[] = [];
  summary.categoryBaselines.forEach((category, index) => {
    const name = getLocalizedCategoryName(category.category, language);
    const current = money(category.currentMonthTotal);
    const previous = money(category.previousMonthTotal);
    catalog.push({ id: `category-${index}`, group: 'areasToReview', insight: {
      title: name, category: category.category, severity: 'INFO', numbers: current,
      explanation: text(`Recorded ${name} spending for ${summary.currentMonthKey}: ${current}.`,
        `Dépenses enregistrées pour ${name} en ${summary.currentMonthKey} : ${current}.`,
        `الإنفاق المسجل على ${name} لشهر ${summary.currentMonthKey}: ${current}.`),
    } });
    // State both amounts without inferring a full-month trend from a partial month.
    if (summary.previousMonthTotal != null && category.previousMonthTotal > 0) catalog.push({ id: `comparison-${index}`, group: 'biggestChanges', insight: {
      title: name, category: category.category, severity: 'INFO', numbers: `${current} / ${previous}`,
      explanation: text(`Current recorded amount: ${current}; previous month: ${previous}. The current month may be incomplete.`,
        `Montant actuel enregistré : ${current} ; mois précédent : ${previous}. Le mois actuel peut être incomplet.`,
        `المبلغ الحالي المسجل: ${current}؛ الشهر السابق: ${previous}. قد يكون الشهر الحالي غير مكتمل.`),
    } });
  });
  summary.recurringCandidates.forEach((candidate, index) => {
    const name = getLocalizedCategoryName(candidate.category, language);
    const total = money(candidate.totalAmountThisMonth);
    catalog.push({ id: `recurring-${index}`, group: 'recurringSpending', insight: {
      title: candidate.descriptionGroup, category: candidate.category, severity: 'INFO', numbers: `${candidate.countThisMonth} / ${total}`,
      explanation: text(`Recorded ${name} group: ${candidate.countThisMonth} transactions totaling ${total}.`,
        `Groupe enregistré ${name} : ${candidate.countThisMonth} transactions pour un total de ${total}.`,
        `المجموعة المسجلة ${name}: ${candidate.countThisMonth} معاملات بإجمالي ${total}.`),
    } });
  });
  summary.currentMonthExpenses.forEach((expense, index) => {
    const typical = summary.categoryBaselines.find(c => c.category === expense.category)?.typicalTransactionMedian ?? 0;
    if (typical <= 0 || expense.amount < typical * 2.2) return;
    const amount = money(expense.amount); const median = money(typical);
    catalog.push({ id: `purchase-${index}`, group: 'unusualExpenses', insight: {
      title: expense.description, category: expense.category, severity: 'NOTABLE', numbers: `${amount} / ${median}`,
      explanation: text(`Recorded purchase: ${amount}; historical category transaction median: ${median}. A larger purchase is not necessarily harmful.`,
        `Achat enregistré : ${amount} ; médiane historique des transactions de la catégorie : ${median}. Un achat plus élevé n’est pas nécessairement nuisible.`,
        `الشراء المسجل: ${amount}؛ الوسيط التاريخي لمعاملات الفئة: ${median}. الشراء الأكبر ليس بالضرورة ضارًا.`),
    } });
  });
  const schema = { type: 'object', additionalProperties: false, required: ['insightIds'], properties: {
    insightIds: { type: 'array', items: { type: 'string' } },
  } };
  return { catalog, schema, validate(value: unknown) {
    const obj = asObject(value); const ids = obj?.insightIds;
    if (!obj || Object.keys(obj).length !== 1 || !Array.isArray(ids) || ids.length > 3 || new Set(ids).size !== ids.length) return null;
    const groups: Record<Group, Insight[]> = { biggestChanges: [], unusualExpenses: [], recurringSpending: [], areasToReview: [] };
    for (const id of ids) {
      const fact = catalog.find(f => f.id === id);
      if (!fact) return null;
      groups[fact.group].push(fact.insight);
    }
    return { spendingOverview, historyContext, ...groups };
  } };
}
