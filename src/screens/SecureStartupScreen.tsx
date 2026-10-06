import React from 'react';
import { SpendWiseLogo } from '../components/SpendWiseLogo';
import type { Language } from '../types';

const COPY = {
  en: { title: 'SpendWise', status: 'Starting securely…' },
  fr: { title: 'SpendWise', status: 'Démarrage sécurisé…' },
  ar: { title: 'SpendWise', status: 'بدء التشغيل الآمن…' },
} as const;

export const SecureStartupScreen: React.FC<{ language: Language }> = ({ language }) => {
  const copy = COPY[language];

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900 dark:bg-[#05080C] dark:text-slate-100"
      data-testid="secure-startup-surface"
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <SpendWiseLogo className="h-28 w-28 sm:h-32 sm:w-32" />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{copy.title}</h1>
        <div className="mt-5 flex items-center gap-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
          <span className="sw-secure-spinner" aria-hidden="true" />
          <span>{copy.status}</span>
        </div>
      </div>
    </div>
  );
};
