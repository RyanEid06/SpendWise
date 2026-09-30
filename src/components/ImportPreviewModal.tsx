import React, { useState } from 'react';
import { DownloadCloud, AlertTriangle, X } from 'lucide-react';
import { Language, SpendWiseBackup } from '../types';
import { t } from '../utils/translations';
import { ViewportPortal } from './ViewportPortal';

interface ImportPreviewModalProps {
  isOpen: boolean;
  backup: SpendWiseBackup;
  currentExpenseCount: number;
  language: Language;
  onConfirm: (replaceExisting: boolean) => void;
  onClose: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  backup,
  currentExpenseCount,
  language,
  onConfirm,
  onClose,
}) => {
  const [replaceExisting, setReplaceExisting] = useState(false);

  if (!isOpen) return null;

  return (
    <ViewportPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
              <DownloadCloud className="w-4 h-4" />
            </div>
            <h3 id="import-modal-title" className="font-bold text-slate-900 dark:text-white text-lg">
              {t(language, 'importModalTitle')}
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

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t(language, 'importModalDesc')}
          </p>

          {/* Backup Stats Card */}
          <div className="bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'importExpensesInBackup')}</span>
              <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                {backup.metadata.totalExpenses}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'importMonthlyBudgets')}</span>
              <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                {backup.metadata.totalBudgets}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'importCurrency')}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {backup.settings.currencyCode}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t(language, 'importBackupDate')}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {backup.metadata.exportedAtFormatted}
              </span>
            </div>
          </div>

          {/* Import Modes */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t(language, 'importSelectMode')}
            </span>

            {/* Merge Option */}
            <label
              onClick={() => setReplaceExisting(false)}
              className={`flex items-start space-x-3 rtl:space-x-reverse p-3.5 rounded-2xl border cursor-pointer transition-all ${
                !replaceExisting
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={!replaceExisting}
                onChange={() => setReplaceExisting(false)}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {t(language, 'importMergeTitle')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {t(language, 'importMergeSub', { count: currentExpenseCount })}
                </p>
              </div>
            </label>

            {/* Replace Option */}
            <label
              onClick={() => setReplaceExisting(true)}
              className={`flex items-start space-x-3 rtl:space-x-reverse p-3.5 rounded-2xl border cursor-pointer transition-all ${
                replaceExisting
                  ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={replaceExisting}
                onChange={() => setReplaceExisting(true)}
                className="mt-1 text-rose-600 focus:ring-rose-500"
              />
              <div>
                <p className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                  {t(language, 'importReplaceTitle')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {t(language, 'importReplaceSub', { count: backup.metadata.totalExpenses })}
                </p>
              </div>
            </label>
          </div>

          {/* Warning notice if replace */}
          {replaceExisting && (
            <div className="flex items-center space-x-2.5 rtl:space-x-reverse p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs font-medium border border-rose-200 dark:border-rose-900/60">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{t(language, 'importReplaceWarning', { count: currentExpenseCount })}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-[#0B0F19]/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t(language, 'cancelBtn')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(replaceExisting)}
            className={`min-h-[48px] px-5 py-2 rounded-xl text-sm font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 ${
              replaceExisting
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
            }`}
          >
            {replaceExisting ? t(language, 'replaceRestoreBtn') : t(language, 'mergeImportBtn')}
          </button>
        </div>
      </div>
    </div>
    </ViewportPortal>
  );
};
