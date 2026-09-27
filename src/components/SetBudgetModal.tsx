import React, { useState } from 'react';
import { Wallet, X } from 'lucide-react';
import { Language } from '../types';
import { getCurrency } from '../utils/currency';
import { t } from '../utils/translations';

interface SetBudgetModalProps {
  isOpen: boolean;
  monthName: string;
  currentStartingAmount: number;
  currencyCode: string;
  language: Language;
  onSave: (amount: number) => void;
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
  if (!isOpen) return null;

  const currency = getCurrency(currencyCode);

  const [amountText, setAmountText] = useState(
    currentStartingAmount > 0 ? currentStartingAmount.toString() : ''
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const amount = parseFloat(amountText);
    if (isNaN(amount) || amount <= 0) {
      setError(t(language, 'budgetError'));
      return;
    }
    onSave(amount);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 id="budget-modal-title" className="font-bold text-slate-900 dark:text-white text-lg">
              {t(language, 'setBudgetModalTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
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
              <div className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 pl-4 rtl:pl-0 rtl:pr-4 flex items-center pointer-events-none font-bold text-slate-400 text-lg">
                {currency.symbol}
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  setError(null);
                }}
                className={`w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 rounded-2xl border text-lg font-bold tabular-nums bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                }`}
              />
            </div>
            {error && <p className="text-xs text-rose-500 dark:text-rose-400 mt-1 font-medium">{error}</p>}
          </div>

        </div>

        <div className="p-4 bg-slate-50 dark:bg-[#0B0F19]/60 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-end space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t(language, 'cancelBtn')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] px-6 py-2 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            {t(language, 'saveBudgetBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
