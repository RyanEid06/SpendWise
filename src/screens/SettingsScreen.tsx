import React, { useEffect, useState, useRef } from 'react';
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
  Globe,
  Info,
  Images,
  Archive,
  Image as ImageIcon,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { Language, MediaStorageSummary, SpendWiseBackup, ThemeMode } from '../types';
import { getSuggestedConversionRate, SUPPORTED_CURRENCIES } from '../utils/currency';
import { StorageManager } from '../utils/storage';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import { CurrencyConversionModal } from '../components/CurrencyConversionModal';
import { t } from '../utils/translations';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../utils/appVersion';
import { exportBlobFile, exportTextFile } from '../utils/fileExport';
import { MediaLibraryScreen } from './MediaLibraryScreen';
import { BackupV2ImportModal } from '../components/BackupV2ImportModal';
import type { BackupV2Preview } from '../utils/backupV2';
import { LegalDocumentScreen } from './LegalDocumentScreen';
import type { LegalDocumentKind } from '../utils/legalDocuments';

interface SettingsScreenProps {
  currentCurrencyCode: string;
  currentThemeMode: ThemeMode;
  currentLanguage: Language;
  totalExpensesCount: number;
  totalBudgetsCount: number;
  isAppLockEnabled: boolean;
  lockTimeoutSeconds: number;
  onAppLockToggle: (enabled: boolean) => void;
  onLockTimeoutChange: (seconds: number) => void;
  onCurrencyChange: (code: string, targetUnitsPerSourceUnit?: number) => void | Promise<void>;
  onThemeChange: (mode: ThemeMode) => void;
  onLanguageChange: (lang: Language) => void;
  onClearAllData: () => void | Promise<void>;
  onBackupRestored: () => void;
  onReviewSetup: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentCurrencyCode,
  currentThemeMode,
  currentLanguage,
  totalExpensesCount,
  totalBudgetsCount,
  isAppLockEnabled,
  lockTimeoutSeconds,
  onAppLockToggle,
  onLockTimeoutChange,
  onCurrencyChange,
  onThemeChange,
  onLanguageChange,
  onClearAllData,
  onBackupRestored,
  onReviewSetup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showClearModal, setShowClearModal] = useState(false);
  const [legalKind, setLegalKind] = useState<LegalDocumentKind | null>(null);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaSummary, setMediaSummary] = useState<MediaStorageSummary | null>(null);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [pendingImportBackup, setPendingImportBackup] = useState<SpendWiseBackup | null>(null);
  const [pendingV2Backup, setPendingV2Backup] = useState<{ file: File; preview: BackupV2Preview } | null>(null);
  const [pendingCurrencyCode, setPendingCurrencyCode] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const hasSavedPin = StorageManager.hasLockPin();
  const hasFinancialData = totalExpensesCount > 0 || totalBudgetsCount > 0;
  const currencyPreviewAmount =
    StorageManager.getExpenses()[0]?.amount ??
    StorageManager.getBudgets()[0]?.startingAmount ??
    0;

  const timeoutOptions = [
    { seconds: 0, label: t(currentLanguage, 'timeoutImmediate') },
    { seconds: 60, label: t(currentLanguage, 'timeout1Min') },
    { seconds: 300, label: t(currentLanguage, 'timeout5Mins') },
    { seconds: 900, label: t(currentLanguage, 'timeout15Mins') },
  ];

  const languages: { code: Language; name: string; nativeName: string }[] = [
    { code: 'en', name: 'English', nativeName: 'English (LTR)' },
    { code: 'fr', name: 'Français', nativeName: 'Français (LTR)' },
    { code: 'ar', name: 'العربية', nativeName: 'العربية (RTL)' },
  ];

  const mediaCopy = {
    en: {
      section: 'Storage & Media', sectionSub: 'Private SpendWise photo storage and integrity.',
      library: 'Media Library', librarySub: 'Browse, inspect and export attached photos.',
      photos: 'photos', storage: 'Photo storage', integrity: 'Integrity', healthy: 'Healthy',
      issues: 'issues', dataOnly: 'Backup v2 · Data only', dataOnlySub: 'Ledger and settings without photo binaries.',
      fullBackup: 'Backup v2 · Data + photos', fullBackupSub: 'Portable ZIP with ledger and private attachment photos.',
      legacy: 'Legacy Backup v1 JSON', imported: 'Backup v2 restored',
    },
    fr: {
      section: 'Stockage & médias', sectionSub: 'Stockage privé des photos SpendWise et intégrité.',
      library: 'Médiathèque', librarySub: 'Parcourir, vérifier et exporter les photos jointes.',
      photos: 'photos', storage: 'Stockage photos', integrity: 'Intégrité', healthy: 'Correcte',
      issues: 'problèmes', dataOnly: 'Backup v2 · Données seules', dataOnlySub: 'Registre et réglages sans fichiers photo.',
      fullBackup: 'Backup v2 · Données + photos', fullBackupSub: 'ZIP portable avec registre et photos privées.',
      legacy: 'Backup v1 JSON hérité', imported: 'Backup v2 restauré',
    },
    ar: {
      section: 'التخزين والوسائط', sectionSub: 'تخزين صور SpendWise الخاصة وفحص سلامتها.',
      library: 'مكتبة الوسائط', librarySub: 'استعراض الصور المرفقة وفحصها وتصديرها.',
      photos: 'صور', storage: 'مساحة الصور', integrity: 'السلامة', healthy: 'سليمة',
      issues: 'مشكلات', dataOnly: 'النسخة v2 · بيانات فقط', dataOnlySub: 'السجل والإعدادات بدون ملفات الصور.',
      fullBackup: 'النسخة v2 · بيانات + صور', fullBackupSub: 'ملف ZIP محمول يتضمن السجل والصور الخاصة.',
      legacy: 'نسخة v1 JSON القديمة', imported: 'تمت استعادة النسخة v2',
    },
  } as const;
  const mc = mediaCopy[currentLanguage];

  const humanBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const refreshMediaSummary = async () => {
    try {
      setMediaSummary(await StorageManager.getMediaStorageSummary());
    } catch {
      setMediaSummary(null);
    }
  };

  useEffect(() => {
    void refreshMediaSummary();
  }, [showMediaLibrary, totalExpensesCount]);

  // Export JSON handler
  const handleExportJson = async () => {
    try {
      const backup = StorageManager.createBackupJson();
      const dateStamp = new Date().toISOString().split('T')[0];
      await exportTextFile({
        fileName: `spendwise_backup_${dateStamp}.json`,
        content: JSON.stringify(backup, null, 2),
        mimeType: 'application/json',
        shareTitle: t(currentLanguage, 'createBackupBtn'),
      });
      setStatusMessage(
        `${t(currentLanguage, 'createBackupBtn')}: ${backup.metadata.totalExpenses} / ${backup.metadata.totalBudgets}`
      );
      setErrorMessage(null);
    } catch {
      setErrorMessage('Export failed.');
    }
  };

  const handleExportV2 = async (includeMedia: boolean) => {
    if (isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      const blob = await StorageManager.createBackupV2(includeMedia);
      const dateStamp = new Date().toISOString().split('T')[0];
      await exportBlobFile({
        fileName: `spendwise_backup_v2_${includeMedia ? 'full' : 'data'}_${dateStamp}.zip`,
        blob,
        shareTitle: includeMedia ? mc.fullBackup : mc.dataOnly,
      });
      setStatusMessage(includeMedia ? mc.fullBackup : mc.dataOnly);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Backup v2 export failed.');
    } finally {
      setIsBackupBusy(false);
    }
  };

  // Export CSV handler
  const handleExportCsv = async () => {
    try {
      const dateStamp = new Date().toISOString().split('T')[0];
      await exportTextFile({
        fileName: `spendwise_expenses_${dateStamp}.csv`,
        content: StorageManager.createCsvExport(),
        mimeType: 'text/csv',
        shareTitle: t(currentLanguage, 'exportCsvBtn'),
      });
      setStatusMessage(t(currentLanguage, 'exportCsvBtn'));
      setErrorMessage(null);
    } catch {
      setErrorMessage('CSV Export failed.');
    }
  };
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    void (async () => {
      try {
        if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
          if (file.size > 5 * 1024 * 1024) throw new Error('BACKUP_FILE_TOO_LARGE');
          const parsed = StorageManager.validateBackup(JSON.parse(await file.text()));
          setPendingV2Backup(null);
          setPendingImportBackup(parsed);
        } else {
          const preview = await StorageManager.previewBackupV2(file);
          setPendingImportBackup(null);
          setPendingV2Backup({ file, preview });
        }
        setErrorMessage(null);
      } catch {
        setErrorMessage('Invalid or unsupported backup file.');
      }
    })();
  };

  const handleConfirmImport = async (replaceExisting: boolean) => {
    if (!pendingImportBackup) return;
    try {
      const summary = await StorageManager.restoreBackup(pendingImportBackup, replaceExisting);
      setPendingImportBackup(null);
      onBackupRestored();
      setStatusMessage(
        summary.wasReplaced
          ? `${t(currentLanguage, 'replaceRestoreBtn')}: ${summary.expensesImported}`
          : `${t(currentLanguage, 'mergeImportBtn')}: ${summary.expensesImported}`
      );
      setErrorMessage(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'BACKUP_CURRENCY_MISMATCH') {
        setErrorMessage(
          'This backup uses a different currency. Merge is blocked to prevent amounts from being relabeled incorrectly. Use Replace only if you intend to restore the backup currency and all backup data.'
        );
      } else {
        setErrorMessage('Import failed.');
      }
    }
  };
  const handleConfirmV2Import = async (replaceExisting: boolean) => {
    if (!pendingV2Backup) return;
    if (isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      const summary = await StorageManager.restoreBackupV2(pendingV2Backup.file, replaceExisting);
      setPendingV2Backup(null);
      onBackupRestored();
      await refreshMediaSummary();
      setStatusMessage(
        `${mc.imported}: ${summary.expensesImported} expenses, ${summary.photosImported} photos`
      );
      setErrorMessage(summary.warnings.length ? summary.warnings.join(', ') : null);
    } catch (error) {
      if (error instanceof Error && error.message === 'BACKUP_CURRENCY_MISMATCH') {
        setErrorMessage(
          'This backup uses a different currency. Merge is blocked to prevent amounts from being relabeled incorrectly.'
        );
      } else {
        setErrorMessage('Backup v2 restore failed. Your current data was kept whenever rollback was possible.');
      }
    } finally {
      setIsBackupBusy(false);
    }
  };

  useEffect(() => {
    const handleNativeBack = () => {
      if (pendingCurrencyCode) {
        setPendingCurrencyCode(null);
        return;
      }
      if (pendingV2Backup) {
        setPendingV2Backup(null);
        return;
      }
      if (pendingImportBackup) {
        setPendingImportBackup(null);
        return;
      }
      if (showClearModal) {
        setShowClearModal(false);
      }
    };

    window.addEventListener('spendwise-native-back', handleNativeBack);
    return () => window.removeEventListener('spendwise-native-back', handleNativeBack);
  }, [pendingCurrencyCode, pendingImportBackup, pendingV2Backup, showClearModal]);

  if (legalKind) {
    return <LegalDocumentScreen language={currentLanguage} kind={legalKind} onClose={() => setLegalKind(null)} />;
  }

  if (showMediaLibrary) {
    return <MediaLibraryScreen language={currentLanguage} onClose={() => setShowMediaLibrary(false)} />;
  }

  return (
    <div
      className="space-y-4 pb-28 animate-screen-enter"
      data-native-back-layer={
        showClearModal || pendingImportBackup !== null || pendingV2Backup !== null || pendingCurrencyCode !== null
          ? 'true'
          : undefined
      }
    >
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t(currentLanguage, 'settingsTitle')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t(currentLanguage, 'settingsSub')}
        </p>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 font-bold mx-2 cursor-pointer"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-200 font-bold mx-2 cursor-pointer"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Setup, legal and privacy review */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center gap-2.5 rtl:flex-row-reverse">
          <RotateCcw className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {currentLanguage === 'ar' ? 'الإعداد والخصوصية' : currentLanguage === 'fr' ? 'Configuration et confidentialité' : 'Setup & privacy'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentLanguage === 'ar' ? 'راجع الإعداد أو اقرأ المستندات القانونية.' : currentLanguage === 'fr' ? 'Revoyez la configuration ou consultez les documents.' : 'Review setup or read the legal documents.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReviewSetup}
          className="w-full min-h-[56px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] px-4 flex items-center justify-between gap-3 text-left rtl:text-right"
        >
          <span className="font-bold text-sm">
            {currentLanguage === 'ar' ? 'مراجعة الإعداد' : currentLanguage === 'fr' ? 'Revoir la configuration' : 'Review setup'}
          </span>
          <RotateCcw className="w-4 h-4 text-slate-400" />
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLegalKind('terms')}
            className="min-h-[52px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] px-3 text-xs font-bold flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {currentLanguage === 'ar' ? 'شروط الاستخدام' : currentLanguage === 'fr' ? "Conditions d’utilisation" : 'Terms of Use'}
          </button>
          <button
            type="button"
            onClick={() => setLegalKind('privacy')}
            className="min-h-[52px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] px-3 text-xs font-bold flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {currentLanguage === 'ar' ? 'سياسة الخصوصية' : currentLanguage === 'fr' ? 'Confidentialité' : 'Privacy Policy'}
          </button>
        </div>
      </div>

      {/* Language Section (English, French, Arabic RTL) */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
          <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
            {t(currentLanguage, 'languageSectionTitle')}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {languages.map((l) => {
            const isSelected = currentLanguage === l.code;
            return (
              <button
                key={l.code}
                onClick={() => onLanguageChange(l.code)}
                className={`min-h-[48px] py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300'
                }`}
              >
                <span>{l.name}</span>
                <span className="text-[10px] opacity-80 mt-0.5">{l.code === 'ar' ? 'RTL' : 'LTR'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* App Lock & Privacy */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                {t(currentLanguage, 'appLockTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t(currentLanguage, 'appLockSub')}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[50px] shrink-0">
            <input
              type="checkbox"
              checked={isAppLockEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                if (enabled && !StorageManager.hasLockPin()) {
                  setErrorMessage(t(currentLanguage, 'pinRequiredToEnable'));
                  return;
                }
                setErrorMessage(null);
                onAppLockToggle(enabled);
              }}
              className="sr-only peer"
              aria-label={t(currentLanguage, 'appLockTitle')}
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[4px] rtl:after:left-auto rtl:after:right-[4px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t(currentLanguage, hasSavedPin ? 'changePinLabel' : 'setPinLabel')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t(currentLanguage, 'newPinPlaceholder')}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-sm text-slate-900 dark:text-white"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t(currentLanguage, 'confirmPinPlaceholder')}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-sm text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!/^\d{4,8}$/.test(newPin) || newPin !== confirmPin) {
                  setErrorMessage(t(currentLanguage, 'pinMismatch'));
                  return;
                }
                StorageManager.setLockPin(newPin);
                setNewPin('');
                setConfirmPin('');
                setErrorMessage(null);
                setStatusMessage(t(currentLanguage, 'pinSaved'));
              }}
              className="min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold"
            >
              {t(currentLanguage, 'savePinBtn')}
            </button>
          </div>

          {isAppLockEnabled && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t(currentLanguage, 'lockTimeoutLabel')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {timeoutOptions.map((opt) => (
                  <button
                    key={opt.seconds}
                    type="button"
                    onClick={() => onLockTimeoutChange(opt.seconds)}
                    className={`min-h-[44px] flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      lockTimeoutSeconds === opt.seconds
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {lockTimeoutSeconds === opt.seconds && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Storage & Media */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center gap-2.5 rtl:flex-row-reverse">
          <Images className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{mc.section}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{mc.sectionSub}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
            <div className="text-slate-500 dark:text-slate-400">{mc.photos}</div>
            <div className="mt-1 font-extrabold tabular-nums">{mediaSummary?.photoCount ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
            <div className="text-slate-500 dark:text-slate-400">{mc.storage}</div>
            <div className="mt-1 font-extrabold tabular-nums">{humanBytes(mediaSummary?.totalBytes ?? 0)}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
            <div className="text-slate-500 dark:text-slate-400">{mc.integrity}</div>
            <div className={`mt-1 font-extrabold ${(mediaSummary?.integrityIssueCount ?? 0) === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {(mediaSummary?.integrityIssueCount ?? 0) === 0 ? mc.healthy : `${mediaSummary?.integrityIssueCount} ${mc.issues}`}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMediaLibrary(true)}
          className="w-full min-h-[56px] flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left rtl:text-right cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 rtl:flex-row-reverse">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Images className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{mc.library}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{mc.librarySub}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Backup & Export Data */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
            {t(currentLanguage, 'backupSectionTitle')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(currentLanguage, 'backupSectionSub')}
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            disabled={isBackupBusy}
            onClick={() => void handleExportV2(false)}
            className="w-full min-h-[56px] flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left rtl:text-right cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center"><Archive className="w-4 h-4" /></div>
              <div><p className="font-bold text-xs sm:text-sm">{mc.dataOnly}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">{mc.dataOnlySub}</p></div>
            </div>
          </button>

          <button
            type="button"
            disabled={isBackupBusy}
            onClick={() => void handleExportV2(true)}
            className="w-full min-h-[56px] flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left rtl:text-right cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center"><ImageIcon className="w-4 h-4" /></div>
              <div><p className="font-bold text-xs sm:text-sm">{mc.fullBackup}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">{mc.fullBackupSub}</p></div>
            </div>
          </button>

          {/* Create Backup JSON */}
          <button
            type="button"
            onClick={handleExportJson}
            className="w-full min-h-[56px] flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left rtl:text-right cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {mc.legacy}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(currentLanguage, 'createBackupSub')}
                </p>
              </div>
            </div>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full min-h-[56px] flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left rtl:text-right cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {t(currentLanguage, 'exportCsvBtn')}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(currentLanguage, 'exportCsvSub')}
                </p>
              </div>
            </div>
          </button>

          {/* Import JSON */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[56px] flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-left rtl:text-right cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {t(currentLanguage, 'importDataBtn')}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t(currentLanguage, 'importDataSub')}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Default Currency */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
          <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
            {t(currentLanguage, 'currencySectionTitle')}
          </h3>
        </div>

        <div className="space-y-1.5">
          {SUPPORTED_CURRENCIES.map((c) => {
            const isSelected = c.code.toLowerCase() === currentCurrencyCode.toLowerCase();
            return (
              <button
                key={c.code}
                onClick={() => {
                  if (isSelected) return;

                  setErrorMessage(null);
                  if (!hasFinancialData) {
                    void (async () => {
                      try {
                        await onCurrencyChange(c.code);
                        setStatusMessage(t(currentLanguage, 'currencyChangeSaved', { currency: c.code }));
                      } catch {
                        setErrorMessage(t(currentLanguage, 'currencyConversionFailed'));
                      }
                    })();
                    return;
                  }

                  setPendingCurrencyCode(c.code);
                }}
                className={`w-full min-h-[48px] flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800/80'
                    : 'bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <span className="w-8 font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                    {c.symbol}
                  </span>
                  <span className="text-xs sm:text-sm">{c.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Preference */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
          <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
            {t(currentLanguage, 'appearanceTitle')}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['DARK', t(currentLanguage, 'themeDark')],
              ['LIGHT', t(currentLanguage, 'themeLight')],
              ['SYSTEM', t(currentLanguage, 'themeSystem')],
            ] as const
          ).map(([mode, label]) => {
            const isSelected = currentThemeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onThemeChange(mode)}
                className={`min-h-[44px] py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* About / installed version */}
      <div className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3.5 transition-colors">
        <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
          <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              {t(currentLanguage, 'aboutSectionTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(currentLanguage, 'aboutSectionSub')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
            <div className="text-slate-500 dark:text-slate-400 font-medium">{t(currentLanguage, 'versionLabel')}</div>
            <div className="mt-1 font-extrabold text-slate-900 dark:text-white tabular-nums">{APP_VERSION_NAME}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
            <div className="text-slate-500 dark:text-slate-400 font-medium">{t(currentLanguage, 'buildLabel')}</div>
            <div className="mt-1 font-extrabold text-slate-900 dark:text-white tabular-nums">{APP_VERSION_CODE}</div>
          </div>
        </div>
      </div>

      {/* 100% Local & Private Guarantee */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-3xl p-5 flex items-start space-x-3.5 rtl:space-x-reverse transition-colors">
        <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-300">
            {t(currentLanguage, 'privacyGuaranteeTitle')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {t(currentLanguage, 'privacyGuaranteeSub')}
          </p>
        </div>
      </div>

      {/* Danger Zone: Clear Data */}
      <div className="bg-white dark:bg-[#111928] border border-rose-200 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs space-y-3 transition-colors">
        <h3 className="font-bold text-rose-600 dark:text-rose-400 text-sm sm:text-base">
          {t(currentLanguage, 'dangerZoneTitle')}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {t(currentLanguage, 'dangerZoneSub', { count: totalExpensesCount })}
        </p>
        <button
          type="button"
          onClick={() => setShowClearModal(true)}
          className="min-h-[44px] flex items-center space-x-2 rtl:space-x-reverse text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-300 dark:border-rose-800 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
          <span>{t(currentLanguage, 'clearAllDataBtn')}</span>
        </button>
      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearModal}
        title={t(currentLanguage, 'clearAllDataModalTitle')}
        message={t(currentLanguage, 'clearAllDataModalMessage')}
        confirmText={t(currentLanguage, 'eraseEverythingBtn')}
        cancelText={t(currentLanguage, 'cancelBtn')}
        isDestructive={true}
        onConfirm={() => {
          void (async () => {
            try {
              await onClearAllData();
              setShowClearModal(false);
              setStatusMessage(t(currentLanguage, 'financialDataCleared'));
              setErrorMessage(null);
            } catch {
              setErrorMessage(t(currentLanguage, 'financialDataClearFailed'));
            }
          })();
        }}
        onCancel={() => setShowClearModal(false)}
      />

      {/* Import Preview Modal */}
      {pendingImportBackup && (
        <ImportPreviewModal
          isOpen={true}
          backup={pendingImportBackup}
          currentExpenseCount={totalExpensesCount}
          language={currentLanguage}
          onConfirm={handleConfirmImport}
          onClose={() => setPendingImportBackup(null)}
        />
      )}

      {pendingV2Backup && (
        <BackupV2ImportModal
          preview={pendingV2Backup.preview}
          language={currentLanguage}
          onConfirm={(replaceExisting) => void handleConfirmV2Import(replaceExisting)}
          onClose={() => setPendingV2Backup(null)}
        />
      )}

      {/* Safe Currency Conversion Modal */}
      {pendingCurrencyCode && (
        <CurrencyConversionModal
          key={`${currentCurrencyCode}-${pendingCurrencyCode}`}
          isOpen={true}
          sourceCurrencyCode={currentCurrencyCode}
          targetCurrencyCode={pendingCurrencyCode}
          expenseCount={totalExpensesCount}
          budgetCount={totalBudgetsCount}
          previewAmount={currencyPreviewAmount}
          initialRate={getSuggestedConversionRate(currentCurrencyCode, pendingCurrencyCode)}
          language={currentLanguage}
          onConfirm={async (targetUnitsPerSourceUnit) => {
            const targetCode = pendingCurrencyCode;
            await onCurrencyChange(targetCode, targetUnitsPerSourceUnit);
            setPendingCurrencyCode(null);
            setErrorMessage(null);
            setStatusMessage(t(currentLanguage, 'currencyChangeSaved', { currency: targetCode }));
          }}
          onClose={() => setPendingCurrencyCode(null)}
        />
      )}
    </div>
  );
};
