import React, { useState } from 'react';
import { Wallet, X } from 'lucide-react';
import { getCurrency, formatCurrency } from '../utils/currency';

interface SetBudgetModalProps {
  isOpen: boolean;
  monthName: string;
  currentStartingAmount: number;
  currencyCode: string;
  onSave: (amount: number) => void;
  onClose: () => void;
}

export const SetBudgetModal: React.FC<SetBudgetModalProps> = ({
  isOpen,
  monthName,
  currentStartingAmount,
  currencyCode,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const currency = getCurrency(currencyCode);
  const quickAmounts = [500, 1000, 1500, 2000, 3000, 5000];

  const [amountText, setAmountText] = useState(
    currentStartingAmount > 0 ? currentStartingAmount.toString() : ''
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const amount = parseFloat(amountText);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }
    onSave(amount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#111928] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-lg">
              Starting Budget
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Enter how much starting money or income you have budgeted for{' '}
            <strong className="text-white">{monthName}</strong>. This is
            specific to this month only.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Starting Money
            </label>
            <div className="relative rounded-2xl">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-slate-400 text-lg">
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
                className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-800 bg-[#0B0F19] text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {error && <p className="text-xs text-rose-400 mt-1 font-medium">{error}</p>}
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-400 mb-2">
              Quick Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmountText(preset.toString());
                    setError(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-800 bg-[#0B0F19] hover:bg-emerald-950/40 hover:border-emerald-600/60 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  {formatCurrency(preset, currencyCode)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#0B0F19]/60 border-t border-slate-800/80 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            Save Budget
          </button>
        </div>
      </div>
    </div>
  );
};
