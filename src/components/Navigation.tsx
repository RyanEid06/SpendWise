import React from 'react';
import { Home, ReceiptText, Sparkles, BarChart3, Settings } from 'lucide-react';
import { Screen } from '../types';

interface NavigationProps {
  currentScreen: Screen;
  onSelectScreen: (screen: Screen) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentScreen, onSelectScreen }) => {
  const navItems: { screen: Screen; label: string; icon: React.FC<{ className?: string }> }[] = [
    { screen: 'home', label: 'Home', icon: Home },
    { screen: 'history', label: 'History', icon: ReceiptText },
    { screen: 'insights', label: 'AI Insights', icon: Sparkles },
    { screen: 'statistics', label: 'Statistics', icon: BarChart3 },
    { screen: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/95 backdrop-blur-md border-t border-slate-900 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = currentScreen === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => onSelectScreen(item.screen)}
              className="flex flex-col items-center justify-center py-1 px-2.5 transition-all cursor-pointer"
            >
              <div
                className={`flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white w-14 h-8 rounded-full shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 h-8 w-12'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[11px] mt-1 tracking-tight font-medium ${
                  isSelected ? 'text-white font-bold' : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Android bottom gesture pill */}
      <div className="w-32 h-1 bg-slate-700/60 rounded-full mx-auto mb-1.5 mt-0.5"></div>
    </nav>
  );
};
