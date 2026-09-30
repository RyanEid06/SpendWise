import { useCallback, useEffect, useState } from 'react';
import { Language, ThemeMode } from '../../types';
import { StorageManager } from '../../utils/storage';

export function resolveDarkMode(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === 'DARK') return true;
  if (mode === 'LIGHT') return false;
  return systemPrefersDark;
}

export function directionForLanguage(language: Language): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

export function useThemeLanguage() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => StorageManager.getThemeMode());
  const [language, setLanguageState] = useState<Language>(() => StorageManager.getLanguage());

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      root.classList.toggle('dark', resolveDarkMode(themeMode, mediaQuery.matches));
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', directionForLanguage(language));
  }, [language]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    StorageManager.setThemeMode(mode);
    setThemeModeState(mode);
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    StorageManager.setLanguage(nextLanguage);
    StorageManager.clearAnalysisCache();
    setLanguageState(nextLanguage);
  }, []);

  const refreshFromStorage = useCallback(() => {
    setThemeModeState(StorageManager.getThemeMode());
    setLanguageState(StorageManager.getLanguage());
  }, []);

  return {
    themeMode,
    language,
    setThemeMode,
    setLanguage,
    refreshFromStorage,
  };
}
