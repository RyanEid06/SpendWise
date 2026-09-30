import React, { useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { Language } from '../types';
import { getLegalDocument, type LegalDocumentKind } from '../utils/legalDocuments';

interface Props {
  language: Language;
  kind: LegalDocumentKind;
  onClose: () => void;
}

export const LegalDocumentScreen: React.FC<Props> = ({ language, kind, onClose }) => {
  const documentCopy = getLegalDocument(language, kind);

  useEffect(() => {
    const handleBack = () => onClose();
    window.addEventListener('spendwise-native-back', handleBack);
    return () => window.removeEventListener('spendwise-native-back', handleBack);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-100 dark:bg-[#05080C] text-slate-900 dark:text-slate-100 overflow-y-auto"
      data-native-back-layer="true"
    >
      <div className="max-w-md sm:max-w-lg mx-auto px-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-slate-100/95 dark:bg-[#05080C]/95 backdrop-blur flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111928]"
            aria-label={language === 'ar' ? 'رجوع' : language === 'fr' ? 'Retour' : 'Back'}
          >
            {language === 'ar' ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-extrabold text-lg truncate">{documentCopy.title}</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{documentCopy.updated}</p>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {documentCopy.sections.map((section) => (
            <section key={section.heading} className="bg-white dark:bg-[#111928] border border-slate-200 dark:border-slate-800 rounded-3xl p-5">
              <h2 className="font-bold text-sm mb-2">{section.heading}</h2>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
