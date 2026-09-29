import React from 'react';
import {
  Sparkles,
  TrendingUp,
  RotateCw,
  Search,
  Repeat,
  AlertTriangle,
  Brain,
  Info,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { AiAnalysisResult, InsightCardItem, InsightSeverity, Language } from '../types';
import { MonthYear } from '../utils/date';
import { MonthSelector } from '../components/MonthSelector';
import { getCategoryInfo } from '../utils/categories';
import { getLocalizedCategoryName, getLocalizedMonthName, t } from '../utils/translations';

interface AiInsightsScreenProps {
  currentMonthYear: MonthYear;
  analysisResult: AiAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  language: Language;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onAnalyzeClick: () => void;
}

export const AiInsightsScreen: React.FC<AiInsightsScreenProps> = ({
  currentMonthYear,
  analysisResult,
  isLoading,
  error,
  notice,
  language,
  onPreviousMonth,
  onNextMonth,
  onAnalyzeClick,
}) => {
  const monthName = getLocalizedMonthName(currentMonthYear, language);

  return (
    <div className="space-y-4 pb-28 animate-screen-enter">
      {/* Month Selector */}
      <MonthSelector
        currentMonthYear={currentMonthYear}
        language={language}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />

      {/* Hero Action Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/70 dark:from-indigo-950/80 dark:to-[#131B2E] border border-indigo-200 dark:border-indigo-800/60 rounded-3xl p-5 shadow-xs transition-colors">
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/15 dark:bg-indigo-600/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight [overflow-wrap:anywhere]">
              {t(language, 'aiInsightsHeroTitle')}
            </h3>
            <p className="text-xs text-indigo-900/75 dark:text-indigo-200/70">
              {t(language, 'aiInsightsHeroSub', { month: monthName })}
            </p>
          </div>
        </div>

        <button
          onClick={onAnalyzeClick}
          disabled={isLoading}
          className="w-full min-h-[44px] flex items-center justify-center space-x-2 rtl:space-x-reverse py-3 px-4 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer active:scale-[0.99]"
        >
          {isLoading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>{t(language, 'evaluatingStatus')}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{analysisResult ? t(language, 'reanalyzeBtn') : t(language, 'analyzeBtn')}</span>
            </>
          )}
        </button>
      </div>

      {/* States Handling */}
      {isLoading && (
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3.5 shadow-xs">
          <div className="w-12 h-12 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin mx-auto" />
          <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
            {t(language, 'evaluatingStatus')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {t(language, 'evaluatingSub')}
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-base">
            {t(language, 'noticeTitle')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">{error}</p>
          <div className="flex flex-col min-[360px]:flex-row items-stretch min-[360px]:items-center justify-center gap-2 min-[360px]:gap-3 pt-2">
            <button
              onClick={onAnalyzeClick}
              className="min-h-[44px] inline-flex items-center space-x-1 rtl:space-x-reverse border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <span>{t(language, 'tryAgainBtn')}</span>
            </button>
          </div>
        </div>
      )}

      {!analysisResult && !isLoading && !error && (
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Brain className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-base">
            {t(language, 'readyInsightsTitle')}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {t(language, 'readyInsightsSub')}
          </p>
        </div>
      )}

      {analysisResult && !isLoading && (
        <div className="space-y-4">
          {/* Notice Banner if Fallback / Offline */}
          {notice && (
            <div className="bg-indigo-50 dark:bg-[#111928] border border-indigo-200 dark:border-slate-800 rounded-2xl p-3.5 flex items-center space-x-2.5 rtl:space-x-reverse text-xs text-slate-700 dark:text-slate-300">
              <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Section 1: Overview Card */}
          <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-2.5 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="min-w-0 font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                {t(language, 'overviewCardTitle')}
              </h3>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  analysisResult.isAiGenerated
                    ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {analysisResult.isAiGenerated ? t(language, 'geminiBadge') : t(language, 'localBadge')}
              </span>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
              {analysisResult.spendingOverview}
            </p>

            {analysisResult.historyContext && (
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                {analysisResult.historyContext}
              </p>
            )}
          </div>

          {/* Section 2: Biggest Changes */}
          {analysisResult.biggestChanges.length > 0 && (
            <InsightGroupCard
              title={t(language, 'biggestChangesTitle')}
              icon={TrendingUp}
              iconColor="text-indigo-600 dark:text-indigo-400"
              iconBg="bg-indigo-100 dark:bg-indigo-950/80"
              items={analysisResult.biggestChanges}
              language={language}
            />
          )}

          {/* Section 3: Unusual Expenses (Smart Flags) */}
          {analysisResult.unusualExpenses.length > 0 && (
            <InsightGroupCard
              title={t(language, 'unusualExpensesTitle')}
              icon={Search}
              iconColor="text-amber-600 dark:text-amber-400"
              iconBg="bg-amber-100 dark:bg-amber-950/80"
              items={analysisResult.unusualExpenses}
              language={language}
            />
          )}

          {/* Section 4: Recurring Spending */}
          {analysisResult.recurringSpending.length > 0 && (
            <InsightGroupCard
              title={t(language, 'recurringSpendingTitle')}
              icon={Repeat}
              iconColor="text-purple-600 dark:text-purple-400"
              iconBg="bg-purple-100 dark:bg-purple-950/80"
              items={analysisResult.recurringSpending}
              language={language}
            />
          )}

          {/* Section 5: Potential Areas to Review */}
          {analysisResult.areasToReview.length > 0 && (
            <InsightGroupCard
              title={t(language, 'areasToReviewTitle')}
              icon={AlertTriangle}
              iconColor="text-rose-600 dark:text-rose-400"
              iconBg="bg-rose-100 dark:bg-rose-950/80"
              items={analysisResult.areasToReview}
              language={language}
            />
          )}
        </div>
      )}
    </div>
  );
};

interface InsightGroupCardProps {
  title: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  items: InsightCardItem[];
  language: Language;
}

const InsightGroupCard: React.FC<InsightGroupCardProps> = ({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  items,
  language,
}) => {
  return (
    <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
      <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
        <div className={`w-8 h-8 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{title}</h3>
      </div>

      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <InsightRow key={idx} item={item} language={language} />
        ))}
      </div>
    </div>
  );
};

const InsightRow: React.FC<{ item: InsightCardItem; language: Language }> = ({ item, language }) => {
  const catInfo = item.category ? getCategoryInfo(item.category) : null;
  const localizedCat = item.category ? getLocalizedCategoryName(item.category, language) : null;

  const severityBadge = (severity: InsightSeverity) => {
    switch (severity) {
      case 'POSITIVE':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
          label: t(language, 'badgeFavorable'),
          icon: CheckCircle,
        };
      case 'NOTABLE':
        return {
          bg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
          label: t(language, 'badgeNotable'),
          icon: AlertCircle,
        };
      case 'REVIEW':
        return {
          bg: 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50',
          label: t(language, 'badgeReview'),
          icon: AlertTriangle,
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
          label: t(language, 'badgePattern'),
          icon: Info,
        };
    }
  };

  const badge = severityBadge(item.severity);
  const BadgeIcon = badge.icon;

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/80 dark:border-slate-800/60 space-y-1.5 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center space-x-2 rtl:space-x-reverse min-w-0 flex-1">
          {catInfo && <span className="text-base shrink-0" aria-hidden="true">{catInfo.iconEmoji}</span>}
          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
            {item.title}
          </h4>
        </div>
        <span className={`inline-flex items-center space-x-1 rtl:space-x-reverse text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.bg}`}>
          <BadgeIcon className="w-3 h-3" />
          <span>{badge.label}</span>
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        {item.explanation}
      </p>

      {item.numbers && (
        <div dir="ltr" className="pt-0.5 min-w-0 font-bold tabular-nums text-xs text-emerald-600 dark:text-emerald-400 [overflow-wrap:anywhere]">
          {item.numbers}
        </div>
      )}
    </div>
  );
};
