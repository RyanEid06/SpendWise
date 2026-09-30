import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, X } from 'lucide-react';
import { Language } from '../types';
import {
  convertCurrencyAmount,
  formatCurrency,
  getCurrency,
  isValidConversionRate,
} from '../utils/currency';
import { t } from '../utils/translations';
import { ViewportPortal } from './ViewportPortal';

interface CurrencyConversionModalProps {
  isOpen: boolean;
  sourceCurrencyCode: string;
  targetCurrencyCode: string;
  expenseCount: number;
  budgetCount: number;
  previewAmount: number;
  initialRate: number | null;
  language: Language;
  onConfirm: (targetUnitsPerSourceUnit: number) => void | Promise<void>;
  onClose: () => void;
}

function formatRateForInput(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return '';
  if (rate >= 1000) {
    return rate.toLocaleString('en-US', { maximumFractionDigits: 12 });
  }
  return rate.toPrecision(15).replace(/0+$/, '').replace(/\.$/, '');
}

function parseRateInput(value: string): number {
  let normalized = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, ',')
    .replace(/[\s\u00A0]/g, '');

  if (normalized.includes(',') && !normalized.includes('.')) {
    const parts = normalized.split(',');
    const looksGrouped =
      parts.length > 1 &&
      parts[0] !== '0' &&
      parts.slice(1).every((part) => part.length === 3);
    normalized = looksGrouped ? parts.join('') : normalized.replace(',', '.').replace(/,/g, '');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  return Number(normalized);
}

export const CurrencyConversionModal: React.FC<CurrencyConversionModalProps> = ({
  isOpen,
  sourceCurrencyCode,
  targetCurrencyCode,
  expenseCount,
  budgetCount,
  previewAmount,
  initialRate,
  language,
  onConfirm,
  onClose,
}) => {
  const [rateInput, setRateInput] = useState(() => formatRateForInput(initialRate));
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const source = getCurrency(sourceCurrencyCode);
  const target = getCurrency(targetCurrencyCode);
  const parsedRate = useMemo(() => parseRateInput(rateInput), [rateInput]);

  const previewConverted = useMemo(() => {
    if (!isValidConversionRate(parsedRate)) return null;
    try {
      return convertCurrencyAmount(previewAmount, parsedRate);
    } catch {
      return null;
    }
  }, [previewAmount, parsedRate]);

  if (!isOpen) return null;

  const isValid = isValidConversionRate(parsedRate) && previewConverted !== null;

  return (
    <ViewportPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="currency-conversion-title"
    >
      <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-colors">
        <div className="flex items-start justify-between gap-2 px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h3 id="currency-conversion-title" className="min-w-0 font-bold text-slate-900 dark:text-white text-base sm:text-lg leading-tight [overflow-wrap:anywhere]">
              {t(language, 'currencyConvertTitle', { source: source.code, target: target.code })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={t(language, 'cancelBtn')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t(language, 'currencyAffectedSummary', {
              expenses: expenseCount,
              budgets: budgetCount,
            })}
          </p>

          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{t(language, 'currencyManualRateNote')}</span>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              1 {source.code} = <span className="text-emerald-600 dark:text-emerald-400">[ {t(language, 'currencyRateLabel')} ]</span> {target.code}
            </label>
            <div className="flex items-center gap-2" dir="ltr">
              <span className="text-xs font-bold text-slate-500 shrink-0">1 {source.code} =</span>
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => {
                  setRateInput(e.target.value);
                  setRuntimeError(null);
                }}
                className="min-w-0 flex-1 min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F19] text-sm font-bold tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label={t(language, 'currencyRateLabel')}
              />
              <span className="text-xs font-bold text-slate-500 shrink-0">{target.code}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t(language, 'currencyRateHelp')}
            </p>
          </div>

          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-2">
            <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/70 p-3 min-w-0">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                {t(language, 'currencyCurrentLabel')}
              </div>
              <div className="font-extrabold tabular-nums text-sm text-slate-900 dark:text-white [overflow-wrap:anywhere] leading-tight" dir="ltr">
                {formatCurrency(previewAmount, source.code)}
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 p-3 min-w-0">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                {t(language, 'currencyConvertedLabel')}
              </div>
              <div className="font-extrabold tabular-nums text-sm text-emerald-900 dark:text-emerald-200 [overflow-wrap:anywhere] leading-tight" dir="ltr">
                {previewConverted == null ? '—' : formatCurrency(previewConverted, target.code)}
              </div>
            </div>
          </div>

          {!isValid && rateInput.trim() !== '' && (
            <div className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3">
              {t(language, 'currencyInvalidRate')}
            </div>
          )}

          {runtimeError && (
            <div className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3">
              {runtimeError}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-[#0B0F19]/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-col-reverse min-[360px]:flex-row items-stretch min-[360px]:items-center justify-end gap-2 min-[360px]:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t(language, 'cancelBtn')}
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => {
              if (!isValid) return;
              void (async () => {
                try {
                  setRuntimeError(null);
                  await onConfirm(parsedRate);
                } catch {
                  setRuntimeError(t(language, 'currencyConversionFailed'));
                }
              })();
            }}
            className="min-h-[48px] px-5 py-2 rounded-xl text-sm font-extrabold shadow-sm transition-all bg-emerald-500 hover:bg-emerald-600 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {t(language, 'currencyConfirmBtn', { target: target.code })}
          </button>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
};