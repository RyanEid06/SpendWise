import { Language } from '../types';

const ATTACHMENT_TRANSLATIONS = {
  en: {
    attachmentsTitle: 'Photos',
    attachmentsSub: 'Local only. Adding a photo does not send it to AI.',
    attachmentKind: 'Photo type',
    kindPurchase: 'Purchase',
    kindReceipt: 'Receipt',
    kindProof: 'Proof / reference',
    addPhoto: 'Attach photo',
    photoAttached: 'Photo attached',
    photosAttached: '{count} photos attached',
    viewPhotos: 'View photos',
    removePhoto: 'Remove photo',
    closePreview: 'Close photo',
    photoMissing: 'Photo file is unavailable',
    photoAddError: 'Could not add this photo.',
    expenseDeleteError: 'Could not delete this expense and its local photos. Try again.',
    photoTooLarge: 'This image is too large to store safely.',
    photoUnsupported: 'Choose a supported image file.',
    photoLimit: 'Up to {count} photos can be attached to one expense.',
    attachmentSaveError: 'The expense could not save its photo changes. Try again.',
    processingPhoto: 'Preparing photo...',
  },
  fr: {
    attachmentsTitle: 'Photos',
    attachmentsSub: 'Stockage local uniquement. Ajouter une photo ne l’envoie pas à l’IA.',
    attachmentKind: 'Type de photo',
    kindPurchase: 'Achat',
    kindReceipt: 'Reçu',
    kindProof: 'Preuve / référence',
    addPhoto: 'Joindre une photo',
    photoAttached: 'Photo jointe',
    photosAttached: '{count} photos jointes',
    viewPhotos: 'Voir les photos',
    removePhoto: 'Supprimer la photo',
    closePreview: 'Fermer la photo',
    photoMissing: 'Le fichier photo est indisponible',
    photoAddError: 'Impossible d’ajouter cette photo.',
    expenseDeleteError: 'Impossible de supprimer cette dépense et ses photos locales. Réessayez.',
    photoTooLarge: 'Cette image est trop volumineuse pour être stockée en toute sécurité.',
    photoUnsupported: 'Choisissez un fichier image pris en charge.',
    photoLimit: 'Vous pouvez joindre jusqu’à {count} photos à une dépense.',
    attachmentSaveError: 'Les modifications des photos n’ont pas pu être enregistrées. Réessayez.',
    processingPhoto: 'Préparation de la photo...',
  },
  ar: {
    attachmentsTitle: 'الصور',
    attachmentsSub: 'محفوظة محلياً فقط. إرفاق صورة لا يرسلها إلى الذكاء الاصطناعي.',
    attachmentKind: 'نوع الصورة',
    kindPurchase: 'صورة المشتريات',
    kindReceipt: 'صورة الإيصال',
    kindProof: 'إثبات / مرجع',
    addPhoto: 'إرفاق صورة',
    photoAttached: 'صورة مرفقة',
    photosAttached: '{count} صور مرفقة',
    viewPhotos: 'عرض الصور',
    removePhoto: 'إزالة الصورة',
    closePreview: 'إغلاق الصورة',
    photoMissing: 'ملف الصورة غير متوفر',
    photoAddError: 'تعذر إضافة هذه الصورة.',
    expenseDeleteError: 'تعذر حذف هذا المصروف وصوره المحلية. حاول مرة أخرى.',
    photoTooLarge: 'حجم هذه الصورة كبير جداً للتخزين بشكل آمن.',
    photoUnsupported: 'اختر ملف صورة مدعوماً.',
    photoLimit: 'يمكن إرفاق حتى {count} صور لكل مصروف.',
    attachmentSaveError: 'تعذر حفظ تغييرات الصور مع المصروف. حاول مرة أخرى.',
    processingPhoto: 'جارٍ تجهيز الصورة...',
  },
} as const;

export type AttachmentTranslationKey = keyof typeof ATTACHMENT_TRANSLATIONS.en;

export function ta(
  lang: Language,
  key: AttachmentTranslationKey,
  params?: Record<string, string | number>
): string {
  const dictionary = ATTACHMENT_TRANSLATIONS[lang] || ATTACHMENT_TRANSLATIONS.en;
  let text: string = dictionary[key] || ATTACHMENT_TRANSLATIONS.en[key] || key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp('\\{' + name + '\\}', 'g'), String(value));
    }
  }
  return text;
}
