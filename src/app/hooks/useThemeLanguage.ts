import { useCallback, useEffect, useState } from 'react';
import { Language, ThemeMode } from '../../types';
import { preferencesRepository } from '../../data/PreferencesRepository';
import { analysisCacheService } from '../../services/AnalysisCacheService';

export function resolveDarkMode(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === 'DARK') return true;
  if (mode === 'LIGHT') return false;
  return systemPrefersDark;
}

export function directionForLanguage(language: Language): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

export function useThemeLanguage() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => preferencesRepository.getThemeMode());
  const [language, setLanguageState] = useState<Language>(() => preferencesRepository.getLanguage());

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
    preferencesRepository.setThemeMode(mode);
    setThemeModeState(mode);
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    preferencesRepository.setLanguage(nextLanguage);
    analysisCacheService.clear();
    setLanguageState(nextLanguage);
  }, []);

  const refreshFromStorage = useCallback(() => {
    setThemeModeState(preferencesRepository.getThemeMode());
    setLanguageState(preferencesRepository.getLanguage());
  }, []);

  return {
    themeMode,
    language,
    setThemeMode,
    setLanguage,
    refreshFromStorage,
  };
}
