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
  Plus,
} from 'lucide-react';
import { AiAnalysisResult, InsightCardItem, InsightSeverity } from '../types';
import { MonthYear, getDisplayName } from '../utils/date';
import { MonthSelector } from '../components/MonthSelector';
import { getCategoryInfo } from '../utils/categories';

interface AiInsightsScreenProps {
  currentMonthYear: MonthYear;
  analysisResult: AiAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onAnalyzeClick: () => void;
  onAddExpenseClick: () => void;
}

export const AiInsightsScreen: React.FC<AiInsightsScreenProps> = ({
  currentMonthYear,
  analysisResult,
  isLoading,
  error,
  notice,
  onPreviousMonth,
  onNextMonth,
  onAnalyzeClick,
  onAddExpenseClick,
}) => {
  return (
    <div className="space-y-4 pb-28">
      {/* Month Selector */}
      <MonthSelector
        currentMonthYear={currentMonthYear}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />

      {/* Hero Action Banner */}
      <div className="bg-gradient-to-r from-indigo-950/80 to-[#131B2E] border border-indigo-800/60 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center space-x-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              AI Spending Analysis
            </h3>
            <p className="text-xs text-indigo-200/70">
              Analyze historical patterns for {getDisplayName(currentMonthYear)}
            </p>
          </div>
        </div>

        <button
          onClick={onAnalyzeClick}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isLoading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Analyzing spending patterns...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{analysisResult ? 'Re-Analyze Spending' : 'Analyze My Spending'}</span>
            </>
          )}
        </button>
      </div>

      {/* States Handling */}
      {isLoading && (
        <div className="bg-[#111928] border border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin mx-auto" />
          <h4 className="font-bold text-white text-sm sm:text-base">
            Evaluating personal spending baselines...
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Comparing current month against historical category averages.
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-[#111928] border border-slate-800 rounded-3xl p-6 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/60 text-amber-400 flex items-center justify-center mx-auto">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-white text-base">Notice</h4>
          <p className="text-xs text-slate-300 max-w-md mx-auto">{error}</p>
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={onAddExpenseClick}
              className="inline-flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
            <button
              onClick={onAnalyzeClick}
              className="inline-flex items-center space-x-1 border border-slate-700 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {!analysisResult && !isLoading && !error && (
        <div className="bg-[#111928] border border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 text-indigo-400 flex items-center justify-center mx-auto">
            <Brain className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-white text-base">
            Ready to uncover insights
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Tap &ldquo;Analyze My Spending&rdquo; to evaluate your historical categories, identify
            unusual spikes, and highlight recurring purchases without judgment.
          </p>
        </div>
      )}

      {analysisResult && !isLoading && (
        <div className="space-y-4">
          {/* Notice Banner if Fallback / Offline */}
          {notice && (
            <div className="bg-[#111928] border border-slate-800 rounded-2xl p-3.5 flex items-center space-x-2.5 text-xs text-slate-300">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Section 1: Overview Card */}
          <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm sm:text-base">
                Spending Overview
              </h3>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  analysisResult.isAiGenerated
                    ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {analysisResult.isAiGenerated ? 'Gemini AI' : 'Statistical'}
              </span>
            </div>

            <p className="text-sm text-slate-200 font-medium leading-relaxed">
              {analysisResult.spendingOverview}
            </p>

            {analysisResult.historyContext && (
              <p className="text-xs text-slate-400 pt-1">
                {analysisResult.historyContext}
              </p>
            )}
          </div>

          {/* Section 2: Biggest Changes */}
          {analysisResult.biggestChanges.length > 0 && (
            <InsightGroupCard
              title="Biggest Changes"
              icon={TrendingUp}
              iconColor="text-indigo-400"
              iconBg="bg-indigo-950/80"
              items={analysisResult.biggestChanges}
            />
          )}

          {/* Section 3: Unusual Expenses */}
          {analysisResult.unusualExpenses.length > 0 && (
            <InsightGroupCard
              title="Unusual Expenses"
              icon={Search}
              iconColor="text-amber-400"
              iconBg="bg-amber-950/80"
              items={analysisResult.unusualExpenses}
            />
          )}

          {/* Section 4: Recurring Spending */}
          {analysisResult.recurringSpending.length > 0 && (
            <InsightGroupCard
              title="Recurring Spending"
              icon={Repeat}
              iconColor="text-purple-400"
              iconBg="bg-purple-950/80"
              items={analysisResult.recurringSpending}
            />
          )}

          {/* Section 5: Potential Areas to Review */}
          {analysisResult.areasToReview.length > 0 && (
            <InsightGroupCard
              title="Potential Areas to Review"
              icon={AlertTriangle}
              iconColor="text-rose-400"
              iconBg="bg-rose-950/80"
              items={analysisResult.areasToReview}
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
}

const InsightGroupCard: React.FC<InsightGroupCardProps> = ({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  items,
}) => {
  return (
    <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3.5">
      <div className="flex items-center space-x-2.5">
        <div className={`w-8 h-8 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-white text-sm sm:text-base">{title}</h3>
      </div>

      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <InsightRow key={idx} item={item} />
        ))}
      </div>
    </div>
  );
};

const InsightRow: React.FC<{ item: InsightCardItem }> = ({ item }) => {
  const catInfo = item.category ? getCategoryInfo(item.category) : null;

  const severityBadge = (severity: InsightSeverity) => {
    switch (severity) {
      case 'POSITIVE':
        return {
          bg: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50',
          label: 'Positive',
        };
      case 'NOTABLE':
        return {
          bg: 'bg-amber-950/80 text-amber-300 border border-amber-800/50',
          label: 'Notable',
        };
      case 'REVIEW':
        return {
          bg: 'bg-rose-950/80 text-rose-300 border border-rose-800/50',
          label: 'Review',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-300',
          label: 'Pattern',
        };
    }
  };

  const badge = severityBadge(item.severity);

  return (
    <div className="p-3.5 rounded-2xl bg-[#0B0F19] border border-slate-800/60 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          {catInfo && <span className="text-base shrink-0">{catInfo.iconEmoji}</span>}
          <h4 className="font-bold text-sm text-white truncate">
            {item.title}
          </h4>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${badge.bg}`}>
          {badge.label}
        </span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        {item.explanation}
      </p>

      {item.numbers && (
        <div className="pt-0.5 font-bold text-xs text-emerald-400">
          {item.numbers}
        </div>
      )}
    </div>
  );
};
