import type { Language } from '../types';

export type LegalDocumentKind = 'terms' | 'privacy';

export interface LegalDocumentCopy {
  title: string;
  updated: string;
  sections: Array<{ heading: string; body: string }>;
}

const DOCUMENTS: Record<Language, Record<LegalDocumentKind, LegalDocumentCopy>> = {
  en: {
    terms: {
      title: 'Terms of Use',
      updated: 'SpendWise document version 1',
      sections: [
        { heading: 'Purpose', body: 'SpendWise is a local-first personal expense tracker. It is provided for personal record-keeping and budgeting, not as banking, accounting, tax, investment, or legal advice.' },
        { heading: 'Your data', body: 'Your normal financial records and expense photos are stored locally on your device by default. You control exports, backups, deletion, and optional AI actions.' },
        { heading: 'Optional AI', body: 'AI features are optional. When you explicitly run an AI feature, SpendWise sends only the spending details needed for that request, or the image you selected for Smart Capture or receipt scanning, through the SpendWise backend to Gemini for processing.' },
        { heading: 'Permissions', body: 'Accepting these Terms does not grant Android permissions. Camera access is requested separately only when you intentionally choose a camera action.' },
        { heading: 'Responsibility', body: 'AI output and extracted receipt details can be incomplete or wrong. Review financial entries before saving or relying on them.' },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      updated: 'SpendWise document version 1',
      sections: [
        { heading: 'Local records', body: 'Expense records, budgets, preferences, and normal attachment photos remain on your device unless you choose an action that exports or sends specific data.' },
        { heading: 'Photos', body: 'Taking or attaching a normal expense photo does not automatically upload it. Camera photos are not automatically saved into the public device gallery.' },
        { heading: 'AI requests', body: 'AI is optional. Spending Analysis sends a bounded spending summary. Smart Capture and receipt scanning send the selected image plus the minimum request context through the SpendWise backend to Gemini.' },
        { heading: 'Camera access', body: 'SpendWise asks Android for camera permission only after you press a camera action such as Take Photo. Gallery selection is a separate path.' },
        { heading: 'Analytics and accounts', body: 'SpendWise does not add an account system, cloud profile, advertising SDK, or analytics telemetry. App Lock data remains local and is not sent to the AI backend or included in SpendWise backups.' },
      ],
    },
  },
  fr: {
    terms: {
      title: "Conditions d’utilisation",
      updated: 'Document SpendWise version 1',
      sections: [
        { heading: 'Objectif', body: "SpendWise est un suivi de dépenses personnel conçu d’abord pour un stockage local. Il sert à la tenue de comptes personnelle et au budget, pas comme conseil bancaire, comptable, fiscal, d’investissement ou juridique." },
        { heading: 'Vos données', body: "Vos données financières normales et les photos de dépenses sont stockées localement sur votre appareil par défaut. Vous contrôlez les exports, sauvegardes, suppressions et actions IA facultatives." },
        { heading: 'IA facultative', body: "Les fonctions IA sont facultatives. Lorsque vous lancez explicitement une fonction IA, SpendWise envoie uniquement les données nécessaires à cette demande, ou l’image choisie pour Smart Capture ou le scan de reçu, via le backend SpendWise vers Gemini." },
        { heading: 'Autorisations', body: "Accepter ces conditions n’accorde aucune autorisation Android. L’accès à la caméra est demandé séparément seulement lorsque vous choisissez volontairement une action caméra." },
        { heading: 'Responsabilité', body: "Les résultats IA et les informations extraites d’un reçu peuvent être incomplets ou incorrects. Vérifiez les données financières avant de les enregistrer ou de vous y fier." },
      ],
    },
    privacy: {
      title: 'Politique de confidentialité',
      updated: 'Document SpendWise version 1',
      sections: [
        { heading: 'Données locales', body: "Les dépenses, budgets, préférences et photos jointes normales restent sur votre appareil sauf si vous choisissez une action qui exporte ou envoie des données précises." },
        { heading: 'Photos', body: "Ajouter ou prendre une photo normale de dépense ne l’envoie pas automatiquement. Les photos prises par la caméra ne sont pas ajoutées automatiquement à la galerie publique." },
        { heading: 'Demandes IA', body: "L’IA est facultative. Spending Analysis envoie un résumé limité des dépenses. Smart Capture et le scan de reçu envoient l’image choisie et le contexte minimal nécessaire via le backend SpendWise vers Gemini." },
        { heading: 'Caméra', body: "SpendWise demande l’autorisation Android de la caméra seulement après une action explicite comme Prendre une photo. Le choix depuis la galerie est indépendant." },
        { heading: 'Analytique et comptes', body: "SpendWise n’ajoute ni compte, ni profil cloud, ni SDK publicitaire, ni télémétrie analytique. Les données App Lock restent locales et ne sont ni envoyées au backend IA ni incluses dans les sauvegardes SpendWise." },
      ],
    },
  },
  ar: {
    terms: {
      title: 'شروط الاستخدام',
      updated: 'الإصدار 1 من مستند SpendWise',
      sections: [
        { heading: 'الغرض', body: 'SpendWise متتبع شخصي للمصروفات يعتمد على التخزين المحلي. الغرض منه تنظيم السجلات والميزانية الشخصية، وليس تقديم استشارة مصرفية أو محاسبية أو ضريبية أو استثمارية أو قانونية.' },
        { heading: 'بياناتك', body: 'تُخزَّن السجلات المالية العادية وصور المصروفات محليًا على جهازك بشكل افتراضي. أنت تتحكم بالتصدير والنسخ الاحتياطي والحذف وميزات الذكاء الاصطناعي الاختيارية.' },
        { heading: 'الذكاء الاصطناعي اختياري', body: 'عندما تشغّل ميزة ذكاء اصطناعي بشكل صريح، يرسل SpendWise فقط بيانات الإنفاق اللازمة لذلك الطلب، أو الصورة التي اخترتها لـ Smart Capture أو مسح الإيصال، عبر خادم SpendWise إلى Gemini للمعالجة.' },
        { heading: 'الأذونات', body: 'الموافقة على هذه الشروط لا تمنح أذونات Android. يتم طلب إذن الكاميرا بشكل منفصل فقط عندما تختار أنت إجراءً يستخدم الكاميرا.' },
        { heading: 'المسؤولية', body: 'قد تكون نتائج الذكاء الاصطناعي أو بيانات الإيصالات المستخرجة ناقصة أو خاطئة. راجع القيود المالية قبل حفظها أو الاعتماد عليها.' },
      ],
    },
    privacy: {
      title: 'سياسة الخصوصية',
      updated: 'الإصدار 1 من مستند SpendWise',
      sections: [
        { heading: 'السجلات المحلية', body: 'تبقى المصروفات والميزانيات والتفضيلات وصور المرفقات العادية على جهازك إلا إذا اخترت إجراءً يقوم بتصدير بيانات محددة أو إرسالها.' },
        { heading: 'الصور', body: 'التقاط أو إرفاق صورة عادية لمصروف لا يرفعها تلقائيًا. كما لا تُحفَظ صور الكاميرا تلقائيًا في معرض الصور العام على الجهاز.' },
        { heading: 'طلبات الذكاء الاصطناعي', body: 'الذكاء الاصطناعي اختياري. يرسل Spending Analysis ملخصًا محدودًا للإنفاق. ويرسل Smart Capture ومسح الإيصال الصورة المختارة مع الحد الأدنى من سياق الطلب عبر خادم SpendWise إلى Gemini.' },
        { heading: 'إذن الكاميرا', body: 'يطلب SpendWise إذن كاميرا Android فقط بعد ضغطك على إجراء كاميرا مثل التقاط صورة. اختيار صورة من المعرض مسار منفصل.' },
        { heading: 'التحليلات والحسابات', body: 'لا يضيف SpendWise نظام حسابات أو ملفًا سحابيًا أو حزمة إعلانات أو تتبعًا تحليليًا. تبقى بيانات قفل التطبيق محلية ولا تُرسل إلى خادم الذكاء الاصطناعي ولا تدخل ضمن نسخ SpendWise الاحتياطية.' },
      ],
    },
  },
};

export function getLegalDocument(language: Language, kind: LegalDocumentKind): LegalDocumentCopy {
  return DOCUMENTS[language][kind];
}
