import React from 'react';
import { Wallet, AlertTriangle, ArrowUp, ArrowDown, Edit2, Plus } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface BudgetSummaryCardsProps {
  startingMoney: number;
  isBudgetSet: boolean;
  totalSpent: number;
  remainingMoney: number;
  progress: number; // 0 to 1+
  currencyCode: string;
  monthName: string;
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
  onSetBudgetClick,
}) => {
  const isOverBudget = isBudgetSet && remainingMoney < 0;
  const percentLeft = Math.max(0, Math.round((1 - Math.min(1, progress)) * 100));

  return (
    <div className="space-y-3">
      {/* Prompt Banner if Budget Not Set (exact dark amber card from Android screenshot) */}
      {!isBudgetSet && (
        <div
          onClick={onSetBudgetClick}
          className="bg-gradient-to-r from-[#452206] to-[#301602] border border-[#78350F]/70 rounded-3xl p-4 flex items-center justify-between cursor-pointer hover:border-amber-600/60 transition-colors shadow-sm"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#592B08] flex items-center justify-center text-amber-300">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Set Starting Budget
              </h4>
              <p className="text-xs text-amber-200/75">
                No budget entered for {monthName}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetBudgetClick();
            }}
            className="flex items-center space-x-1 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-full transition-colors cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Set</span>
          </button>
        </div>
      )}

      {/* Main Prominent Card: Money Left / Budget Exceeded */}
      <div
        className={`rounded-3xl p-5 shadow-sm transition-all border ${
          !isBudgetSet
            ? 'bg-[#111928] border-slate-800/80 text-white'
            : isOverBudget
            ? 'bg-[#2A1115] border-rose-900/60 text-white'
            : 'bg-[#111928] border-slate-800/80 text-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">
            {isOverBudget ? 'Budget Exceeded' : 'Money Left'}
          </span>

          {isOverBudget ? (
            <div className="flex items-center space-x-1.5 bg-rose-500 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Over Budget</span>
            </div>
          ) : isBudgetSet ? (
            <span className="bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full">
              {percentLeft}% left
            </span>
          ) : null}
        </div>

        <div className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          {isBudgetSet ? formatCurrency(remainingMoney, currencyCode) : '—'}
        </div>

        {isBudgetSet && (
          <div className="mt-4 space-y-2">
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverBudget ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>{formatCurrency(totalSpent, currencyCode)} spent</span>
              <span>of {formatCurrency(startingMoney, currencyCode)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Grid: Starting Money & Total Spent */}
      <div className="grid grid-cols-2 gap-3">
        {/* Starting Money Card */}
        <div
          onClick={onSetBudgetClick}
          className="bg-[#111928] border border-slate-800/80 rounded-3xl p-4 shadow-sm cursor-pointer hover:border-slate-700 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-indigo-950/80 text-indigo-400 flex items-center justify-center">
                <ArrowUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Starting
              </span>
            </div>
            <Edit2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
          </div>
          <div className="mt-2 font-extrabold text-lg text-white">
            {isBudgetSet ? formatCurrency(startingMoney, currencyCode) : 'Not set'}
          </div>
        </div>

        {/* Total Spent Card */}
        <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-4 shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-rose-950/80 text-rose-400 flex items-center justify-center">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-400">Spent</span>
          </div>
          <div className="mt-2 font-extrabold text-lg text-white">
            {formatCurrency(totalSpent, currencyCode)}
          </div>
        </div>
      </div>
    </div>
  );
};
