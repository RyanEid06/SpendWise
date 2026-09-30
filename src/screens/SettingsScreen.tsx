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
import { backupService } from '../features/backup/BackupService';
import { expenseService } from '../features/expenses/ExpenseService';
import { SettingsOverview, InlineSettingsSection } from '../features/settings/SettingsOverview';
import { overviewCopy } from '../features/settings/settingsCopy';
import { mediaService } from '../services/MediaService';
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
import type {
  SecureSessionActionResult,
  SensitiveAuthenticationReason,
} from '../security/SecureSessionService';

interface SettingsScreenProps {
  currentCurrencyCode: string;
  currentThemeMode: ThemeMode;
  currentLanguage: Language;
  totalExpensesCount: number;
  totalBudgetsCount: number;
  isAppLockEnabled: boolean;
  lockTimeoutSeconds: number;
  securityMode: 'native' | 'web';
  hasWebPin: boolean;
  migrationIssue: string | null;
  onAppLockToggle: (enabled: boolean) => Promise<SecureSessionActionResult>;
  onLockTimeoutChange: (seconds: number) => Promise<SecureSessionActionResult>;
  onSetWebPin: (pin: string) => Promise<SecureSessionActionResult>;
  onRequireFreshAuthentication: (
    reason: SensitiveAuthenticationReason
  ) => Promise<SecureSessionActionResult>;
  onCurrencyChange: (code: string, targetUnitsPerSourceUnit?: number) => void | Promise<void>;
  onThemeChange: (mode: ThemeMode) => void;
  onLanguageChange: (lang: Language) => void;
  onClearAllData: () => void | Promise<void>;
  onBackupRestored: () => void;
  onReviewSetup: () => void;
}

type SettingsPage = 'overview' | 'app-lock' | 'storage-media' | 'backup-restore';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentCurrencyCode,
  currentThemeMode,
  currentLanguage,
  totalExpensesCount,
  totalBudgetsCount,
  isAppLockEnabled,
  lockTimeoutSeconds,
  securityMode,
  hasWebPin,
  migrationIssue,
  onAppLockToggle,
  onLockTimeoutChange,
  onSetWebPin,
  onRequireFreshAuthentication,
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
  const [expandedSection, setExpandedSection] = useState<InlineSettingsSection>(null);
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

  const hasSavedPin = hasWebPin;
  const hasFinancialData = totalExpensesCount > 0 || totalBudgetsCount > 0;
  const currencyPreviewAmount =
    expenseService.listExpenses()[0]?.amount ??
    expenseService.listBudgets()[0]?.startingAmount ??
    0;

  const timeoutOptions = [
    { seconds: 0, label: t(currentLanguage, 'timeoutImmediate') },
    { seconds: 60, label: t(currentLanguage, 'timeout1Min') },
    { seconds: 300, label: t(currentLanguage, 'timeout5Mins') },
    { seconds: 900, label: t(currentLanguage, 'timeout15Mins') },
  ];

  const securityFailureMessage = (result: SecureSessionActionResult) => {
    if (currentLanguage === 'ar') {
      if (result.code === 'cancelled') return 'تم إلغاء المصادقة.';
      if (result.code === 'unavailable') return 'اضبط قفل شاشة Android آمنًا أو مصادقة حيوية قوية ثم أعد المحاولة.';
      if (result.code === 'credential_required') return 'يلزم تحقق حديث. اقفل SpendWise وافتحه مجددًا ثم أعد المحاولة.';
      if (result.code === 'missing_key' || result.code === 'invalidated_key' || result.code === 'unrecoverable_key') {
        return 'مفتاح الأمان المحمي غير متاح. لم يتم تعطيل قفل التطبيق ولم يتم حذف البيانات.';
      }
      return 'تعذّر إكمال عملية الأمان.';
    }
    if (currentLanguage === 'fr') {
      if (result.code === 'cancelled') return 'Authentification annulée.';
      if (result.code === 'unavailable') return 'Configurez un verrouillage Android sécurisé ou une biométrie forte puis réessayez.';
      if (result.code === 'credential_required') return 'Une authentification récente est requise. Reverrouillez puis déverrouillez SpendWise et réessayez.';
      if (result.code === 'missing_key' || result.code === 'invalidated_key' || result.code === 'unrecoverable_key') {
        return 'La clé de sécurité protégée est indisponible. Le verrouillage n’a pas été désactivé et les données n’ont pas été supprimées.';
      }
      return 'L’opération de sécurité n’a pas pu être terminée.';
    }
    if (result.code === 'cancelled') return 'Authentication was cancelled.';
    if (result.code === 'unavailable') return 'Set a secure Android screen lock or strong biometric, then try again.';
    if (result.code === 'credential_required') return 'Fresh authentication is required. Lock and unlock SpendWise, then try again.';
    if (result.code === 'missing_key' || result.code === 'invalidated_key' || result.code === 'unrecoverable_key') {
      return 'The protected security key is unavailable. App Lock stayed enabled and no data was discarded.';
    }
    return 'The security operation could not be completed.';
  };

  const requireFresh = async (reason: SensitiveAuthenticationReason) => {
    const result = await onRequireFreshAuthentication(reason);
    if (result.ok) return true;
    setErrorMessage(securityFailureMessage(result));
    return false;
  };

  const humanBytes = (bytes: number) => {
    if (bytes < 1024) return String(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const refreshMediaSummary = async () => {
    try {
      setMediaSummary(await mediaService.getStorageSummary());
    } catch {
      setMediaSummary(null);
    }
  };

  useEffect(() => {
    void refreshMediaSummary();
  }, [showMediaLibrary, totalExpensesCount]);

  const handleExportJson = async () => {
    try {
      const backup = backupService.createLegacy();
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
      setErrorMessage(copy.exportFailed);
    }
  };

  const handleExportV2 = async (includeMedia: boolean) => {
    if (isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      const blob = await backupService.createV2(includeMedia);
      const dateStamp = new Date().toISOString().split('T')[0];
      await exportBlobFile({
        fileName: 'spendwise_backup_v2_' + (includeMedia ? 'full' : 'data') + '_' + dateStamp + '.zip',
        blob,
        shareTitle: includeMedia ? copy.fullBackup : copy.dataOnly,
      });
      setStatusMessage(includeMedia ? copy.fullBackup : copy.dataOnly);
      setErrorMessage(null);
    } catch {
      setErrorMessage(copy.backupExportFailed);
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleExportCsv = async () => {
    if (!(await requireFresh('plaintext-export'))) return;
    try {
      const dateStamp = new Date().toISOString().split('T')[0];
      await exportTextFile({
        fileName: 'spendwise_expenses_' + dateStamp + '.csv',
        content: backupService.createCsv(),
        mimeType: 'text/csv',
        shareTitle: t(currentLanguage, 'exportCsvBtn'),
      });
      setStatusMessage(t(currentLanguage, 'exportCsvBtn'));
      setErrorMessage(null);
    } catch {
      setErrorMessage(copy.csvExportFailed);
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
          const parsed = backupService.validateLegacy(JSON.parse(await file.text()));
          setPendingV2Backup(null);
          setPendingImportBackup(parsed);
        } else {
          const preview = await backupService.previewV2(file);
          setPendingImportBackup(null);
          setPendingV2Backup({ file, preview });
        }
        setErrorMessage(null);
      } catch {
        setErrorMessage(copy.invalidBackup);
      }
    })();
  };

  const handleConfirmImport = async (replaceExisting: boolean) => {
    if (!pendingImportBackup) return;
    if (replaceExisting && !(await requireFresh('replace-restore'))) return;
    try {
      const summary = await backupService.restoreLegacy(pendingImportBackup, replaceExisting);
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
        setErrorMessage(copy.currencyMismatchReplace);
      } else {
        setErrorMessage(copy.importFailed);
      }
    }
  };

  const handleConfirmV2Import = async (replaceExisting: boolean) => {
    if (!pendingV2Backup || isBackupBusy) return;
    if (replaceExisting && !(await requireFresh('replace-restore'))) return;
    setIsBackupBusy(true);
    try {
      const summary = await backupService.restoreV2(pendingV2Backup.file, replaceExisting);
      setPendingV2Backup(null);
      onBackupRestored();
      await refreshMediaSummary();
      setStatusMessage(copy.imported + ': ' + summary.expensesImported + ' ' + copy.expenses + ', ' + summary.photosImported + ' ' + copy.photos);
      setErrorMessage(summary.warnings.length ? copy.backupWarning : null);
    } catch (error) {
      if (error instanceof Error && error.message === 'BACKUP_CURRENCY_MISMATCH') {
        setErrorMessage(copy.currencyMismatch);
      } else {
        setErrorMessage(copy.backupRestoreFailed);
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
            aria-label={copy.dismissMessage}
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
            aria-label={copy.dismissError}
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
                  if (securityMode === 'web' && enabled && !hasWebPin) {
                    setErrorMessage(t(currentLanguage, 'pinRequiredToEnable'));
                    return;
                  }
                  void (async () => {
                    setErrorMessage(null);
                    const result = await onAppLockToggle(enabled);
                    if (!result.ok) setErrorMessage(securityFailureMessage(result));
                  })();
                }}
                className="sr-only peer"
                aria-label={t(currentLanguage, 'appLockTitle')}
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/50 after:content-[''] after:absolute after:top-[14px] after:left-[4px] rtl:after:left-auto rtl:after:right-[4px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full"></div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {securityMode === 'native' ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-sm font-bold">
                  {currentLanguage === 'ar'
                    ? 'مصادقة Android'
                    : currentLanguage === 'fr'
                      ? 'Authentification Android'
                      : 'Android authentication'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {currentLanguage === 'ar'
                    ? 'يستخدم SpendWise قفل شاشة الجهاز أو المصادقة الحيوية القوية. لا يتم حفظ رمز PIN خاص بـ SpendWise على Android.'
                    : currentLanguage === 'fr'
                      ? 'SpendWise utilise le verrouillage de l’appareil ou une biométrie forte. Aucun PIN SpendWise séparé n’est enregistré sur Android.'
                      : 'SpendWise uses your device screen lock or strong biometrics. No separate SpendWise PIN is stored on Android.'}
                </p>
                {migrationIssue && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-2">
                    {currentLanguage === 'ar'
                      ? 'ترقية الأمان القديمة لم تكتمل بعد. تم الاحتفاظ بالحالة القديمة لمنع فقدان الوصول.'
                      : currentLanguage === 'fr'
                        ? 'La migration de sécurité héritée reste incomplète. L’ancien état a été conservé pour éviter un blocage.'
                        : 'Legacy security migration is still pending. The old state was preserved to prevent lockout.'}
                  </p>
                )}
              </div>
            ) : (
              <>
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
                    void (async () => {
                      if (!/^\d{4,8}$/.test(newPin) || newPin !== confirmPin) {
                        setErrorMessage(t(currentLanguage, 'pinMismatch'));
                        return;
                      }
                      const result = await onSetWebPin(newPin);
                      if (!result.ok) {
                        setErrorMessage(securityFailureMessage(result));
                        return;
                      }
                      setNewPin('');
                      setConfirmPin('');
                      setErrorMessage(null);
                      setStatusMessage(t(currentLanguage, 'pinSaved'));
                    })();
                  }}
                  className="min-h-[48px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold"
                >
                  {t(currentLanguage, 'savePinBtn')}
                </button>
              </>
            )}
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
                  onClick={() => {
                    void (async () => {
                      const result = await onLockTimeoutChange(option.seconds);
                      if (!result.ok) setErrorMessage(securityFailureMessage(result));
                    })();
                  }}
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

      <SettingsOverview
        currentCurrencyCode={currentCurrencyCode}
        currentThemeMode={currentThemeMode}
        currentLanguage={currentLanguage}
        totalExpensesCount={totalExpensesCount}
        isAppLockEnabled={isAppLockEnabled}
        storageValue={storageValue}
        copy={copy}
        expandedSection={expandedSection}
        onExpandedSectionChange={setExpandedSection}
        onThemeChange={onThemeChange}
        onLanguageChange={onLanguageChange}
        onCurrencyRequest={requestCurrencyChange}
        onOpenAppLock={() => setSettingsPage('app-lock')}
        onOpenStorageMedia={() => setSettingsPage('storage-media')}
        onOpenBackupRestore={() => setSettingsPage('backup-restore')}
        onReviewSetup={() => setShowSetupReplayModal(true)}
        onOpenTerms={() => setLegalKind('terms')}
        onOpenPrivacy={() => setLegalKind('privacy')}
        onClearData={() => setShowClearModal(true)}
      />

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
              if (!(await requireFresh('clear-app-data'))) return;
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
