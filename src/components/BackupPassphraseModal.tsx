import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';
import type { Language } from '../types';
import { ViewportPortal } from './ViewportPortal';
import { useModalFocus } from './useModalFocus';

const labels = {
  en: {
    createTitle: 'Create encrypted backup',
    restoreTitle: 'Unlock encrypted backup',
    createIntro: 'Choose a backup password. You will need it to restore this backup on another device.',
    restoreIntro: 'Enter the backup password to authenticate and decrypt this file.',
    unrecoverable: 'SpendWise cannot recover a forgotten backup password. Store it somewhere safe.',
    includePhotos: 'Include photos',
    includePhotosOff: 'Off by default to keep backups smaller. Your ledger and settings are still included.',
    includePhotosOn: 'Private attached photos will be included. This can make the backup much larger.',
    password: 'Backup password',
    confirm: 'Confirm password',
    placeholder: 'At least 8 characters',
    mismatch: 'Passwords must match and contain at least 8 characters.',
    cancel: 'Cancel',
    create: 'Create encrypted backup',
    unlock: 'Unlock backup',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  fr: {
    createTitle: 'Créer une sauvegarde chiffrée',
    restoreTitle: 'Déverrouiller la sauvegarde chiffrée',
    createIntro: 'Choisissez un mot de passe de sauvegarde. Il sera requis pour restaurer cette sauvegarde sur un autre appareil.',
    restoreIntro: 'Saisissez le mot de passe de sauvegarde pour authentifier et déchiffrer ce fichier.',
    unrecoverable: 'SpendWise ne peut pas récupérer un mot de passe de sauvegarde oublié. Conservez-le en lieu sûr.',
    includePhotos: 'Inclure les photos',
    includePhotosOff: 'Désactivé par défaut pour garder la sauvegarde plus légère. Le registre et les réglages restent inclus.',
    includePhotosOn: 'Les photos privées jointes seront incluses. La sauvegarde peut devenir beaucoup plus volumineuse.',
    password: 'Mot de passe de sauvegarde',
    confirm: 'Confirmer le mot de passe',
    placeholder: 'Au moins 8 caractères',
    mismatch: 'Les mots de passe doivent correspondre et contenir au moins 8 caractères.',
    cancel: 'Annuler',
    create: 'Créer la sauvegarde chiffrée',
    unlock: 'Déverrouiller',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
  },
  ar: {
    createTitle: 'إنشاء نسخة احتياطية مشفّرة',
    restoreTitle: 'فتح النسخة الاحتياطية المشفّرة',
    createIntro: 'اختر كلمة مرور للنسخة الاحتياطية. ستحتاج إليها لاستعادة النسخة على جهاز آخر.',
    restoreIntro: 'أدخل كلمة مرور النسخة الاحتياطية للتحقق من الملف وفك تشفيره.',
    unrecoverable: 'لا يستطيع SpendWise استعادة كلمة مرور نسخة احتياطية منسية. احفظها في مكان آمن.',
    includePhotos: 'تضمين الصور',
    includePhotosOff: 'موقوف افتراضياً لإبقاء النسخة أصغر. تبقى البيانات والإعدادات مشمولة.',
    includePhotosOn: 'سيتم تضمين الصور الخاصة المرفقة. قد يزيد ذلك حجم النسخة بشكل كبير.',
    password: 'كلمة مرور النسخة الاحتياطية',
    confirm: 'تأكيد كلمة المرور',
    placeholder: '8 أحرف على الأقل',
    mismatch: 'يجب أن تتطابق كلمتا المرور وأن تحتوي كل منهما على 8 أحرف على الأقل.',
    cancel: 'إلغاء',
    create: 'إنشاء النسخة المشفّرة',
    unlock: 'فتح النسخة',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
  },
} as const;

export const BackupPassphraseModal: React.FC<{
  mode: 'create' | 'restore';
  language: Language;
  busy?: boolean;
  externalError?: string | null;
  includePhotos?: boolean;
  onIncludePhotosChange?: (includePhotos: boolean) => void;
  onSubmit: (passphrase: string) => void | Promise<void>;
  onClose: () => void;
}> = ({
  mode,
  language,
  busy = false,
  externalError = null,
  includePhotos = false,
  onIncludePhotosChange,
  onSubmit,
  onClose,
}) => {
  const text = labels[language];
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const dialogRef = useModalFocus(mode === 'create' && onIncludePhotosChange
    ? '#backup-include-photos'
    : 'input[type="password"], input[type="text"]');

  useEffect(() => {
    return () => {
      setPassphrase('');
      setConfirm('');
    };
  }, []);

  const submit = () => {
    const length = Array.from(passphrase).length;
    if (length === 0 || (mode === 'create' && (length < 8 || passphrase !== confirm))) {
      setLocalError(text.mismatch);
      return;
    }
    setLocalError(null);
    void onSubmit(passphrase);
  };

  const inputType = showPassword ? 'text' : 'password';
  const visibilityLabel = showPassword ? text.hidePassword : text.showPassword;

  return (
    <ViewportPortal>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-3 sm:p-4 flex items-end sm:items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-passphrase-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-3xl bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
          <div className="shrink-0 z-10 p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111928]/95 backdrop-blur">
            <div id="backup-passphrase-title" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white min-w-0">
              <KeyRound className="w-5 h-5 shrink-0" />
              <span className="truncate">{mode === 'create' ? text.createTitle : text.restoreTitle}</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-w-[48px] min-h-[48px] rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
              aria-label={text.cancel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto p-5 space-y-5">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {mode === 'create' ? text.createIntro : text.restoreIntro}
            </p>

            {mode === 'create' && onIncludePhotosChange && (
              <button
                id="backup-include-photos"
                type="button"
                role="switch"
                aria-checked={includePhotos}
                aria-label={text.includePhotos}
                aria-describedby="backup-include-photos-help"
                disabled={busy}
                onClick={() => onIncludePhotosChange(!includePhotos)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] p-3.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50"
              >
                <span className="flex items-center justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{text.includePhotos}</span>
                    <span id="backup-include-photos-help" className="block mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {includePhotos ? text.includePhotosOn : text.includePhotosOff}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative shrink-0 w-[52px] h-7 rounded-full border transition-colors ${
                      includePhotos
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm transition-transform ${
                        includePhotos
                          ? 'left-[22px] rtl:left-auto rtl:right-[22px]'
                          : 'left-0.5 rtl:left-auto rtl:right-0.5'
                      }`}
                    />
                  </span>
                </span>
              </button>
            )}

            <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">{text.unrecoverable}</p>
            </div>

            <div className="block space-y-2">
              <label htmlFor="backup-password" className="block text-sm font-bold text-slate-800 dark:text-slate-200">{text.password}</label>
              <div className="relative">
                <input
                  id="backup-password"
                  type={inputType}
                  autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                  value={passphrase}
                  maxLength={256}
                  onChange={(event) => setPassphrase(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !busy) submit();
                  }}
                  placeholder={text.placeholder}
                  className="w-full min-h-[52px] ps-3 pe-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F19] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 end-0 min-w-[48px] flex items-center justify-center text-slate-500 dark:text-slate-300"
                  aria-label={visibilityLabel}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mode === 'create' && (
              <label htmlFor="backup-password-confirm" className="block space-y-2">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{text.confirm}</span>
                <input
                  id="backup-password-confirm"
                  type={inputType}
                  autoComplete="new-password"
                  value={confirm}
                  maxLength={256}
                  onChange={(event) => setConfirm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !busy) submit();
                  }}
                  placeholder={text.placeholder}
                  className="w-full min-h-[52px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F19] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </label>
            )}

            {(localError || externalError) && (
              <div role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300 rounded-xl bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5">
                {localError || externalError}
              </div>
            )}
          </div>

          <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111928]/95 backdrop-blur flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-bold disabled:opacity-50"
            >
              {text.cancel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="min-h-[48px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-sm font-extrabold disabled:opacity-50"
            >
              {mode === 'create' ? text.create : text.unlock}
            </button>
          </div>
        </div>
      </div>
    </ViewportPortal>
  );
};
