import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, X } from 'lucide-react';
import type { Language } from '../types';
import { ViewportPortal } from './ViewportPortal';
import { useModalFocus } from './useModalFocus';

const labels = {
  en: {
    createTitle: 'Protect Backup v3',
    restoreTitle: 'Unlock Backup v3',
    createIntro: 'This passphrase is required to restore the backup on another device.',
    restoreIntro: 'Enter the Backup v3 passphrase to authenticate and decrypt this file.',
    unrecoverable: 'SpendWise cannot recover a forgotten backup passphrase. Store it somewhere safe.',
    passphrase: 'Backup passphrase',
    confirm: 'Confirm passphrase',
    placeholder: 'At least 8 characters',
    mismatch: 'Passphrases must match and contain at least 8 characters.',
    cancel: 'Cancel',
    create: 'Create secure backup',
    unlock: 'Unlock backup',
  },
  fr: {
    createTitle: 'Protéger le Backup v3',
    restoreTitle: 'Déverrouiller le Backup v3',
    createIntro: 'Cette phrase secrète est requise pour restaurer la sauvegarde sur un autre appareil.',
    restoreIntro: 'Saisissez la phrase secrète Backup v3 pour authentifier et déchiffrer ce fichier.',
    unrecoverable: 'SpendWise ne peut pas récupérer une phrase secrète oubliée. Conservez-la en lieu sûr.',
    passphrase: 'Phrase secrète de sauvegarde',
    confirm: 'Confirmer la phrase secrète',
    placeholder: 'Au moins 8 caractères',
    mismatch: 'Les phrases secrètes doivent correspondre et contenir au moins 8 caractères.',
    cancel: 'Annuler',
    create: 'Créer la sauvegarde sécurisée',
    unlock: 'Déverrouiller',
  },
  ar: {
    createTitle: 'حماية النسخة v3',
    restoreTitle: 'فتح النسخة v3',
    createIntro: 'ستحتاج إلى عبارة المرور هذه لاستعادة النسخة على جهاز آخر.',
    restoreIntro: 'أدخل عبارة مرور النسخة v3 للتحقق من الملف وفك تشفيره.',
    unrecoverable: 'لا يستطيع SpendWise استعادة عبارة مرور منسية. احفظها في مكان آمن.',
    passphrase: 'عبارة مرور النسخة',
    confirm: 'تأكيد عبارة المرور',
    placeholder: '8 أحرف على الأقل',
    mismatch: 'يجب أن تتطابق عبارتا المرور وأن تحتوي كل منهما على 8 أحرف على الأقل.',
    cancel: 'إلغاء',
    create: 'إنشاء نسخة آمنة',
    unlock: 'فتح النسخة',
  },
} as const;

export const BackupPassphraseModal: React.FC<{
  mode: 'create' | 'restore';
  language: Language;
  busy?: boolean;
  externalError?: string | null;
  onSubmit: (passphrase: string) => void | Promise<void>;
  onClose: () => void;
}> = ({ mode, language, busy = false, externalError = null, onSubmit, onClose }) => {
  const text = labels[language];
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const dialogRef = useModalFocus('input[type="password"]');

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

  return (
    <ViewportPortal>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-passphrase-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
            <div id="backup-passphrase-title" className="flex items-center gap-2 font-bold">
              <KeyRound className="w-5 h-5" />
              {mode === 'create' ? text.createTitle : text.restoreTitle}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center disabled:opacity-50"
              aria-label={text.cancel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {mode === 'create' ? text.createIntro : text.restoreIntro}
            </p>

            <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">{text.unrecoverable}</p>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{text.passphrase}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passphrase}
                maxLength={256}
                onChange={(event) => setPassphrase(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !busy) submit();
                }}
                placeholder={text.placeholder}
                className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-sm"
              />
            </label>

            {mode === 'create' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{text.confirm}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  maxLength={256}
                  onChange={(event) => setConfirm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !busy) submit();
                  }}
                  placeholder={text.placeholder}
                  className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-sm"
                />
              </label>
            )}

            {(localError || externalError) && (
              <div className="text-xs font-medium text-rose-700 dark:text-rose-300">
                {localError || externalError}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-[48px] px-4 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {text.cancel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="min-h-[48px] px-5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-extrabold disabled:opacity-50"
            >
              {mode === 'create' ? text.create : text.unlock}
            </button>
          </div>
        </div>
      </div>
    </ViewportPortal>
  );
};
