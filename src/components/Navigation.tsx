import React from 'react';
import { BarChart3, Home, ReceiptText, Sparkles } from 'lucide-react';
import { Language, PrimaryScreen, Screen } from '../types';
import { t } from '../utils/translations';

interface NavigationProps {
  currentScreen: Screen;
  language: Language;
  onSelectScreen: (screen: PrimaryScreen) => void;
}

const NAV_COPY = {
  en: 'Primary navigation',
  fr: 'Navigation principale',
  ar: 'التنقل الرئيسي',
} as const;

export const Navigation: React.FC<NavigationProps> = ({
  currentScreen,
  language,
  onSelectScreen,
}) => {
  const navItems: {
    screen: PrimaryScreen;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { screen: 'home', label: t(language, 'navHome'), icon: Home },
    { screen: 'history', label: t(language, 'navHistory'), icon: ReceiptText },
    { screen: 'insights', label: t(language, 'navInsights'), icon: Sparkles },
    { screen: 'statistics', label: t(language, 'navStatistics'), icon: BarChart3 },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#05080C]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-[#202A33]/70 transition-colors"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label={NAV_COPY[language]}
    >
      <div className="max-w-md sm:max-w-lg mx-auto grid grid-cols-4 gap-1 px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = currentScreen === item.screen;
          return (
            <button
              key={item.screen}
              type="button"
              aria-current={isSelected ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => onSelectScreen(item.screen)}
              className="min-h-[56px] min-w-[56px] flex flex-col items-center justify-center py-1 px-1.5 transition-all cursor-pointer group active:scale-95 rounded-2xl"
            >
              <div
                className={`flex items-center justify-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 w-14 h-8 rounded-full shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white h-8 w-12'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <span
                className={`text-[10px] min-[360px]:text-[11px] mt-1 tracking-tight leading-tight text-center max-w-full truncate transition-colors ${
                  isSelected
                    ? 'text-slate-900 dark:text-white font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 font-semibold'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
