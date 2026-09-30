import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  Image as ImageIcon,
  Images,
  Info,
  Lock,
  Moon,
  Palette,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
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

type SettingsPage = 'overview' | 'app-lock' | 'storage-media' | 'backup-restore';
type InlineSection = 'appearance' | 'language' | 'currency' | null;

const overviewCopy = {
  en: {
    appearance: 'Appearance',
    language: 'Language',
    currency: 'Currency',
    appLock: 'App Lock',
    storage: 'Storage & Media',
    backup: 'Backup & Restore',
    reviewSetup: 'Review setup',
    reviewSetupSub: 'Review the setup steps without deleting your data.',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    clearData: 'Clear App Data',
    enabled: 'Enabled',
    disabled: 'Disabled',
    back: 'Back',
    appLockSub: 'PIN and auto-lock',
    storageSub: 'Media library, storage and integrity',
    backupSub: 'Backup, restore and CSV export',
    setupConfirmTitle: 'Run setup again?',
    setupConfirmMessage: 'You can review the setup steps again. Your existing expenses and settings will not be deleted.',
    continue: 'Continue',
    cancel: 'Cancel',
    version: 'Version',
    build: 'Build',
    photos: 'photos',
    storagePageSub: 'Private SpendWise photo storage and integrity.',
    backupPageSub: 'Create portable backups, restore data, or export CSV.',
    appLockPageSub: 'Control PIN protection and automatic locking.',
    mediaLibrary: 'Media Library',
    mediaLibrarySub: 'Browse, inspect and export attached photos.',
    photoStorage: 'Photo storage',
    integrity: 'Integrity',
    healthy: 'Healthy',
    issues: 'issues',
    dataOnly: 'Backup v2 · Data only',
    dataOnlySub: 'Ledger and settings without photo binaries.',
    fullBackup: 'Backup v2 · Data + photos',
    fullBackupSub: 'Portable ZIP with ledger and private attachment photos.',
    legacy: 'Legacy Backup v1 JSON',
    imported: 'Backup v2 restored',
  },
  fr: {
    appearance: 'Apparence',
    language: 'Langue',
    currency: 'Devise',
    appLock: 'Verrouillage',
    storage: 'Stockage et médias',
    backup: 'Sauvegarde et restauration',
    reviewSetup: 'Revoir la configuration',
    reviewSetupSub: 'Revoyez les étapes sans supprimer vos données.',
    terms: 'Conditions d’utilisation',
    privacy: 'Politique de confidentialité',
    clearData: 'Effacer les données de l’application',
    enabled: 'Activé',
    disabled: 'Désactivé',
    back: 'Retour',
    appLockSub: 'Code PIN et verrouillage automatique',
    storageSub: 'Médiathèque, stockage et intégrité',
    backupSub: 'Sauvegarde, restauration et export CSV',
    setupConfirmTitle: 'Revoir la configuration ?',
    setupConfirmMessage: 'Vous pouvez revoir les étapes de configuration. Vos dépenses et réglages existants ne seront pas supprimés.',
    continue: 'Continuer',
    cancel: 'Annuler',
    version: 'Version',
    build: 'Build',
    photos: 'photos',
    storagePageSub: 'Stockage privé des photos SpendWise et intégrité.',
    backupPageSub: 'Créez des sauvegardes, restaurez des données ou exportez un CSV.',
    appLockPageSub: 'Gérez le code PIN et le verrouillage automatique.',
    mediaLibrary: 'Médiathèque',
    mediaLibrarySub: 'Parcourir, vérifier et exporter les photos jointes.',
    photoStorage: 'Stockage photos',
    integrity: 'Intégrité',
    healthy: 'Correcte',
    issues: 'problèmes',
    dataOnly: 'Backup v2 · Données seules',
    dataOnlySub: 'Registre et réglages sans fichiers photo.',
    fullBackup: 'Backup v2 · Données + photos',
    fullBackupSub: 'ZIP portable avec registre et photos privées.',
    legacy: 'Backup v1 JSON hérité',
    imported: 'Backup v2 restauré',
  },
  ar: {
    appearance: 'المظهر',
    language: 'اللغة',
    currency: 'العملة',
    appLock: 'قفل التطبيق',
    storage: 'التخزين والوسائط',
    backup: 'النسخ الاحتياطي والاستعادة',
    reviewSetup: 'مراجعة الإعداد',
    reviewSetupSub: 'راجع خطوات الإعداد من دون حذف بياناتك.',
    terms: 'شروط الاستخدام',
    privacy: 'سياسة الخصوصية',
    clearData: 'مسح بيانات التطبيق',
    enabled: 'مفعّل',
    disabled: 'معطّل',
    back: 'رجوع',
    appLockSub: 'رمز PIN والقفل التلقائي',
    storageSub: 'مكتبة الوسائط والتخزين والسلامة',
    backupSub: 'النسخ والاستعادة وتصدير CSV',
    setupConfirmTitle: 'تشغيل الإعداد مرة أخرى؟',
    setupConfirmMessage: 'يمكنك مراجعة خطوات الإعداد مرة أخرى. لن يتم حذف المصاريف أو الإعدادات الحالية.',
    continue: 'متابعة',
    cancel: 'إلغاء',
    version: 'الإصدار',
    build: 'البنية',
    photos: 'صور',
    storagePageSub: 'تخزين صور SpendWise الخاصة وفحص سلامتها.',
    backupPageSub: 'أنشئ نسخاً احتياطية أو استعد البيانات أو صدّر CSV.',
    appLockPageSub: 'تحكم برمز PIN والقفل التلقائي.',
    mediaLibrary: 'مكتبة الوسائط',
    mediaLibrarySub: 'استعراض الصور المرفقة وفحصها وتصديرها.',
    photoStorage: 'مساحة الصور',
    integrity: 'السلامة',
    healthy: 'سليمة',
    issues: 'مشكلات',
    dataOnly: 'النسخة v2 · بيانات فقط',
    dataOnlySub: 'السجل والإعدادات بدون ملفات الصور.',
    fullBackup: 'النسخة v2 · بيانات + صور',
    fullBackupSub: 'ملف ZIP محمول يتضمن السجل والصور الخاصة.',
    legacy: 'نسخة v1 JSON القديمة',
    imported: 'تمت استعادة النسخة v2',
  },
} as const;

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  hint?: string;
  indicator: 'expand' | 'navigate' | 'none';
  expanded?: boolean;
  destructive?: boolean;
  onClick: () => void;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  value,
  hint,
  indicator,
  expanded = false,
  destructive = false,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-expanded={indicator === 'expand' ? expanded : undefined}
    className={
      'w-full min-h-[56px] px-3.5 py-2.5 flex items-center gap-3 text-left rtl:text-right transition-colors ' +
      (destructive
        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20'
        : 'text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900/40')
    }
  >
    <span className={
      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ' +
      (destructive
        ? 'bg-rose-100 dark:bg-rose-950/50'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
    }>
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold leading-5">{label}</span>
      {hint && <span className="block text-[11px] leading-4 text-slate-500 dark:text-slate-400 mt-0.5">{hint}</span>}
    </span>
    {value && (
      <span className="max-w-[42%] text-xs text-slate-500 dark:text-slate-400 text-right rtl:text-left break-words">
        {value}
      </span>
    )}
    {indicator === 'expand' && (
      expanded
        ? <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
        : <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
    )}
    {indicator === 'navigate' && (
      <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 rtl:rotate-180" aria-hidden="true" />
    )}
  </button>
);

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
  const copy = overviewCopy[currentLanguage];

  const [settingsPage, setSettingsPage] = useState<SettingsPage>('overview');
  const [expandedSection, setExpandedSection] = useState<InlineSection>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showSetupReplayModal, setShowSetupReplayModal] = useState(false);
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

  const languages: { code: Language; name: string; direction: string }[] = [
    { code: 'en', name: 'English', direction: 'LTR' },
    { code: 'fr', name: 'Français', direction: 'LTR' },
    { code: 'ar', name: 'العربية', direction: 'RTL' },
  ];

  const humanBytes = (bytes: number) => {
    if (bytes < 1024) return String(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

  const handleExportJson = async () => {
    try {
      const backup = StorageManager.createBackupJson();
      const dateStamp = new Date().toISOString().split('T')[0];
      await exportTextFile({
        fileName: 'spendwise_backup_' + dateStamp + '.json',
        content: JSON.stringify(backup, null, 2),
        mimeType: 'application/json',
        shareTitle: t(currentLanguage, 'createBackupBtn'),
      });
      setStatusMessage(t(currentLanguage, 'createBackupBtn') + ': ' + backup.metadata.totalExpenses + ' / ' + backup.metadata.totalBudgets);
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
        fileName: 'spendwise_backup_v2_' + (includeMedia ? 'full' : 'data') + '_' + dateStamp + '.zip',
        blob,
        shareTitle: includeMedia ? copy.fullBackup : copy.dataOnly,
      });
      setStatusMessage(includeMedia ? copy.fullBackup : copy.dataOnly);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Backup v2 export failed.');
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const dateStamp = new Date().toISOString().split('T')[0];
      await exportTextFile({
        fileName: 'spendwise_expenses_' + dateStamp + '.csv',
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

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
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
          ? t(currentLanguage, 'replaceRestoreBtn') + ': ' + summary.expensesImported
          : t(currentLanguage, 'mergeImportBtn') + ': ' + summary.expensesImported
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
    if (!pendingV2Backup || isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      const summary = await StorageManager.restoreBackupV2(pendingV2Backup.file, replaceExisting);
      setPendingV2Backup(null);
      onBackupRestored();
      await refreshMediaSummary();
      setStatusMessage(copy.imported + ': ' + summary.expensesImported + ' expenses, ' + summary.photosImported + ' photos');
      setErrorMessage(summary.warnings.length ? summary.warnings.join(', ') : null);
    } catch (error) {
      if (error instanceof Error && error.message === 'BACKUP_CURRENCY_MISMATCH') {
        setErrorMessage('This backup uses a different currency. Merge is blocked to prevent amounts from being relabeled incorrectly.');
      } else {
        setErrorMessage('Backup v2 restore failed. Your current data was kept whenever rollback was possible.');
      }
    } finally {
      setIsBackupBusy(false);
    }
  };

  const requestCurrencyChange = (code: string) => {
    if (code.toLowerCase() === currentCurrencyCode.toLowerCase()) return;
    setErrorMessage(null);

    if (!hasFinancialData) {
      void (async () => {
        try {
          await onCurrencyChange(code);
          setStatusMessage(t(currentLanguage, 'currencyChangeSaved', { currency: code }));
        } catch {
          setErrorMessage(t(currentLanguage, 'currencyConversionFailed'));
        }
      })();
      return;
    }

    setPendingCurrencyCode(code);
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
        return;
      }
      if (showSetupReplayModal) {
        setShowSetupReplayModal(false);
        return;
      }
      if (showMediaLibrary || legalKind) {
        return;
      }
      if (settingsPage !== 'overview') {
        setSettingsPage('overview');
      }
    };

    window.addEventListener('spendwise-native-back', handleNativeBack);
    return () => window.removeEventListener('spendwise-native-back', handleNativeBack);
  }, [
    pendingCurrencyCode,
    pendingImportBackup,
    pendingV2Backup,
    legalKind,
    settingsPage,
    showClearModal,
    showMediaLibrary,
    showSetupReplayModal,
  ]);

  if (legalKind) {
    return <LegalDocumentScreen language={currentLanguage} kind={legalKind} onClose={() => setLegalKind(null)} />;
  }

  if (showMediaLibrary) {
    return <MediaLibraryScreen language={currentLanguage} onClose={() => setShowMediaLibrary(false)} />;
  }

  const notificationBlock = (
    <>
      {statusMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center font-bold"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center font-bold"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
    </>
  );

  const subScreenHeader = (title: string, subtitle: string) => (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => setSettingsPage('overview')}
        className="min-w-[48px] min-h-[48px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] flex items-center justify-center shrink-0"
        aria-label={copy.back}
      >
        <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
      </button>
      <div className="min-w-0 pt-1">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );

  const modalLayerOpen =
    showClearModal ||
    showSetupReplayModal ||
    pendingImportBackup !== null ||
    pendingV2Backup !== null ||
    pendingCurrencyCode !== null;

  if (settingsPage === 'app-lock') {
    return (
      <div className="space-y-4 pb-28 animate-screen-enter" data-native-back-layer="true">
        {subScreenHeader(copy.appLock, copy.appLockPageSub)}
        {notificationBlock}

        <section className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-4 space-y-4">
          <div className="min-h-[56px] flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm">{t(currentLanguage, 'appLockTitle')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAppLockEnabled ? copy.enabled : copy.disabled}
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer min-h-[48px] min-w-[52px] shrink-0">
              <input
                type="checkbox"
                checked={isAppLockEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
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
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/50 after:content-[''] after:absolute after:top-[14px] after:left-[4px] rtl:after:left-auto rtl:after:right-[4px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t(currentLanguage, hasSavedPin ? 'changePinLabel' : 'setPinLabel')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ''))}
                placeholder={t(currentLanguage, 'newPinPlaceholder')}
                className="min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-sm"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ''))}
                placeholder={t(currentLanguage, 'confirmPinPlaceholder')}
                className="min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-sm"
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
              className="min-h-[48px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold"
            >
              {t(currentLanguage, 'savePinBtn')}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t(currentLanguage, 'lockTimeoutLabel')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {timeoutOptions.map((option) => (
                <button
                  key={option.seconds}
                  type="button"
                  disabled={!isAppLockEnabled}
                  onClick={() => onLockTimeoutChange(option.seconds)}
                  className={
                    'min-h-[48px] flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs font-medium disabled:opacity-45 ' +
                    (lockTimeoutSeconds === option.seconds
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-600 dark:text-slate-400')
                  }
                >
                  <span>{option.label}</span>
                  {lockTimeoutSeconds === option.seconds && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (settingsPage === 'storage-media') {
    return (
      <div className="space-y-4 pb-28 animate-screen-enter" data-native-back-layer="true">
        {subScreenHeader(copy.storage, copy.storagePageSub)}
        {notificationBlock}

        <section className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
              <div className="text-slate-500 dark:text-slate-400">{copy.photos}</div>
              <div className="mt-1 font-extrabold tabular-nums">{mediaSummary?.photoCount ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
              <div className="text-slate-500 dark:text-slate-400">{copy.photoStorage}</div>
              <div className="mt-1 font-extrabold tabular-nums">{humanBytes(mediaSummary?.totalBytes ?? 0)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200/70 dark:border-slate-800/60 p-3">
              <div className="text-slate-500 dark:text-slate-400">{copy.integrity}</div>
              <div className={
                'mt-1 font-extrabold ' +
                ((mediaSummary?.integrityIssueCount ?? 0) === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400')
              }>
                {(mediaSummary?.integrityIssueCount ?? 0) === 0
                  ? copy.healthy
                  : String(mediaSummary?.integrityIssueCount ?? 0) + ' ' + copy.issues}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMediaLibrary(true)}
            className="w-full min-h-[56px] px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left rtl:text-right"
          >
            <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Images className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{copy.mediaLibrary}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{copy.mediaLibrarySub}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0" />
          </button>
        </section>
      </div>
    );
  }

  if (settingsPage === 'backup-restore') {
    return (
      <div
        className="space-y-4 pb-28 animate-screen-enter"
        data-native-back-layer="true"
      >
        {subScreenHeader(copy.backup, copy.backupPageSub)}
        {notificationBlock}

        <section className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl p-4 space-y-2">
          <button
            type="button"
            disabled={isBackupBusy}
            onClick={() => void handleExportV2(false)}
            className="w-full min-h-[56px] px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left rtl:text-right disabled:opacity-50"
          >
            <Archive className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{copy.dataOnly}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">{copy.dataOnlySub}</span>
            </span>
          </button>

          <button
            type="button"
            disabled={isBackupBusy}
            onClick={() => void handleExportV2(true)}
            className="w-full min-h-[56px] px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left rtl:text-right disabled:opacity-50"
          >
            <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{copy.fullBackup}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">{copy.fullBackupSub}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="w-full min-h-[56px] px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left rtl:text-right"
          >
            <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{copy.legacy}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">{t(currentLanguage, 'createBackupSub')}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full min-h-[56px] px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left rtl:text-right"
          >
            <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{t(currentLanguage, 'exportCsvBtn')}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">{t(currentLanguage, 'exportCsvSub')}</span>
            </span>
          </button>

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
            className="w-full min-h-[56px] px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-left rtl:text-right"
          >
            <Upload className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{t(currentLanguage, 'importDataBtn')}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">{t(currentLanguage, 'importDataSub')}</span>
            </span>
          </button>
        </section>

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
      </div>
    );
  }

  const appearanceValue =
    currentThemeMode === 'SYSTEM'
      ? t(currentLanguage, 'themeSystem')
      : currentThemeMode === 'LIGHT'
        ? t(currentLanguage, 'themeLight')
        : t(currentLanguage, 'themeDark');
  const languageValue = languages.find((item) => item.code === currentLanguage)?.name ?? 'English';
  const storageValue =
    String(mediaSummary?.photoCount ?? 0) + ' ' + copy.photos + ' · ' + humanBytes(mediaSummary?.totalBytes ?? 0);

  return (
    <div
      className="space-y-4 pb-28 animate-screen-enter"
      data-native-back-layer={modalLayerOpen ? 'true' : undefined}
    >
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t(currentLanguage, 'settingsTitle')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t(currentLanguage, 'settingsSub')}
        </p>
      </div>

      {notificationBlock}

      <section
        className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80"
        data-settings-overview="compact"
      >
        <div>
          <SettingsRow
            icon={<Palette className="w-4 h-4" />}
            label={copy.appearance}
            value={appearanceValue}
            indicator="expand"
            expanded={expandedSection === 'appearance'}
            onClick={() => setExpandedSection(expandedSection === 'appearance' ? null : 'appearance')}
          />
          {expandedSection === 'appearance' && (
            <div className="px-3.5 pb-3 grid grid-cols-3 gap-2" data-inline-settings="appearance">
              {(
                [
                  ['SYSTEM', t(currentLanguage, 'themeSystem')],
                  ['LIGHT', t(currentLanguage, 'themeLight')],
                  ['DARK', t(currentLanguage, 'themeDark')],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onThemeChange(mode)}
                  className={
                    'min-h-[48px] px-2 rounded-xl border text-xs font-bold ' +
                    (currentThemeMode === mode
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-300')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SettingsRow
            icon={<Globe className="w-4 h-4" />}
            label={copy.language}
            value={languageValue}
            indicator="expand"
            expanded={expandedSection === 'language'}
            onClick={() => setExpandedSection(expandedSection === 'language' ? null : 'language')}
          />
          {expandedSection === 'language' && (
            <div className="px-3.5 pb-3 grid grid-cols-1 gap-2" data-inline-settings="language">
              {languages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => onLanguageChange(language.code)}
                  className={
                    'min-h-[48px] px-3 rounded-xl border text-sm font-bold flex items-center justify-between gap-3 text-left rtl:text-right ' +
                    (currentLanguage === language.code
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]')
                  }
                >
                  <span>{language.name}</span>
                  <span className="text-[10px] opacity-70">{language.direction}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SettingsRow
            icon={<DollarSign className="w-4 h-4" />}
            label={copy.currency}
            value={currentCurrencyCode.toUpperCase()}
            indicator="expand"
            expanded={expandedSection === 'currency'}
            onClick={() => setExpandedSection(expandedSection === 'currency' ? null : 'currency')}
          />
          {expandedSection === 'currency' && (
            <div className="px-3.5 pb-3 space-y-1.5" data-inline-settings="currency">
              {SUPPORTED_CURRENCIES.map((currency) => {
                const selected = currency.code.toLowerCase() === currentCurrencyCode.toLowerCase();
                return (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => requestCurrencyChange(currency.code)}
                    className={
                      'w-full min-h-[48px] px-3 rounded-xl border flex items-center justify-between gap-3 text-left rtl:text-right text-xs ' +
                      (selected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]')
                    }
                  >
                    <span className="min-w-0 flex items-center gap-3">
                      <span className="w-9 font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">{currency.symbol}</span>
                      <span className="truncate">{currency.name}</span>
                    </span>
                    {selected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <SettingsRow
          icon={<Lock className="w-4 h-4" />}
          label={copy.appLock}
          value={isAppLockEnabled ? copy.enabled : copy.disabled}
          hint={copy.appLockSub}
          indicator="navigate"
          onClick={() => setSettingsPage('app-lock')}
        />

        <SettingsRow
          icon={<Images className="w-4 h-4" />}
          label={copy.storage}
          value={storageValue}
          hint={copy.storageSub}
          indicator="navigate"
          onClick={() => setSettingsPage('storage-media')}
        />

        <SettingsRow
          icon={<Database className="w-4 h-4" />}
          label={copy.backup}
          hint={copy.backupSub}
          indicator="navigate"
          onClick={() => setSettingsPage('backup-restore')}
        />

        <SettingsRow
          icon={<RotateCcw className="w-4 h-4" />}
          label={copy.reviewSetup}
          hint={copy.reviewSetupSub}
          indicator="navigate"
          onClick={() => setShowSetupReplayModal(true)}
        />

        <SettingsRow
          icon={<FileText className="w-4 h-4" />}
          label={copy.terms}
          indicator="navigate"
          onClick={() => setLegalKind('terms')}
        />

        <SettingsRow
          icon={<ShieldCheck className="w-4 h-4" />}
          label={copy.privacy}
          indicator="navigate"
          onClick={() => setLegalKind('privacy')}
        />
      </section>

      <div className="px-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{copy.version} <strong className="font-bold text-slate-700 dark:text-slate-300">{APP_VERSION_NAME}</strong></span>
        <span>{copy.build} <strong className="font-bold text-slate-700 dark:text-slate-300">{APP_VERSION_CODE}</strong></span>
      </div>

      <section className="bg-white dark:bg-[#111928] border border-rose-200 dark:border-rose-900/50 rounded-3xl overflow-hidden">
        <SettingsRow
          icon={<Trash2 className="w-4 h-4" />}
          label={copy.clearData}
          hint={t(currentLanguage, 'dangerZoneSub', { count: totalExpensesCount })}
          indicator="none"
          destructive={true}
          onClick={() => setShowClearModal(true)}
        />
      </section>

      <ConfirmationModal
        isOpen={showSetupReplayModal}
        title={copy.setupConfirmTitle}
        message={copy.setupConfirmMessage}
        confirmText={copy.continue}
        cancelText={copy.cancel}
        onConfirm={() => {
          setShowSetupReplayModal(false);
          onReviewSetup();
        }}
        onCancel={() => setShowSetupReplayModal(false)}
      />

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

      {pendingCurrencyCode && (
        <CurrencyConversionModal
          key={currentCurrencyCode + '-' + pendingCurrencyCode}
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
