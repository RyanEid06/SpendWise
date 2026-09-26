import React, { useState, useRef } from 'react';
import {
  Lock,
  Download,
  FileSpreadsheet,
  Upload,
  Check,
  ShieldCheck,
  Trash2,
  Moon,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { SpendWiseBackup, ThemeMode } from '../types';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { StorageManager } from '../utils/storage';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ImportPreviewModal } from '../components/ImportPreviewModal';

interface SettingsScreenProps {
  currentCurrencyCode: string;
  currentThemeMode: ThemeMode;
  totalExpensesCount: number;
  isAppLockEnabled: boolean;
  lockTimeoutSeconds: number;
  onAppLockToggle: (enabled: boolean) => void;
  onLockTimeoutChange: (seconds: number) => void;
  onCurrencyChange: (code: string) => void;
  onThemeChange: (mode: ThemeMode) => void;
  onClearAllData: () => void;
  onBackupRestored: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentCurrencyCode,
  currentThemeMode,
  totalExpensesCount,
  isAppLockEnabled,
  lockTimeoutSeconds,
  onAppLockToggle,
  onLockTimeoutChange,
  onCurrencyChange,
  onThemeChange,
  onClearAllData,
  onBackupRestored,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [pendingImportBackup, setPendingImportBackup] = useState<SpendWiseBackup | null>(null);

  const timeoutOptions = [
    { seconds: 0, label: 'Immediately' },
    { seconds: 60, label: 'After 1 minute' },
    { seconds: 300, label: 'After 5 minutes' },
    { seconds: 900, label: 'After 15 minutes' },
  ];

  // Export JSON handler
  const handleExportJson = () => {
    try {
      const backup = StorageManager.createBackupJson();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStamp = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `spendwise_backup_${dateStamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(
        `Backup created: ${backup.metadata.totalExpenses} expenses and ${backup.metadata.totalBudgets} budgets saved.`
      );
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`Export failed: ${err.message}`);
    }
  };

  // Export CSV handler
  const handleExportCsv = () => {
    try {
      const csv = StorageManager.createCsvExport();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStamp = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `spendwise_expenses_${dateStamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage('CSV spreadsheet exported successfully.');
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(`CSV export failed: ${err.message}`);
    }
  };

  // Import JSON file reader
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed: SpendWiseBackup = JSON.parse(text);

        if (!parsed.expenses || !parsed.monthlyBudgets) {
          throw new Error('Missing recognized financial records in backup file.');
        }

        setPendingImportBackup(parsed);
        setErrorMessage(null);
      } catch (err: any) {
        setErrorMessage(`Invalid backup file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = (replaceExisting: boolean) => {
    if (!pendingImportBackup) return;
    try {
      const summary = StorageManager.restoreBackup(pendingImportBackup, replaceExisting);
      setPendingImportBackup(null);
      onBackupRestored();
      setStatusMessage(
        summary.wasReplaced
          ? `Restored and replaced with ${summary.expensesImported} expenses & ${summary.budgetsImported} budgets.`
          : `Imported and merged ${summary.expensesImported} expenses & ${summary.budgetsImported} budgets.`
      );
    } catch (err: any) {
      setErrorMessage(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">Settings</h2>
        <p className="text-xs text-slate-400">
          Preferences, privacy lock, and local backup
        </p>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400 hover:text-emerald-300 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-300 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* App Lock & Privacy */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                App Lock
              </h3>
              <p className="text-xs text-slate-400">
                Require PIN / Passcode to access app
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAppLockEnabled}
              onChange={(e) => onAppLockToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {isAppLockEnabled && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              Lock Timeout
            </label>
            <div className="grid grid-cols-2 gap-2">
              {timeoutOptions.map((opt) => (
                <button
                  key={opt.seconds}
                  type="button"
                  onClick={() => onLockTimeoutChange(opt.seconds)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    lockTimeoutSeconds === opt.seconds
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-800 bg-[#0B0F19] text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{opt.label}</span>
                  {lockTimeoutSeconds === opt.seconds && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Backup & Export Data */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div>
          <h3 className="font-bold text-white text-sm sm:text-base">
            Backup & Export Data
          </h3>
          <p className="text-xs text-slate-400">
            Export and restore complete JSON backups or CSV spreadsheets
          </p>
        </div>

        <div className="space-y-2">
          {/* Create Backup JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#0B0F19] border border-slate-800/60 hover:border-slate-700 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-white">
                  Create Backup (JSON)
                </p>
                <p className="text-[11px] text-slate-400">
                  Complete backup of all expenses, monthly budgets & settings
                </p>
              </div>
            </div>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#0B0F19] border border-slate-800/60 hover:border-slate-700 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-blue-950/80 text-blue-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-white">
                  Export to CSV
                </p>
                <p className="text-[11px] text-slate-400">
                  Spreadsheet format for Excel, Google Sheets, or Numbers
                </p>
              </div>
            </div>
          </button>

          {/* Import JSON */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#0B0F19] border border-slate-800/60 hover:border-slate-700 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-purple-950/80 text-purple-400 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-white">
                  Import Data
                </p>
                <p className="text-[11px] text-slate-400">
                  Preview and restore or merge a previously saved JSON backup
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Default Currency */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center space-x-2.5">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-white text-sm sm:text-base">
            Default Currency
          </h3>
        </div>

        <div className="space-y-1.5">
          {SUPPORTED_CURRENCIES.map((c) => {
            const isSelected = c.code.toLowerCase() === currentCurrencyCode.toLowerCase();
            return (
              <button
                key={c.code}
                onClick={() => onCurrencyChange(c.code)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-800/80'
                    : 'bg-[#0B0F19] border border-slate-800/60 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="w-8 font-extrabold text-sm text-emerald-400">
                    {c.symbol}
                  </span>
                  <span className="text-xs sm:text-sm">{c.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Preference */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3.5">
        <div className="flex items-center space-x-2.5">
          <Moon className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-sm sm:text-base">
            Appearance
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['DARK', 'Dark (Default)'],
              ['LIGHT', 'Light'],
              ['SYSTEM', 'System'],
            ] as const
          ).map(([mode, label]) => {
            const isSelected = currentThemeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onThemeChange(mode)}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-xs'
                    : 'border-slate-800 bg-[#0B0F19] text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 100% Local & Private Guarantee */}
      <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-3xl p-5 flex items-start space-x-3.5">
        <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-emerald-300">
            100% Local & Private
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            All your financial records are stored offline on your device in local storage. Backup
            files are saved directly onto your device via standard file download.
          </p>
        </div>
      </div>

      {/* Danger Zone: Clear Data */}
      <div className="bg-[#111928] border border-slate-800/80 rounded-3xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-rose-400 text-sm sm:text-base">Danger Zone</h3>
        <p className="text-xs text-slate-400">
          Reset all stored financial data, erasing all {totalExpensesCount} expenses and budget
          allocations.
        </p>
        <button
          type="button"
          onClick={() => setShowClearModal(true)}
          className="flex items-center space-x-2 text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-800 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All Data</span>
        </button>
      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearModal}
        title="Clear All Data?"
        message="This will permanently erase all your expenses and monthly budget settings from your browser. This action cannot be undone."
        confirmText="Erase Everything"
        isDestructive={true}
        onConfirm={() => {
          onClearAllData();
          setShowClearModal(false);
          setStatusMessage('All local data has been erased.');
        }}
        onCancel={() => setShowClearModal(false)}
      />

      {/* Import Preview Modal */}
      {pendingImportBackup && (
        <ImportPreviewModal
          isOpen={true}
          backup={pendingImportBackup}
          currentExpenseCount={totalExpensesCount}
          onConfirm={handleConfirmImport}
          onClose={() => setPendingImportBackup(null)}
        />
      )}
    </div>
  );
};
