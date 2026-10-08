import React from 'react';
import { Wallet, AlertTriangle, ArrowUp, ArrowDown, Edit2, Plus } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { Language } from '../types';
import { t } from '../utils/translations';
import { SingleLineAmount } from './SingleLineAmount';

interface BudgetSummaryCardsProps {
  startingMoney: number;
  isBudgetSet: boolean;
  totalSpent: number;
  remainingMoney: number;
  progress: number; // 0 to 1+
  currencyCode: string;
  monthName: string;
  language: Language;
  onSetBudgetClick: () => void;
}

export const BudgetSummaryCards: React.FC<BudgetSummaryCardsProps> = ({
  startingMoney,
  isBudgetSet,
  totalSpent,
  remainingMoney,
  progress,
  currencyCode,
  monthName,
  language,
  onSetBudgetClick,
}) => {
  const isOverBudget = isBudgetSet && remainingMoney < 0;
  const percentUsed = Math.max(0, Math.round(progress * 100));
  const percentLeft = Math.max(0, Math.round((1 - Math.min(1, progress)) * 100));
  const isApproachingLimit = isBudgetSet && !isOverBudget && percentUsed >= 80;

  return (
    <div className="space-y-3">
      {/* 1. Prompt Banner if Budget Not Set */}
      {!isBudgetSet && (
        <div
          onClick={onSetBudgetClick}
          className="bg-amber-50 dark:bg-gradient-to-r dark:from-[#452206] dark:to-[#301602] border border-amber-300 dark:border-[#78350F]/70 rounded-3xl p-4 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-3 cursor-pointer hover:border-amber-400 dark:hover:border-amber-600/60 transition-all shadow-xs group"
          role="button"
          tabIndex={0}
          aria-label={t(language, 'setBudgetPromptTitle')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSetBudgetClick();
            }
          }}
        >
          <div className="flex items-center space-x-3.5 rtl:space-x-reverse min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-200/80 dark:bg-[#592B08] flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {t(language, 'setBudgetPromptTitle')}
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/75 truncate">
                {t(language, 'setBudgetPromptSub', { month: monthName })}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetBudgetClick();
            }}
            className="w-full min-[380px]:w-auto min-h-[48px] px-4 flex items-center justify-center space-x-1.5 rtl:space-x-reverse bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-full transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            aria-label={t(language, 'setBudgetBtn')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t(language, 'setBudgetBtn')}</span>
          </button>
        </div>
      )}

      {/* 2. Main Prominent Card: Money Remaining / Budget Exceeded */}
      <div
        className={`rounded-3xl p-5 shadow-xs transition-all border ${
          !isBudgetSet
            ? 'bg-white dark:bg-[#111928] border-slate-200/90 dark:border-slate-800/80 text-slate-900 dark:text-white'
            : isOverBudget
            ? 'bg-rose-50 dark:bg-[#2A1115] border-rose-200 dark:border-rose-900/60 text-slate-900 dark:text-white'
            : isApproachingLimit
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-slate-900 dark:text-white'
            : 'bg-white dark:bg-[#111928] border-slate-200/90 dark:border-slate-800/80 text-slate-900 dark:text-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isOverBudget ? t(language, 'budgetExceeded') : t(language, 'moneyRemaining')}
          </span>

          {isOverBudget ? (
            <div className="flex items-center space-x-1.5 rtl:space-x-reverse bg-rose-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t(language, 'overBudgetBadge')}</span>
            </div>
          ) : isApproachingLimit ? (
            <span className="bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
              {t(language, 'approachingLimitBadge', { percent: percentUsed })}
            </span>
          ) : isBudgetSet ? (
            <span className="bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full">
              {t(language, 'percentLeftBadge', { percent: percentLeft })}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {t(language, 'budgetUnconfigured')}
            </span>
          )}
        </div>

        <SingleLineAmount value={isBudgetSet ? formatCurrency(remainingMoney, currencyCode) : '—'}
          className="mt-2 text-[clamp(1.75rem,8vw,2.25rem)] leading-tight font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white" />

        {isBudgetSet && (
          <div className="mt-4 space-y-2">
            <div
              className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.min(100, percentUsed)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${t(language, 'startingMoney')}: ${t(language, 'percentUsed', { percent: percentUsed })}`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isOverBudget ? 'bg-rose-500' : isApproachingLimit ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
              <span className="min-w-0 tabular-nums font-semibold">
                {t(language, 'spentOfBudget', { spent: '{spent}', budget: '{budget}' })
                  .split(/(\{spent\}|\{budget\})/).map((part, index) =>
                    part === '{spent}' || part === '{budget}'
                      ? <span key={index} dir="ltr" className="inline-block max-w-full align-bottom">
                          <SingleLineAmount value={formatCurrency(part === '{spent}' ? totalSpent : startingMoney, currencyCode)} className="text-xs" />
                        </span>
                      : part
                  )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Two Column Grid: Monthly Budget & Total Spent */}
      <div className={`grid gap-2 min-[390px]:gap-3 ${formatCurrency(startingMoney, currencyCode).length > 16 || formatCurrency(totalSpent, currencyCode).length > 16 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {/* Monthly Budget Card */}
        <div
          onClick={onSetBudgetClick}
          className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-3 min-[390px]:p-4 shadow-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all group active:scale-[0.98]"
          role="button"
          tabIndex={0}
          aria-label={t(language, 'startingMoney')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSetBudgetClick();
            }
          }}
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 rtl:flex-row-reverse">
              <div className="w-5 h-5 min-[390px]:w-6 min-[390px]:h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ArrowUp className="w-3 h-3 min-[390px]:w-3.5 min-[390px]:h-3.5" />
              </div>
              <span className="text-[11px] min-[390px]:text-xs leading-tight font-semibold text-slate-500 dark:text-slate-400 min-w-0">
                {t(language, 'startingMoney')}
              </span>
            </div>
            <div className="w-7 h-7 flex items-center justify-center shrink-0" aria-hidden="true">
              <Edit2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
            </div>
          </div>
          <SingleLineAmount value={isBudgetSet ? formatCurrency(startingMoney, currencyCode) : t(language, 'notSet')}
            className="mt-2 font-extrabold text-[clamp(0.95rem,4.4vw,1.125rem)] tabular-nums text-slate-900 dark:text-white leading-tight" />
        </div>

        {/* Total Spent Card */}
        <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-3 min-[390px]:p-4 shadow-xs">
          <div className="flex items-center gap-1.5 min-w-0 rtl:flex-row-reverse">
            <div className="w-5 h-5 min-[390px]:w-6 min-[390px]:h-6 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ArrowDown className="w-3 h-3 min-[390px]:w-3.5 min-[390px]:h-3.5" />
            </div>
            <span className="text-[11px] min-[390px]:text-xs leading-tight font-semibold text-slate-500 dark:text-slate-400 min-w-0">
              {t(language, 'totalSpent')}
            </span>
          </div>
          <SingleLineAmount value={formatCurrency(totalSpent, currencyCode)}
            className="mt-2 font-extrabold text-[clamp(0.95rem,4.4vw,1.125rem)] tabular-nums text-slate-900 dark:text-white leading-tight" />
        </div>
      </div>
    </div>
  );
};
