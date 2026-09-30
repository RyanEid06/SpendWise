import { Language } from '../types';

export const WP17_COPY = {
  en: {
    all: 'All',
    day: 'Day',
    category: 'Category',
    historyView: 'History view',
    previousDay: 'Previous day',
    nextDay: 'Next day',
    chooseDay: 'Choose day',
    expandCategory: 'Expand category',
    collapseCategory: 'Collapse category',
    deleteHint: 'Swipe to delete',
    deleteAction: 'Delete expense',
    noteAttached: 'Note',
    spendingByCategory: 'Spending by Category',
    trendUp: 'Up',
    trendDown: 'Down',
    trendStable: 'Stable',
    trendUnavailable: 'Not enough history',
    primaryInsights: 'Worth noticing',
    primaryInsightsSub: 'The clearest patterns in your recorded spending.',
    noStrongPattern: 'No strong pattern stands out yet. Keep recording expenses to improve the comparison.',
    expensesCount: '{count} expenses',
  },
  fr: {
    all: 'Tout',
    day: 'Jour',
    category: 'Catégorie',
    historyView: 'Vue de l’historique',
    previousDay: 'Jour précédent',
    nextDay: 'Jour suivant',
    chooseDay: 'Choisir le jour',
    expandCategory: 'Développer la catégorie',
    collapseCategory: 'Réduire la catégorie',
    deleteHint: 'Balayer pour supprimer',
    deleteAction: 'Supprimer la dépense',
    noteAttached: 'Note',
    spendingByCategory: 'Dépenses par catégorie',
    trendUp: 'Hausse',
    trendDown: 'Baisse',
    trendStable: 'Stable',
    trendUnavailable: 'Historique insuffisant',
    primaryInsights: 'À remarquer',
    primaryInsightsSub: 'Les tendances les plus nettes dans vos dépenses enregistrées.',
    noStrongPattern: 'Aucune tendance nette ne ressort encore. Continuez à enregistrer vos dépenses pour améliorer la comparaison.',
    expensesCount: '{count} dépenses',
  },
  ar: {
    all: 'الكل',
    day: 'اليوم',
    category: 'الفئة',
    historyView: 'عرض السجل',
    previousDay: 'اليوم السابق',
    nextDay: 'اليوم التالي',
    chooseDay: 'اختيار اليوم',
    expandCategory: 'توسيع الفئة',
    collapseCategory: 'طي الفئة',
    deleteHint: 'اسحب للحذف',
    deleteAction: 'حذف المصروف',
    noteAttached: 'ملاحظة',
    spendingByCategory: 'الإنفاق حسب الفئة',
    trendUp: 'ارتفاع',
    trendDown: 'انخفاض',
    trendStable: 'مستقر',
    trendUnavailable: 'لا يوجد سجل كافٍ',
    primaryInsights: 'ما يستحق الانتباه',
    primaryInsightsSub: 'أوضح الأنماط في الإنفاق المسجل.',
    noStrongPattern: 'لا يظهر نمط قوي بعد. استمر في تسجيل المصاريف لتحسين المقارنة.',
    expensesCount: '{count} مصاريف',
  },
} as const;

export function wp17Copy(language: Language, key: keyof typeof WP17_COPY.en, values?: Record<string, string | number>): string {
  let text: string = WP17_COPY[language][key];
  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
