import React from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { Language, Screen } from '../types';
import { t } from '../utils/translations';

const COPY = {
  en: { settings: 'Open Settings', back: 'Back to previous screen' },
  fr: { settings: 'Ouvrir les paramètres', back: 'Retour à l’écran précédent' },
  ar: { settings: 'فتح الإعدادات', back: 'العودة إلى الشاشة السابقة' },
} as const;

function screenLabel(screen: Screen, language: Language): string {
  if (screen === 'history') return t(language, 'navHistory');
  if (screen === 'insights') return t(language, 'navInsights');
  if (screen === 'statistics') return t(language, 'navStatistics');
  if (screen === 'settings') return t(language, 'navSettings');
  return t(language, 'navHome');
}

export const AppTopBar: React.FC<{
  currentScreen: Screen;
  language: Language;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
}> = ({ currentScreen, language, onOpenSettings, onCloseSettings }) => {
  const isSettings = currentScreen === 'settings';
  const copy = COPY[language];

  return (
    <header
      className="sticky top-0 z-40 bg-slate-100/95 dark:bg-[#05080C]/95 backdrop-blur-md px-4 pb-2 transition-colors border-b border-slate-200/60 dark:border-[#202A33]/80"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
    >
      <div className="max-w-md sm:max-w-lg mx-auto">
        <div className="min-h-[52px] flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5 rtl:flex-row-reverse">
            {isSettings && (
              <button
                type="button"
                onClick={onCloseSettings}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#111928] border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors"
                aria-label={copy.back}
                title={copy.back}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>
            )}

            <img
              src="/spendwise-original-icon.png"
              alt=""
              aria-hidden="true"
              className="w-8 h-8 rounded-lg object-contain shrink-0"
            />

            <div className="min-w-0">
              <div className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white leading-tight">
                SpendWise
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                {screenLabel(currentScreen, language)}
              </div>
            </div>
          </div>

          {!isSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-[#111928]/80 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors shadow-xs"
              aria-label={copy.settings}
              title={copy.settings}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
