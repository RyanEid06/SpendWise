import React from 'react';
import type { Language } from '../types';
import { TechnicalDiagnostics } from '../features/settings/TechnicalDiagnostics';

// This copy must remain available before protected storage initializes.
export const storageFailureCopy = {
  en: { title: 'SpendWise could not safely open local data', recovery: 'Your existing financial data was not deleted. Close and reopen the app. If this continues, keep the current installation in place so the stored data remains available for recovery.' },
  fr: { title: 'SpendWise ne peut pas ouvrir les données locales en toute sécurité', recovery: 'Vos données financières existantes n’ont pas été supprimées. Fermez puis rouvrez l’application. Si le problème persiste, conservez l’installation actuelle afin de permettre la récupération des données.' },
  ar: { title: 'تعذر على SpendWise فتح البيانات المحلية بأمان', recovery: 'لم تُحذف بياناتك المالية الحالية. أغلق التطبيق ثم افتحه مجددًا. إذا استمرت المشكلة، احتفظ بالتثبيت الحالي حتى تبقى البيانات المحفوظة متاحة للاسترداد.' },
} as const;

export function StorageFailureScreen({ language }: { language: Language }) {
  const copy = storageFailureCopy[language];
  return <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-100 dark:bg-[#05080C] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
    <div className="w-full max-w-md rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#111928] p-6 shadow-sm space-y-3">
      <h1 className="text-lg font-extrabold">{copy.title}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{copy.recovery}</p>
      <TechnicalDiagnostics language={language} />
    </div>
  </div>;
}
