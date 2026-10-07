import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import type { Language, ThemeMode } from '../types';
import { SUPPORTED_CURRENCIES, getSuggestedConversionRate } from '../utils/currency';
import { StorageManager } from '../utils/storage';
import {
  SetupState,
  directionForLanguage,
  isValidSetupPin,
} from '../utils/setupState';
import { LegalDocumentScreen } from './LegalDocumentScreen';
import type { LegalDocumentKind } from '../utils/legalDocuments';
import { CurrencyConversionModal } from '../components/CurrencyConversionModal';
import { isNativeAndroidSecurity } from '../platform/android/AndroidSecurityAdapter';
import type { SecureSessionActionResult } from '../security/SecureSessionService';

interface Props {
  mode: 'first-run' | 'replay';
  language: Language;
  currencyCode: string;
  themeMode: ThemeMode;
  totalExpensesCount: number;
  totalBudgetsCount: number;
  appLockEnabled: boolean;
  onLanguageChange: (language: Language) => void;
  onCurrencyChange: (code: string, targetUnitsPerSourceUnit?: number) => void | Promise<void>;
  onThemeChange: (theme: ThemeMode) => void;
  onAppLockConfigured: (pin?: string) => Promise<SecureSessionActionResult>;
  onComplete: () => void;
  onCancel?: () => void;
}

const COPY = {
  en: {
    title: 'Set up SpendWise',
    reviewTitle: 'Review setup',
    step: 'Step',
    language: 'Language',
    languageSub: 'Choose the language SpendWise should use.',
    preferences: 'Currency & theme',
    preferencesSub: 'Choose your default currency and appearance.',
    privacy: 'Privacy & security',
    privacySub: 'A short explanation of what stays local and when AI is used.',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    localTitle: 'Local by default',
    localBody: 'Financial records and normal expense photos stay on this device by default. Photos are not automatically uploaded.',
    aiTitle: 'AI is optional',
    aiBody: 'Only when you explicitly use an AI feature are the required spending details or selected image sent through the SpendWise backend to Gemini.',
    cameraTitle: 'Camera permission is contextual',
    cameraBody: 'Camera access is optional and is requested only after you choose a camera action such as Take Photo.',
    lockTitle: 'Optional App Lock',
    lockBody: 'Create a 4–8 digit PIN, or leave both fields empty to skip.',
    pin: 'PIN',
    confirm: 'Confirm PIN',
    mismatch: 'PINs must match and contain 4–8 digits.',
    agreePrefix: 'I agree to the',
    terms: 'Terms of Use',
    and: 'and',
    privacyPolicy: 'Privacy Policy',
    next: 'Next',
    back: 'Back',
    finish: 'Finish setup',
    done: 'Done',
    cancel: 'Close',
    conversionNote: 'Changing currency with existing financial data uses SpendWise’s protected conversion flow.',
  },
  fr: {
    title: 'Configurer SpendWise',
    reviewTitle: 'Revoir la configuration',
    step: 'Étape',
    language: 'Langue',
    languageSub: 'Choisissez la langue de SpendWise.',
    preferences: 'Devise et thème',
    preferencesSub: 'Choisissez la devise par défaut et l’apparence.',
    privacy: 'Confidentialité et sécurité',
    privacySub: 'Une explication courte de ce qui reste local et de l’utilisation de l’IA.',
    system: 'Système',
    light: 'Clair',
    dark: 'Sombre',
    localTitle: 'Local par défaut',
    localBody: 'Les données financières et les photos normales de dépenses restent sur cet appareil par défaut. Les photos ne sont pas envoyées automatiquement.',
    aiTitle: 'L’IA est facultative',
    aiBody: 'Seulement lorsque vous utilisez explicitement une fonction IA, les données nécessaires ou l’image choisie sont envoyées via le backend SpendWise à Gemini.',
    cameraTitle: 'Autorisation caméra contextuelle',
    cameraBody: 'L’accès caméra est facultatif et demandé seulement après une action caméra, par exemple Prendre une photo.',
    lockTitle: 'Verrouillage facultatif',
    lockBody: 'Créez un PIN de 4 à 8 chiffres, ou laissez les deux champs vides pour ignorer.',
    pin: 'PIN',
    confirm: 'Confirmer le PIN',
    mismatch: 'Les PIN doivent correspondre et contenir 4 à 8 chiffres.',
    agreePrefix: 'J’accepte les',
    terms: "Conditions d’utilisation",
    and: 'et la',
    privacyPolicy: 'Politique de confidentialité',
    next: 'Suivant',
    back: 'Retour',
    finish: 'Terminer',
    done: 'Terminé',
    cancel: 'Fermer',
    conversionNote: 'Changer la devise avec des données financières utilise le flux de conversion protégé de SpendWise.',
  },
  ar: {
    title: 'إعداد SpendWise',
    reviewTitle: 'مراجعة الإعداد',
    step: 'الخطوة',
    language: 'اللغة',
    languageSub: 'اختر اللغة التي سيستخدمها SpendWise.',
    preferences: 'العملة والمظهر',
    preferencesSub: 'اختر العملة الافتراضية ومظهر التطبيق.',
    privacy: 'الخصوصية والأمان',
    privacySub: 'شرح مختصر لما يبقى محليًا ومتى يُستخدم الذكاء الاصطناعي.',
    system: 'النظام',
    light: 'فاتح',
    dark: 'داكن',
    localTitle: 'محلي بشكل افتراضي',
    localBody: 'تبقى السجلات المالية وصور المصروفات العادية على هذا الجهاز بشكل افتراضي. لا يتم رفع الصور تلقائيًا.',
    aiTitle: 'الذكاء الاصطناعي اختياري',
    aiBody: 'فقط عندما تستخدم ميزة ذكاء اصطناعي بشكل صريح يتم إرسال بيانات الإنفاق المطلوبة أو الصورة المختارة عبر خادم SpendWise إلى Gemini.',
    cameraTitle: 'إذن الكاميرا عند الحاجة',
    cameraBody: 'الوصول إلى الكاميرا اختياري ويُطلب فقط بعد اختيار إجراء يستخدم الكاميرا مثل التقاط صورة.',
    lockTitle: 'قفل التطبيق اختياري',
    lockBody: 'أنشئ رمز PIN من 4 إلى 8 أرقام، أو اترك الحقلين فارغين للتخطي.',
    pin: 'PIN',
    confirm: 'تأكيد PIN',
    mismatch: 'يجب أن يتطابق الرمزان وأن يتكونا من 4 إلى 8 أرقام.',
    agreePrefix: 'أوافق على',
    terms: 'شروط الاستخدام',
    and: 'و',
    privacyPolicy: 'سياسة الخصوصية',
    next: 'التالي',
    back: 'رجوع',
    finish: 'إنهاء الإعداد',
    done: 'تم',
    cancel: 'إغلاق',
    conversionNote: 'تغيير العملة مع وجود بيانات مالية يستخدم آلية التحويل الآمنة الموجودة في SpendWise.',
  },
} as const;

export const SetupWizardScreen: React.FC<Props> = ({
  mode,
  language,
  currencyCode,
  themeMode,
  totalExpensesCount,
  totalBudgetsCount,
  appLockEnabled,
  onLanguageChange,
  onCurrencyChange,
  onThemeChange,
  onAppLockConfigured,
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState(1);
  const [legalKind, setLegalKind] = useState<LegalDocumentKind | null>(null);
  const [accepted, setAccepted] = useState(() => SetupState.hasAcknowledgedCurrentLegal());
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingCurrencyCode, setPendingCurrencyCode] = useState<string | null>(null);
  const nativeSecurity = isNativeAndroidSecurity();
  const [enableNativeLock, setEnableNativeLock] = useState(appLockEnabled);
  const copy = COPY[language];
  const hasFinancialData = totalExpensesCount > 0 || totalBudgetsCount > 0;
  const currencyPreviewAmount =
    StorageManager.getExpenses()[0]?.amount ??
    StorageManager.getBudgets()[0]?.startingAmount ??
    0;

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', directionForLanguage(language));
  }, [language]);

  useEffect(() => {
    const handleBack = () => {
      if (legalKind || pendingCurrencyCode) return;
      if (step > 1) {
        setStep((value) => value - 1);
        return;
      }
      if (mode === 'replay') onCancel?.();
    };
    window.addEventListener('spendwise-native-back', handleBack);
    return () => window.removeEventListener('spendwise-native-back', handleBack);
  }, [legalKind, pendingCurrencyCode, step, mode, onCancel]);

  const themes = useMemo(
    () =>
      [
        ['SYSTEM', copy.system],
        ['LIGHT', copy.light],
        ['DARK', copy.dark],
      ] as const,
    [copy]
  );

  const finish = async () => {
    setPinError(null);
    const wantsPin = !nativeSecurity && (pin.length > 0 || confirmPin.length > 0);
    if (wantsPin && !isValidSetupPin(pin, confirmPin)) {
      setPinError(copy.mismatch);
      return;
    }
    if (mode === 'first-run' && !accepted) return;

    if (nativeSecurity && enableNativeLock && !appLockEnabled) {
      const result = await onAppLockConfigured();
      if (!result.ok) {
        setPinError(
          language === 'ar'
            ? 'تعذّر تفعيل قفل التطبيق. اضبط قفل شاشة Android آمنًا ثم أعد المحاولة.'
            : language === 'fr'
              ? 'Impossible d’activer le verrouillage. Configurez un verrouillage Android sécurisé puis réessayez.'
              : 'App Lock could not be enabled. Set a secure Android screen lock and try again.'
        );
        return;
      }
    } else if (wantsPin) {
      const result = await onAppLockConfigured(pin);
      if (!result.ok) {
        setPinError(
          language === 'ar'
            ? 'تعذّر حفظ قفل الويب بأمان.'
            : language === 'fr'
              ? 'Impossible d’enregistrer le verrou web de manière sûre.'
              : 'The web privacy lock could not be saved securely.'
        );
        return;
      }
    }

    if (accepted) SetupState.acknowledgeCurrentLegal();
    if (mode === 'first-run') SetupState.completeInitialSetup();
    onComplete();
  };

  if (legalKind) {
    return <LegalDocumentScreen language={language} kind={legalKind} onClose={() => setLegalKind(null)} />;
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-100 dark:bg-[#05080C] text-slate-900 dark:text-slate-100 overflow-y-auto"
      data-native-back-layer="true"
    >
      <div className="max-w-md sm:max-w-lg mx-auto min-h-full px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] flex flex-col">
        <header className="py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
            {copy.step} {step} / 3
          </p>
          <h1 className="text-2xl font-extrabold mt-1">{mode === 'first-run' ? copy.title : copy.reviewTitle}</h1>
        </header>

        <div className="flex gap-2 mb-5" aria-hidden="true">
          {[1, 2, 3].map((value) => (
            <div key={value} className={`h-1.5 flex-1 rounded-full ${value <= step ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-800'}`} />
          ))}
        </div>

        <main className="flex-1">
          {step === 1 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold">{copy.language}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{copy.languageSub}</p>
              </div>
              <div className="space-y-2">
                {([
                  ['en', 'English'],
                  ['fr', 'Français'],
                  ['ar', 'العربية'],
                ] as const).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onLanguageChange(code)}
                    className={`w-full min-h-[56px] rounded-2xl border px-4 flex items-center justify-between font-bold ${
                      language === code
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-white dark:bg-[#111928] border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span>{label}</span>
                    {language === code && <Check className="w-5 h-5" />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-extrabold">{copy.preferences}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{copy.preferencesSub}</p>
              </div>
              <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-2">
                <h3 className="text-sm font-bold">{language === 'ar' ? 'العملة' : language === 'fr' ? 'Devise' : 'Currency'}</h3>
                {hasFinancialData && mode === 'replay' && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">{copy.conversionNote}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <button
                      key={currency.code}
                      type="button"
                      onClick={() => {
                        if (currency.code === currencyCode) return;
                        if (hasFinancialData) setPendingCurrencyCode(currency.code);
                        else void onCurrencyChange(currency.code);
                      }}
                      className={`min-h-[48px] rounded-xl border px-3 text-sm font-bold flex items-center justify-between ${
                        currency.code === currencyCode
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]'
                      }`}
                    >
                      <span>{currency.code}</span><span>{currency.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3">
                <h3 className="text-sm font-bold">{language === 'ar' ? 'المظهر' : language === 'fr' ? 'Thème' : 'Theme'}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {themes.map(([modeValue, label]) => (
                    <button
                      key={modeValue}
                      type="button"
                      onClick={() => onThemeChange(modeValue)}
                      className={`min-h-[48px] rounded-xl border text-xs font-bold ${
                        themeMode === modeValue
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold">{copy.privacy}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{copy.privacySub}</p>
              </div>

              {[
                [copy.localTitle, copy.localBody],
                [copy.aiTitle, copy.aiBody],
                [copy.cameraTitle, copy.cameraBody],
              ].map(([title, body]) => (
                <div key={title} className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="flex gap-3 items-start rtl:flex-row-reverse">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold">{title}</h3>
                      <p className="text-xs leading-5 text-slate-600 dark:text-slate-300 mt-1">{body}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex gap-3 items-start rtl:flex-row-reverse">
                  <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold">{copy.lockTitle}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {nativeSecurity
                        ? language === 'ar'
                          ? 'استخدم قفل شاشة Android أو المصادقة الحيوية القوية. لا ينشئ SpendWise رمز PIN منفصلًا.'
                          : language === 'fr'
                            ? 'Utilisez le verrouillage Android ou une biométrie forte. SpendWise ne crée pas de PIN séparé.'
                            : 'Use Android screen lock or strong biometrics. SpendWise does not create a separate native PIN.'
                        : copy.lockBody}
                    </p>
                  </div>
                </div>

                {nativeSecurity ? (
                  <label className="min-h-[52px] flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label={
                        language === 'ar'
                          ? 'تفعيل قفل التطبيق'
                          : language === 'fr'
                            ? 'Activer le verrouillage'
                            : 'Enable App Lock'
                      }
                      checked={enableNativeLock}
                      disabled={appLockEnabled}
                      onChange={(event) => setEnableNativeLock(event.target.checked)}
                      className="w-5 h-5 accent-emerald-500"
                    />
                    <span className="text-sm font-bold">
                      {language === 'ar'
                        ? appLockEnabled ? 'قفل التطبيق مفعّل' : 'تفعيل قفل التطبيق'
                        : language === 'fr'
                          ? appLockEnabled ? 'Verrouillage activé' : 'Activer le verrouillage'
                          : appLockEnabled ? 'App Lock is enabled' : 'Enable App Lock'}
                    </span>
                  </label>
                ) : (
                  <>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={8}
                      value={pin}
                      onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setPinError(null); }}
                      placeholder={copy.pin}
                      className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] px-3"
                    />
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={8}
                      value={confirmPin}
                      onChange={(event) => { setConfirmPin(event.target.value.replace(/\D/g, '')); setPinError(null); }}
                      placeholder={copy.confirm}
                      className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] px-3"
                    />
                  </>
                )}
                {pinError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{pinError}</p>}
              </div>

              <div
                className="min-h-[64px] bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2.5 flex items-start gap-2 rtl:flex-row-reverse"
                data-legal-agreement="terms-privacy"
              >
                <label
                  htmlFor="setup-legal-agreement"
                  className="min-w-[44px] min-h-[44px] flex items-start justify-center pt-2 cursor-pointer shrink-0"
                >
                  <input
                    id="setup-legal-agreement"
                    type="checkbox"
                    aria-describedby="setup-legal-agreement-copy"
                    aria-label={
                      language === 'ar'
                        ? 'الموافقة على شروط الاستخدام وسياسة الخصوصية'
                        : language === 'fr'
                          ? 'Accepter les conditions d’utilisation et la politique de confidentialité'
                          : 'Accept Terms of Use and Privacy Policy'
                    }
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                    className="w-5 h-5 accent-emerald-600 shrink-0"
                  />
                </label>
                <p id="setup-legal-agreement-copy" className="min-w-0 flex-1 text-sm leading-6 pt-1.5 text-slate-700 dark:text-slate-200">
                  <label htmlFor="setup-legal-agreement" className="cursor-pointer">{copy.agreePrefix}</label>{' '}
                  <button type="button" className="font-bold underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => setLegalKind('terms')}>
                    {copy.terms}
                  </button>{' '}
                  {copy.and}{' '}
                  <button type="button" className="font-bold underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" onClick={() => setLegalKind('privacy')}>
                    {copy.privacyPolicy}
                  </button>
                </p>
              </div>
            </section>
          )}
        </main>

        <footer className="pt-6 flex gap-2 rtl:flex-row-reverse">
          {(step > 1 || mode === 'replay') && (
            <button
              type="button"
              onClick={() => step > 1 ? setStep((value) => value - 1) : onCancel?.()}
              className="min-h-[52px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928] font-bold flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              {step > 1 ? copy.back : copy.cancel}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((value) => value + 1)}
              className="min-h-[52px] flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold flex items-center justify-center gap-2"
            >
              {copy.next}
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          ) : (
            <button
              type="button"
              disabled={mode === 'first-run' && !accepted}
              onClick={() => void finish()}
              className="min-h-[52px] flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mode === 'first-run' ? copy.finish : copy.done}
            </button>
          )}
        </footer>
      </div>

      {pendingCurrencyCode && (
        <CurrencyConversionModal
          key={`${currencyCode}-${pendingCurrencyCode}`}
          isOpen={true}
          sourceCurrencyCode={currencyCode}
          targetCurrencyCode={pendingCurrencyCode}
          expenseCount={totalExpensesCount}
          budgetCount={totalBudgetsCount}
          previewAmount={currencyPreviewAmount}
          initialRate={getSuggestedConversionRate(currencyCode, pendingCurrencyCode)}
          language={language}
          onConfirm={async (rate) => {
            await onCurrencyChange(pendingCurrencyCode, rate);
            setPendingCurrencyCode(null);
          }}
          onClose={() => setPendingCurrencyCode(null)}
        />
      )}
    </div>
  );
};
