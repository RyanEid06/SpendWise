import React from 'react';
import { Home, ReceiptText, Sparkles, BarChart3, Settings } from 'lucide-react';
import { Language, Screen } from '../types';
import { t } from '../utils/translations';

interface NavigationProps {
  currentScreen: Screen;
  language: Language;
  onSelectScreen: (screen: Screen) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentScreen, language, onSelectScreen }) => {
  const navItems: { screen: Screen; label: string; icon: React.FC<{ className?: string }> }[] = [
    { screen: 'home', label: t(language, 'navHome'), icon: Home },
    { screen: 'history', label: t(language, 'navHistory'), icon: ReceiptText },
    { screen: 'insights', label: t(language, 'navInsights'), icon: Sparkles },
    { screen: 'statistics', label: t(language, 'navStatistics'), icon: BarChart3 },
    { screen: 'settings', label: t(language, 'navSettings'), icon: Settings },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#05080C]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-[#202A33]/70 transition-colors" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="tablist"
      aria-label="Main Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = currentScreen === item.screen;
          return (
            <button
              key={item.screen}
              role="tab"
              aria-selected={isSelected}
              aria-label={item.label}
              onClick={() => onSelectScreen(item.screen)}
              className="min-h-[48px] min-w-[56px] flex flex-col items-center justify-center py-1 px-1.5 transition-all cursor-pointer group active:scale-95"
            >
              <div
                className={`flex items-center justify-center transition-all duration-200 ${
                  isSelected
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 w-14 h-8 rounded-full shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 h-8 w-12'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[11px] mt-1 tracking-tight transition-colors ${
                  isSelected
                    ? 'text-slate-900 dark:text-white font-extrabold'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
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
