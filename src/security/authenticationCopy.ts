import type { Language } from '../types';

export const AUTHENTICATION_ACTIONS = [
  'unlock', 'enable-app-lock', 'disable-app-lock', 'security-configuration',
  'replace-restore', 'clear-app-data', 'plaintext-export', 'legacy-lock-upgrade',
  'lock-repair', 'open-protected-data', 'protect-local-data', 'secure-key-rotation',
] as const;
export type AuthenticationAction = typeof AUTHENTICATION_ACTIONS[number];
export type AuthenticationMethod = 'primary' | 'device-credential';

// Copy is intentionally independent of bootstrap, database and translation initialization.
export const AUTHENTICATION_COPY = {
  en: {
    'unlock': ['Unlock SpendWise', 'Confirm your identity to access your protected data.'],
    'enable-app-lock': ['Enable App Lock', 'Confirm your identity to protect access to your data.'],
    'disable-app-lock': ['Disable App Lock', 'Confirm your identity before removing the app lock.'],
    'security-configuration': ['Update security settings', 'Confirm your identity before changing your protection settings.'],
    'replace-restore': ['Replace financial data', 'Confirm your identity before replacing your data with this backup.'],
    'clear-app-data': ['Clear financial data', 'Confirm your identity before deleting your protected financial data.'],
    'plaintext-export': ['Export readable data', 'Confirm your identity before exporting readable financial data.'],
    'legacy-lock-upgrade': ['Upgrade App Lock', 'Confirm your identity to securely replace your old app lock.'],
    'lock-repair': ['Repair App Lock', 'Confirm your identity to restore your app’s security setup.'],
    'open-protected-data': ['Open protected data', 'Confirm your identity to access encrypted local data.'],
    'protect-local-data': ['Protect local data', 'Confirm your identity to secure your local financial data.'],
    'secure-key-rotation': ['Update data protection', 'Confirm your identity before updating your protected storage.'],
  },
  fr: {
    'unlock': ['Déverrouiller SpendWise', 'Confirmez votre identité pour accéder à vos données protégées.'],
    'enable-app-lock': ['Activer le verrouillage', 'Confirmez votre identité pour protéger l’accès à vos données.'],
    'disable-app-lock': ['Désactiver le verrouillage', 'Confirmez votre identité avant de retirer le verrouillage.'],
    'security-configuration': ['Modifier la sécurité', 'Confirmez votre identité avant de modifier votre protection.'],
    'replace-restore': ['Remplacer les données', 'Confirmez votre identité avant de remplacer vos données par cette sauvegarde.'],
    'clear-app-data': ['Effacer les données', 'Confirmez votre identité avant de supprimer vos données financières protégées.'],
    'plaintext-export': ['Exporter les données lisibles', 'Confirmez votre identité avant d’exporter vos données financières lisibles.'],
    'legacy-lock-upgrade': ['Mettre à niveau le verrouillage', 'Confirmez votre identité pour remplacer votre ancien verrouillage en toute sécurité.'],
    'lock-repair': ['Réparer le verrouillage', 'Confirmez votre identité pour rétablir la protection de l’application.'],
    'open-protected-data': ['Ouvrir les données protégées', 'Confirmez votre identité pour accéder aux données locales chiffrées.'],
    'protect-local-data': ['Protéger les données locales', 'Confirmez votre identité pour sécuriser vos données financières locales.'],
    'secure-key-rotation': ['Actualiser la protection', 'Confirmez votre identité avant de mettre à jour le stockage protégé.'],
  },
  ar: {
    'unlock': ['فتح SpendWise', 'أكّد هويتك للوصول إلى بياناتك المحمية.'],
    'enable-app-lock': ['تفعيل قفل التطبيق', 'أكّد هويتك لحماية الوصول إلى بياناتك.'],
    'disable-app-lock': ['تعطيل قفل التطبيق', 'أكّد هويتك قبل إزالة قفل التطبيق.'],
    'security-configuration': ['تحديث إعدادات الأمان', 'أكّد هويتك قبل تغيير إعدادات الحماية.'],
    'replace-restore': ['استبدال البيانات المالية', 'أكّد هويتك قبل استبدال بياناتك بهذه النسخة الاحتياطية.'],
    'clear-app-data': ['مسح البيانات المالية', 'أكّد هويتك قبل حذف بياناتك المالية المحمية.'],
    'plaintext-export': ['تصدير بيانات مقروءة', 'أكّد هويتك قبل تصدير بياناتك المالية بصيغة مقروءة.'],
    'legacy-lock-upgrade': ['ترقية قفل التطبيق', 'أكّد هويتك لاستبدال قفل التطبيق القديم بأمان.'],
    'lock-repair': ['إصلاح قفل التطبيق', 'أكّد هويتك لاستعادة إعدادات أمان التطبيق.'],
    'open-protected-data': ['فتح البيانات المحمية', 'أكّد هويتك للوصول إلى البيانات المحلية المشفّرة.'],
    'protect-local-data': ['حماية البيانات المحلية', 'أكّد هويتك لتأمين بياناتك المالية المحلية.'],
    'secure-key-rotation': ['تحديث حماية البيانات', 'أكّد هويتك قبل تحديث التخزين المحمي.'],
  },
} as const satisfies Record<Language, Record<AuthenticationAction, readonly [string, string]>>;

export const AUTHENTICATION_RECOVERY_COPY = {
  en: { cancelButton: 'Cancel', credentialButton: 'Use phone PIN, pattern or password', retry: 'Try fingerprint again', explanation: 'You can retry biometrics or use your phone’s secure screen lock.', temporary: 'Biometrics are temporarily locked. Try again later or use your phone’s screen lock.', permanent: 'Biometrics are unavailable. Use your phone’s secure screen lock.' },
  fr: { cancelButton: 'Annuler', credentialButton: 'Utiliser le code, schéma ou mot de passe du téléphone', retry: 'Réessayer l’empreinte', explanation: 'Réessayez la biométrie ou utilisez le verrouillage sécurisé du téléphone.', temporary: 'La biométrie est temporairement bloquée. Réessayez plus tard ou utilisez le verrouillage du téléphone.', permanent: 'La biométrie est indisponible. Utilisez le verrouillage sécurisé du téléphone.' },
  ar: { cancelButton: 'إلغاء', credentialButton: 'استخدام رمز الهاتف أو النمط أو كلمة المرور', retry: 'إعادة المحاولة ببصمة الإصبع', explanation: 'يمكنك إعادة المحاولة بالمصادقة الحيوية أو استخدام قفل شاشة هاتفك الآمن.', temporary: 'المصادقة الحيوية مقفلة مؤقتًا. حاول لاحقًا أو استخدم قفل شاشة هاتفك.', permanent: 'المصادقة الحيوية غير متاحة. استخدم قفل شاشة هاتفك الآمن.' },
} as const;

export function authenticationPrompt(action: AuthenticationAction, language: Language) {
  const [title, reason] = AUTHENTICATION_COPY[language][action];
  return { title, reason, ...AUTHENTICATION_RECOVERY_COPY[language] };
}

export const AUTHENTICATION_LIMIT_COPY = {
  en: 'This Android version cannot use phone credentials with immediate App Lock.',
  fr: 'Cette version d’Android ne permet pas d’utiliser le code du téléphone avec le verrouillage immédiat de l’application.',
  ar: 'لا يدعم إصدار Android هذا استخدام رمز الهاتف مع قفل التطبيق الفوري.',
} as const;

export function currentAuthenticationLanguage(): Language {
  try {
    const language = localStorage.getItem('spendwise_language');
    if (language === 'ar' || language === 'fr') return language;
  } catch { /* Early startup can lack preference access. */ }
  return 'en';
}
