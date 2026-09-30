import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, FileText, Image as ImageIcon, Tag, X } from 'lucide-react';
import { Expense, ExpenseAttachment, Language } from '../types';
import { AttachmentStorage } from '../utils/attachmentStorage';
import { ta } from '../utils/attachmentTranslations';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName } from '../utils/translations';
import { localeForLanguage } from '../utils/historyView';
import { ViewportPortal } from './ViewportPortal';
import { useSensitivePrivacySurface } from '../app/hooks/useSensitivePrivacySurface';

const DETAIL_COPY = {
  en: {
    title: 'Expense Details',
    readOnly: 'Read-only view',
    photos: 'Attached photos',
    noPhotos: 'No photos attached',
    amount: 'Amount',
    category: 'Category',
    date: 'Date',
    description: 'Description',
    note: 'Notes',
    close: 'Close details',
  },
  fr: {
    title: 'Détails de la dépense',
    readOnly: 'Vue en lecture seule',
    photos: 'Photos jointes',
    noPhotos: 'Aucune photo jointe',
    amount: 'Montant',
    category: 'Catégorie',
    date: 'Date',
    description: 'Description',
    note: 'Notes',
    close: 'Fermer les détails',
  },
  ar: {
    title: 'تفاصيل المصروف',
    readOnly: 'عرض للقراءة فقط',
    photos: 'الصور المرفقة',
    noPhotos: 'لا توجد صور مرفقة',
    amount: 'المبلغ',
    category: 'الفئة',
    date: 'التاريخ',
    description: 'الوصف',
    note: 'ملاحظات',
    close: 'إغلاق التفاصيل',
  },
} as const;

const PhotoThumb: React.FC<{
  attachment: ExpenseAttachment;
  language: Language;
  onOpen: (url: string) => void;
}> = ({ attachment, language, onOpen }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let disposed = false;
    let createdUrl: string | null = null;
    void AttachmentStorage.readAttachmentUrl(attachment)
      .then((value) => {
        if (disposed) {
          AttachmentStorage.revokePreviewUrl(value);
          return;
        }
        createdUrl = value;
        setUrl(value);
      })
      .catch(() => setMissing(true));

    return () => {
      disposed = true;
      AttachmentStorage.revokePreviewUrl(createdUrl);
    };
  }, [attachment.id, attachment.storageKey]);

  if (missing) {
    return (
      <div className="aspect-square rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-2 text-center text-[10px] text-slate-500">
        {ta(language, 'photoMissing')}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!url}
      onClick={() => url && onOpen(url)}
      className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-60"
      aria-label={ta(language, 'viewPhotos')}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400">
          <ImageIcon className="w-5 h-5" />
        </div>
      )}
    </button>
  );
};

export const ExpenseDetailModal: React.FC<{
  expense: Expense;
  currencyCode: string;
  language: Language;
  onClose: () => void;
}> = ({ expense, currencyCode, language, onClose }) => {
  useSensitivePrivacySurface();
  const copy = DETAIL_COPY[language];
  const category = getCategoryInfo(expense.category);
  const attachments = useMemo(
    () => AttachmentStorage.getAttachmentsForExpense(expense.id),
    [expense.id]
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleNativeBack = () => {
      if (!previewUrl) onClose();
    };
    const handlePreviewBack = () => setPreviewUrl(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (previewUrl) setPreviewUrl(null);
      else onClose();
    };

    window.addEventListener('spendwise-native-back', handleNativeBack);
    window.addEventListener('spendwise-close-attachment-preview', handlePreviewBack);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('spendwise-native-back', handleNativeBack);
      window.removeEventListener('spendwise-close-attachment-preview', handlePreviewBack);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, previewUrl]);

  return (
    <ViewportPortal><>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-detail-title"
        data-native-back-layer="true"
      >
        <div className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="expense-detail-title" className="font-extrabold text-lg text-slate-900 dark:text-white">
                {copy.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{copy.readOnly}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={copy.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-5">
            <div className="rounded-3xl bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 p-4">
              <div dir="ltr" className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 [overflow-wrap:anywhere]">
                {formatCurrency(expense.amount, currencyCode)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-xl"
                  style={{ color: category.color, backgroundColor: `${category.color}16` }}
                >
                  <span aria-hidden="true">{category.iconEmoji}</span>
                  {getLocalizedCategoryName(expense.category, language)}
                </span>
                <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: 'full', timeStyle: 'short' }).format(new Date(expense.date))}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {copy.description}
                </div>
                <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white break-words leading-relaxed">
                  {expense.description}
                </p>
              </div>

              {expense.note && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {copy.note}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 break-words whitespace-pre-wrap leading-relaxed">
                    {expense.note}
                  </p>
                </div>
              )}
            </div>

            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {copy.photos}
                </h3>
                {attachments.length > 0 && (
                  <span className="text-xs font-bold text-slate-500">{attachments.length}</span>
                )}
              </div>

              {attachments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  {copy.noPhotos}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {attachments.map((attachment) => (
                    <PhotoThumb
                      key={attachment.id}
                      attachment={attachment}
                      language={language}
                      onOpen={setPreviewUrl}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[46px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm"
            >
              {copy.close}
            </button>
          </div>
        </div>
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 p-4 flex items-center justify-center"
          data-attachment-viewer="true"
          role="dialog"
          aria-modal="true"
        >
          <img src={previewUrl} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 rtl:right-auto rtl:left-4 min-w-[48px] min-h-[48px] rounded-full bg-black/60 text-white flex items-center justify-center"
            aria-label={ta(language, 'closePreview')}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </></ViewportPortal>
  );
};
