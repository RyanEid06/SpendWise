import React, { useState } from 'react';
import { Wallet, X } from 'lucide-react';
import { Language } from '../types';
import { getCurrency } from '../utils/currency';
import { t } from '../utils/translations';
import { ViewportPortal } from './ViewportPortal';

interface SetBudgetModalProps {
  isOpen: boolean;
  monthName: string;
  currentStartingAmount: number;
  currencyCode: string;
  language: Language;
  onSave: (amount: number) => void | Promise<void>;
  onClose: () => void;
}

export const SetBudgetModal: React.FC<SetBudgetModalProps> = ({
  isOpen,
  monthName,
  currentStartingAmount,
  currencyCode,
  language,
  onSave,
  onClose,
}) => {
  const currency = getCurrency(currencyCode);

  const [amountText, setAmountText] = useState(
    currentStartingAmount > 0 ? currentStartingAmount.toString() : ''
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    const amount = parseFloat(amountText);
    if (isNaN(amount) || amount <= 0) {
      setError(t(language, 'budgetError'));
      return;
    }
    try {
      await onSave(amount);
      onClose();
    } catch {
      setError(t(language, 'budgetSaveFailed'));
    }
  };

  return (
    <ViewportPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-colors">
        <div className="flex items-start justify-between gap-2 px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 id="budget-modal-title" className="min-w-0 font-bold text-slate-900 dark:text-white text-lg leading-tight [overflow-wrap:anywhere]">
              {t(language, 'setBudgetModalTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={t(language, 'cancelBtn')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t(language, 'setBudgetModalDesc', { month: monthName })}
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {t(language, 'startingBudgetLabel')}
            </label>
            <div className="relative rounded-2xl">
              <div
                className={`absolute inset-y-0 flex items-center pointer-events-none font-bold text-slate-400 text-base ${currency.symbolPrefix === false ? 'right-0 pr-4' : 'left-0 pl-4'}`}
              >
                {currency.symbol}
              </div>
              <input
                type="number"
                aria-label={t(language, 'startingBudgetLabel')}
                step={currency.code === 'LBP' || currency.code === 'JPY' ? '1' : '0.01'}
                placeholder={currency.code === 'LBP' || currency.code === 'JPY' ? '0' : '0.00'}
                dir="ltr"
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  setError(null);
                }}
                className={`w-full ${currency.symbolPrefix === false ? 'pl-4 pr-14' : 'pl-14 pr-4'} py-3 rounded-2xl border text-lg font-bold tabular-nums bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                }`}
              />
            </div>
            {error && <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 font-medium">{error}</p>}
          </div>

        </div>

        <div className="p-4 bg-slate-50 dark:bg-[#0B0F19]/60 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col-reverse min-[360px]:flex-row items-stretch min-[360px]:items-center justify-end gap-2 min-[360px]:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t(language, 'cancelBtn')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[48px] px-6 py-2 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            {t(language, 'saveBudgetBtn')}
          </button>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
};
