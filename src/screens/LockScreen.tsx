import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Language } from '../types';
import { t } from '../utils/translations';
import { SpendWiseLogo } from '../components/SpendWiseLogo';
import {
  clearLockThrottle,
  readLockThrottleState,
  recordLockFailure,
  remainingLockDelayMs,
} from '../utils/lockThrottle';
import type {
  SecureSessionActionResult,
  SecureUnlockMode,
} from '../security/SecureSessionService';
import { androidSecurityAdapter, classifyNativeAuthenticationCapabilities } from '../platform/android/AndroidSecurityAdapter';
import { AUTHENTICATION_LIMIT_COPY, AUTHENTICATION_RECOVERY_COPY, type AuthenticationMethod } from '../security/authenticationCopy';

interface LockScreenProps {
  unlockMode: SecureUnlockMode;
  migrationIssue: string | null;
  language: Language;
  onUnlock: (credential?: string, method?: AuthenticationMethod) => Promise<SecureSessionActionResult>;
  autoUnlock?: boolean;
}

export const LOCK_SCREEN_COPY = {
  en: {
    nativePrompt: 'Use your Android screen lock or strong biometric to unlock SpendWise.',
    migratePrompt: 'Enter your existing SpendWise PIN once. Android device authentication will replace it securely.',
    repairPrompt: 'SpendWise found an incomplete legacy lock state. Verify with Android device authentication to repair it without silently disabling App Lock.',
    webPrompt: 'Enter your SpendWise PIN. On web, this is a local privacy lock rather than encrypted device storage.',
    webRepair: 'The saved web lock credential is missing or malformed. SpendWise will not silently disable App Lock.',
    nativeButton: 'Unlock SpendWise',
    migrateButton: 'Upgrade & Unlock',
    repairButton: 'Repair & Unlock',
    unlocking: 'Unlocking…',
    cancel: 'Authentication was cancelled.',
    unavailable: 'Set a secure Android screen lock or strong biometric, then try again.',
    keyProblem: 'The protected device key is unavailable. SpendWise kept App Lock enabled and did not discard security state.',
    invalidatedKey: 'The device protection changed and its protected key is no longer usable. Your data and App Lock were kept.',
    unrecoverableKey: 'The protected device key cannot be recovered. Your data and App Lock were kept.',
    repairRequired: 'The saved lock state needs repair before SpendWise can unlock.',
    generic: 'Authentication failed. Try again.',
    migrationPending: 'Secure migration could not finish. Your old PIN was kept so you are not locked out; SpendWise will retry later.',
  },
  fr: {
    nativePrompt: 'Utilisez le verrouillage Android ou une biométrie forte pour déverrouiller SpendWise.',
    migratePrompt: 'Saisissez une dernière fois votre ancien PIN SpendWise. L’authentification Android le remplacera de façon sécurisée.',
    repairPrompt: 'SpendWise a détecté un état de verrouillage hérité incomplet. Vérifiez avec Android pour le réparer sans désactiver silencieusement le verrouillage.',
    webPrompt: 'Saisissez votre PIN SpendWise. Sur le web, il s’agit d’un verrou de confidentialité local et non d’un stockage chiffré.',
    webRepair: 'Le verrou web enregistré est manquant ou invalide. SpendWise ne désactivera pas silencieusement le verrouillage.',
    nativeButton: 'Déverrouiller SpendWise',
    migrateButton: 'Mettre à niveau et déverrouiller',
    repairButton: 'Réparer et déverrouiller',
    unlocking: 'Déverrouillage…',
    cancel: 'Authentification annulée.',
    unavailable: 'Configurez un verrouillage Android sécurisé ou une biométrie forte, puis réessayez.',
    keyProblem: 'La clé protégée de l’appareil est indisponible. SpendWise a conservé le verrouillage et son état de sécurité.',
    invalidatedKey: 'La protection de l’appareil a changé et sa clé protégée est inutilisable. Vos données et le verrouillage ont été conservés.',
    unrecoverableKey: 'La clé protégée de l’appareil est irrécupérable. Vos données et le verrouillage ont été conservés.',
    repairRequired: 'L’état de verrouillage enregistré doit être réparé avant le déverrouillage.',
    generic: 'Échec de l’authentification. Réessayez.',
    migrationPending: 'La migration sécurisée n’a pas pu finir. Votre ancien PIN a été conservé pour éviter tout blocage.',
  },
  ar: {
    nativePrompt: 'استخدم قفل شاشة Android أو المصادقة الحيوية القوية لفتح SpendWise.',
    migratePrompt: 'أدخل رمز SpendWise القديم مرة أخيرة. ستستبدله مصادقة Android بطريقة آمنة.',
    repairPrompt: 'وجد SpendWise حالة قفل قديمة غير مكتملة. استخدم مصادقة Android لإصلاحها من دون تعطيل قفل التطبيق بصمت.',
    webPrompt: 'أدخل رمز SpendWise. على الويب هذا قفل خصوصية محلي وليس تخزينًا مشفّرًا على الجهاز.',
    webRepair: 'بيانات قفل الويب مفقودة أو غير صالحة. لن يعطّل SpendWise قفل التطبيق بصمت.',
    nativeButton: 'فتح SpendWise',
    migrateButton: 'الترقية وفتح التطبيق',
    repairButton: 'الإصلاح وفتح التطبيق',
    unlocking: 'جارٍ فتح SpendWise…',
    cancel: 'تم إلغاء المصادقة.',
    unavailable: 'اضبط قفل شاشة Android آمنًا أو مصادقة حيوية قوية ثم أعد المحاولة.',
    keyProblem: 'مفتاح الجهاز المحمي غير متاح. أبقى SpendWise قفل التطبيق مفعّلًا ولم يحذف حالة الأمان.',
    invalidatedKey: 'تغيّرت حماية الجهاز ولم يعد مفتاحه المحمي صالحًا للاستخدام. تم الاحتفاظ ببياناتك وقفل التطبيق.',
    unrecoverableKey: 'تعذرت استعادة مفتاح الجهاز المحمي. تم الاحتفاظ ببياناتك وقفل التطبيق.',
    repairRequired: 'تحتاج حالة القفل المحفوظة إلى إصلاح قبل فتح SpendWise.',
    generic: 'فشلت المصادقة. حاول مجددًا.',
    migrationPending: 'لم تكتمل الترقية الآمنة. تم الاحتفاظ بالرمز القديم حتى لا يتم منعك من الدخول.',
  },
} as const;
const COPY = LOCK_SCREEN_COPY;

export const LockScreen: React.FC<LockScreenProps> = ({
  unlockMode,
  migrationIssue,
  language,
  onUnlock,
  autoUnlock = false,
}) => {
  const copy = COPY[language];
  const pinMode =
    unlockMode === 'web' ||
    unlockMode === 'legacy-web-migration' ||
    unlockMode === 'legacy-native-migration';
  const canAutoUnlock = autoUnlock && !pinMode && unlockMode !== 'web-repair';
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(canAutoUnlock);
  const [now, setNow] = useState(Date.now());
  const autoAttempted = useRef(false);
  const requestPending = useRef(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const recovery = AUTHENTICATION_RECOVERY_COPY[language];
  const throttle = pinMode ? readLockThrottleState() : { failedAttempts: 0, blockedUntil: 0 };
  const remainingMs = remainingLockDelayMs(throttle, now);
  const isThrottled = pinMode && remainingMs > 0;
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

  useEffect(() => {
    let active = true;
    if (!pinMode && androidSecurityAdapter.isAvailable()) {
      void androidSecurityAdapter.getCapabilities().then(capabilities => {
        if (active) {
          const capability = classifyNativeAuthenticationCapabilities(capabilities);
          setRecoveryAvailable(capabilities.deviceCredentialAvailable && capabilities.credentialOnlySupported !== false);
          setBiometricAvailable(capability === 'biometric-and-credential' || capability === 'biometric-only');
        }
      }).catch(() => { if (active) setRecoveryAvailable(false); });
    }
    return () => { active = false; };
  }, [pinMode]);

  useEffect(() => {
    if (!isThrottled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [isThrottled]);

  const throttleMessage = useMemo(() => {
    if (!isThrottled) return null;
    if (language === 'ar') return `محاولات كثيرة. حاول مجددًا بعد ${remainingSeconds} ثانية.`;
    if (language === 'fr') return `Trop de tentatives. Réessayez dans ${remainingSeconds} s.`;
    return `Too many attempts. Try again in ${remainingSeconds}s.`;
  }, [isThrottled, language, remainingSeconds]);

  const description =
    unlockMode === 'native'
      ? copy.nativePrompt
      : unlockMode === 'legacy-native-migration'
        ? copy.migratePrompt
        : unlockMode === 'native-repair'
          ? copy.repairPrompt
          : unlockMode === 'web-repair'
            ? copy.webRepair
            : copy.webPrompt;

  const buttonText =
    unlockMode === 'native'
      ? copy.nativeButton
      : unlockMode === 'legacy-native-migration'
        ? copy.migrateButton
        : unlockMode === 'native-repair'
          ? copy.repairButton
          : t(language, 'unlockBtn');

  const messageFor = useCallback((result: SecureSessionActionResult): string => {
    if (result.detailCode === 'CREDENTIAL_IMMEDIATE_LOCK_UNSUPPORTED') return AUTHENTICATION_LIMIT_COPY[language];
    if (result.code === 'cancelled') return copy.cancel;
    if (result.code === 'unavailable') return copy.unavailable;
    if (result.code === 'missing_key') return copy.keyProblem;
    if (result.code === 'invalidated_key') return copy.invalidatedKey;
    if (result.code === 'unrecoverable_key') return copy.unrecoverableKey;
    if (result.code === 'repair_required') return copy.repairRequired;
    if (result.code === 'migration_pending') return copy.migrationPending;
    if (result.biometricCondition === 'temporary-lockout' || result.detailCode === 'BIOMETRIC_7') return recovery.temporary;
    if (result.biometricCondition === 'permanent-lockout' || result.detailCode === 'BIOMETRIC_9') return recovery.permanent;
    return copy.generic;
  }, [copy, recovery, language]);

  const migrationMessage = migrationIssue === 'KEY_INVALIDATED'
    ? copy.invalidatedKey
    : migrationIssue === 'KEY_UNRECOVERABLE' || migrationIssue === 'ACTIVE_KEY_METADATA_MISSING'
      ? copy.unrecoverableKey
      : migrationIssue === 'KEY_MISSING' || migrationIssue === 'ACTIVE_KEY_MISSING'
        ? copy.keyProblem
        : unlockMode === 'legacy-native-migration'
          ? copy.migrationPending
          : copy.repairRequired;

  const performUnlock = useCallback(async (method: AuthenticationMethod = 'primary') => {
    if (requestPending.current) return;
    if (unlockMode === 'web-repair') return;

    if (pinMode) {
      const currentNow = Date.now();
      const state = readLockThrottleState();
      if (remainingLockDelayMs(state, currentNow) > 0) {
        setNow(currentNow);
        return;
      }
      if (!/^\d{4,8}$/.test(pin)) {
        recordLockFailure(currentNow);
        setNow(currentNow);
        setPin('');
        setError(t(language, 'pinError'));
        return;
      }
    }

    requestPending.current = true;
    setBusy(true);
    setAttempted(true);
    setError(null);
    try {
      const result = await onUnlock(pinMode ? pin : undefined, method);
      if (result.ok) {
        if (pinMode) clearLockThrottle();
        setPin('');
        if (result.warning === 'migration_pending') setError(copy.migrationPending);
        return;
      }

      if (pinMode && result.code === 'invalid_credential') {
        recordLockFailure(Date.now());
        setNow(Date.now());
        setPin('');
        setError(t(language, 'pinError'));
      } else {
        setError(messageFor(result));
      }
    } catch {
      setError(copy.generic);
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  }, [copy.generic, copy.migrationPending, language, messageFor, onUnlock, pin, pinMode, unlockMode]);

  useEffect(() => {
    if (!canAutoUnlock || autoAttempted.current) return;
    autoAttempted.current = true;
    void performUnlock();
  }, [canAutoUnlock, performUnlock]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || isThrottled) return;
    void performUnlock();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 transition-colors dark:bg-[#05080C] dark:text-slate-100"
      data-testid="secure-lock-surface"
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-slate-800 dark:bg-[#111928] sm:p-8">
        <SpendWiseLogo className="mx-auto h-24 w-24 sm:h-28 sm:w-28" />

        <div className="mt-5 space-y-1.5">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t(language, 'lockTitle')}
          </h2>
          <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
            {description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {pinMode && (
            <div className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                disabled={isThrottled || busy}
                placeholder={t(language, 'enterPinPlaceholder')}
                aria-label={t(language, 'enterPinPlaceholder')}
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-lg font-bold tracking-widest text-slate-900 shadow-inner placeholder:text-xs placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
              />
              {throttleMessage ? (
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {throttleMessage}
                </p>
              ) : null}
            </div>
          )}

          {(error || migrationIssue) && (
            <p className="text-xs font-medium text-rose-500 dark:text-rose-400">
              {error || migrationMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || isThrottled || unlockMode === 'web-repair'}
            className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-extrabold text-slate-950 shadow-sm transition-all hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <span className="sw-secure-spinner sw-secure-spinner-dark" aria-hidden="true" /> : null}
            <span>{busy ? copy.unlocking : attempted && !pinMode && biometricAvailable ? recovery.retry : buttonText}</span>
          </button>
          {attempted && !pinMode && recoveryAvailable && (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{recovery.explanation}</p>
              <button type="button" disabled={busy}
                onClick={() => { void performUnlock('device-credential'); }}
                className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">
                {recovery.credentialButton}
              </button>
            </div>
          )}
        </form>

        {pinMode && unlockMode !== 'legacy-native-migration' && (
          <p className="mt-5 text-[11px] text-slate-400 dark:text-slate-500">
            {t(language, 'pinHint')}
          </p>
        )}
      </div>
    </div>
  );
};
