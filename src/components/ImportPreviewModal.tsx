import React, { useState } from 'react';
import { DownloadCloud, AlertTriangle, X } from 'lucide-react';
import { SpendWiseBackup } from '../types';

interface ImportPreviewModalProps {
  isOpen: boolean;
  backup: SpendWiseBackup;
  currentExpenseCount: number;
  onConfirm: (replaceExisting: boolean) => void;
  onClose: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  backup,
  currentExpenseCount,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const [replaceExisting, setReplaceExisting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <DownloadCloud className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              Import Backup Preview
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            A valid SpendWise backup file was detected. Review the contents below before proceeding:
          </p>

          {/* Backup Stats Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Expenses in backup:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {backup.metadata.totalExpenses} records
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Monthly Budgets:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {backup.metadata.totalBudgets} months
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Currency:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {backup.settings.currencyCode}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Backup Date:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {backup.metadata.exportedAtFormatted}
              </span>
            </div>
          </div>

          {/* Import Modes */}
          <div className="space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Select Import Mode:
            </span>

            {/* Merge Option */}
            <label
              onClick={() => setReplaceExisting(false)}
              className={`flex items-start space-x-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                !replaceExisting
                  ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
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
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Merge with existing data
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Appends backup expenses to current records ({currentExpenseCount} existing). No
                  current data will be erased.
                </p>
              </div>
            </label>

            {/* Replace Option */}
            <label
              onClick={() => setReplaceExisting(true)}
              className={`flex items-start space-x-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                replaceExisting
                  ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
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
                  Restore & Replace all data
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Overwrites current records with the backup. Replaces all existing expenses with the{' '}
                  {backup.metadata.totalExpenses} in backup.
                </p>
              </div>
            </label>
          </div>

          {/* Warning notice if replace */}
          {replaceExisting && (
            <div className="flex items-center space-x-2.5 p-3 rounded-2xl bg-rose-100/70 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Warning: Your current {currentExpenseCount} expenses will be replaced.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(replaceExisting)}
            className={`px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md transition-all cursor-pointer ${
              replaceExisting
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            {replaceExisting ? 'Replace & Restore' : 'Merge & Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
