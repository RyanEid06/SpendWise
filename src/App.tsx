import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { apiFetch } from './utils/api';
import { Plus } from 'lucide-react';
import { Expense, MonthlyBudget, Screen, ThemeMode, CategorySpend, AiAnalysisResult, Language } from './types';
import {
  currentMonthYear,
  getDisplayName,
  getEndOfMonthTimestamp,
  getDefaultTimestampForMonth,
  getMonthKey,
  getStartOfMonthTimestamp,
  nextMonth,
  previousMonth,
} from './utils/date';
import { StorageManager } from './utils/storage';
import { getCategoryInfo } from './utils/categories';
import { SpendingAnalyzer } from './utils/spendingAnalyzer';
import { Navigation } from './components/Navigation';
import { DashboardScreen } from './screens/DashboardScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { AiInsightsScreen } from './screens/AiInsightsScreen';
import { StatisticsScreen } from './screens/StatisticsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LockScreen } from './screens/LockScreen';
import { AddEditExpenseModal } from './components/AddEditExpenseModal';
import { SetBudgetModal } from './components/SetBudgetModal';

export const App: React.FC = () => {
  StorageManager.init();

  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [currentMY, setCurrentMY] = useState(currentMonthYear());

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>(() => StorageManager.getExpenses());
  const [budgets, setBudgets] = useState<MonthlyBudget[]>(() => StorageManager.getBudgets());
  const [currencyCode, setCurrencyCodeState] = useState<string>(() => StorageManager.getCurrencyCode());
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => StorageManager.getThemeMode());
  const [language, setLanguageState] = useState<Language>(() => StorageManager.getLanguage());

  // App Lock states
  const [appLockEnabled, setAppLockEnabledState] = useState<boolean>(() => StorageManager.isAppLockEnabled());
  const [lockTimeoutSeconds, setLockTimeoutSecondsState] = useState<number>(() => StorageManager.getLockTimeoutSeconds());
  const [isLocked, setIsLocked] = useState<boolean>(() =>
    StorageManager.isAppLockEnabled() && StorageManager.hasLockPin()
  );

  // Modal dialog states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  // AI Insights states
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(() =>
    StorageManager.getCachedAnalysis(getMonthKey(currentMonthYear()))
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Load cached AI analysis whenever currentMY changes
  useEffect(() => {
    const key = getMonthKey(currentMY);
    const cached = StorageManager.getCachedAnalysis(key);
    setAiResult(cached);
    setAiError(null);
    setAiNotice(null);
  }, [currentMY, expenses, currencyCode, language]);

  // Handle Theme class on document.documentElement with system listener
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (themeMode === 'DARK') {
        root.classList.add('dark');
      } else if (themeMode === 'LIGHT') {
        root.classList.remove('dark');
      } else {
        // SYSTEM
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themeMode]);

  // Handle RTL and language attribute on document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    if (language === 'ar') {
      root.setAttribute('dir', 'rtl');
    } else {
      root.setAttribute('dir', 'ltr');
    }
  }, [language]);

  // Lock timeout uses the native Capacitor lifecycle on Android and falls back
  // to document visibility in the browser.
  useEffect(() => {
    if (!appLockEnabled || !StorageManager.hasLockPin()) return;

    let backgroundedAt = 0;
    let disposed = false;
    let removeNativeListener: (() => Promise<void>) | null = null;

    const applyResumeLock = () => {
      if (backgroundedAt <= 0) return;
      const elapsedSec = (Date.now() - backgroundedAt) / 1000;
      if (elapsedSec >= lockTimeoutSeconds) {
        setIsLocked(true);
      }
      backgroundedAt = 0;
    };

    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          backgroundedAt = Date.now();
        } else {
          applyResumeLock();
        }
      }).then((handle) => {
        if (disposed) {
          void handle.remove();
        } else {
          removeNativeListener = () => handle.remove();
        }
      });

      return () => {
        disposed = true;
        if (removeNativeListener) void removeNativeListener();
      };
    }

    const handleVisibility = () => {
      if (document.hidden) {
        backgroundedAt = Date.now();
      } else {
        applyResumeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [appLockEnabled, lockTimeoutSeconds]);

  // Android Back: close app-level dialogs first, then return to Home, then exit.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let disposed = false;
    let removeBackListener: (() => Promise<void>) | null = null;

    void CapacitorApp.addListener('backButton', () => {
      if (showAddModal || editingExpense !== null) {
        setShowAddModal(false);
        setEditingExpense(null);
        return;
      }

      if (showBudgetModal) {
        setShowBudgetModal(false);
        return;
      }

      if (currentScreen !== 'home') {
        setCurrentScreen('home');
        return;
      }

      void CapacitorApp.exitApp();
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        removeBackListener = () => handle.remove();
      }
    });

    return () => {
      disposed = true;
      if (removeBackListener) void removeBackListener();
    };
  }, [currentScreen, showAddModal, editingExpense, showBudgetModal]);

  // Filter expenses for current month
  const monthlyExpenses = useMemo(() => {
    const start = getStartOfMonthTimestamp(currentMY);
    const end = getEndOfMonthTimestamp(currentMY);
    return expenses.filter((e) => e.date >= start && e.date <= end);
  }, [expenses, currentMY]);

  // Current Month's Budget
  const currentBudget = useMemo(() => {
    const key = getMonthKey(currentMY);
    return budgets.find((b) => b.monthKey === key) || null;
  }, [budgets, currentMY]);

  const startingMoney = currentBudget?.startingAmount || 0;
  const isBudgetSet = currentBudget !== null;
  const totalSpent = useMemo(() => {
    return monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [monthlyExpenses]);
  const remainingMoney = startingMoney - totalSpent;
  const progress = startingMoney > 0 ? totalSpent / startingMoney : 0;

  // Top 3 expenses
  const topExpenses = useMemo(() => {
    return [...monthlyExpenses].sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [monthlyExpenses]);

  // Category breakdown
  const categoryBreakdown: CategorySpend[] = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const exp of monthlyExpenses) {
      groups[exp.category] = (groups[exp.category] || 0) + exp.amount;
    }

    return Object.entries(groups)
      .map(([catName, amount]) => {
        const percentage = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
        const info = getCategoryInfo(catName);
        return {
          categoryName: catName,
          amount,
          percentage,
          iconEmoji: info.iconEmoji,
          color: info.color,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyExpenses, totalSpent]);

  // Actions
  const handleAddExpense = (
    amount: number,
    description: string,
    category: string,
    date: number,
    note?: string | null
  ) => {
    StorageManager.addExpense({
      amount,
      description,
      category,
      date,
      note,
    });
    setExpenses(StorageManager.getExpenses());
  };

  const handleUpdateExpense = (
    id: number,
    amount: number,
    description: string,
    category: string,
    date: number,
    note?: string | null
  ) => {
    const existing = expenses.find((e) => e.id === id);
    if (existing) {
      StorageManager.updateExpense({
        ...existing,
        amount,
        description,
        category,
        date,
        note,
      });
      setExpenses(StorageManager.getExpenses());
    }
  };

  const handleDeleteExpense = (expense: Expense) => {
    StorageManager.deleteExpense(expense.id);
    setExpenses(StorageManager.getExpenses());
  };

  const handleSetStartingMoney = (amount: number) => {
    const key = getMonthKey(currentMY);
    StorageManager.setBudget(key, amount);
    setBudgets(StorageManager.getBudgets());
  };

  const handleCurrencyChange = (code: string, targetUnitsPerSourceUnit?: number) => {
    const storedExpenses = StorageManager.getExpenses();
    const storedBudgets = StorageManager.getBudgets();
    const hasFinancialData = storedExpenses.length > 0 || storedBudgets.length > 0;

    if (code === StorageManager.getCurrencyCode()) return;

    if (hasFinancialData) {
      if (targetUnitsPerSourceUnit === undefined) {
        throw new Error('A conversion rate is required for an existing financial ledger.');
      }
      StorageManager.convertCurrency(code, targetUnitsPerSourceUnit);
    } else {
      StorageManager.setCurrencyCode(code);
      StorageManager.clearAnalysisCache();
    }

    setExpenses(StorageManager.getExpenses());
    setBudgets(StorageManager.getBudgets());
    setCurrencyCodeState(StorageManager.getCurrencyCode());
    setAiResult(null);
    setAiError(null);
    setAiNotice(null);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    StorageManager.setThemeMode(mode);
    setThemeModeState(mode);
  };

  const handleLanguageChange = (newLang: Language) => {
    StorageManager.setLanguage(newLang);
    StorageManager.clearAnalysisCache();
    setLanguageState(newLang);
    setAiResult(null);
  };

  const handleAppLockToggle = (enabled: boolean) => {
    if (enabled && !StorageManager.hasLockPin()) return;

    StorageManager.setAppLockEnabled(enabled);
    setAppLockEnabledState(enabled);
    if (!enabled) {
      setIsLocked(false);
    }
  };

  const handleLockTimeoutChange = (seconds: number) => {
    StorageManager.setLockTimeoutSeconds(seconds);
    setLockTimeoutSecondsState(seconds);
  };

  const handleClearAllData = () => {
    StorageManager.clearAllData();
    setExpenses([]);
    setBudgets([]);
    setAiResult(null);
  };

  const handleBackupRestored = () => {
    setExpenses(StorageManager.getExpenses());
    setBudgets(StorageManager.getBudgets());
    setCurrencyCodeState(StorageManager.getCurrencyCode());
    setThemeModeState(StorageManager.getThemeMode());
    setLanguageState(StorageManager.getLanguage());
    const cached = StorageManager.getCachedAnalysis(getMonthKey(currentMY));
    setAiResult(cached);
  };

  // Run AI Analysis
  const handleAnalyzeSpending = useCallback(async () => {
    if (expenses.length === 0) {
      setAiError('No expenses recorded yet. Please add some expenses before analyzing your spending.');
      return;
    }

    if (monthlyExpenses.length === 0) {
      setAiError(
        `No expenses recorded for ${getDisplayName(
          currentMY
        )}. Switch to a month with recorded expenses to run analysis.`
      );
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    setAiNotice(null);

    const analyzer = new SpendingAnalyzer();
    const summary = analyzer.computeHistoricalSummary(expenses, currentMY);
    const localFallback = analyzer.generateStatisticalAnalysis(summary, currencyCode);

    try {
      const response = await apiFetch(
        '/api/gemini/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            summary,
            currencyCode,
            language,
          }),
        },
        30000
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data: AiAnalysisResult = await response.json();
      StorageManager.cacheAnalysis(data);
      setAiResult(data);
    } catch (err: any) {
      // Fallback to local statistical calculation gracefully
      console.warn('Gemini spending analysis error, using statistical fallback:', err);
      StorageManager.cacheAnalysis(localFallback);
      setAiResult(localFallback);
      const isApiKeyMissing = err.message?.includes('Gemini API key');
      setAiNotice(
        isApiKeyMissing
          ? 'Gemini API key not configured. Using verified local statistical analysis.'
          : 'Unable to reach Gemini AI service right now. Using verified local statistical analysis.'
      );
    } finally {
      setIsAiLoading(false);
    }
  }, [expenses, monthlyExpenses, currentMY, currencyCode, language]);

  if (isLocked) {
    return <LockScreen storedPin={StorageManager.getLockPin()} language={language} onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors duration-200">
      {/* Android Top Status Bar & App Header */}
      <header className="sticky top-0 z-40 bg-slate-100/95 dark:bg-[#0B0F19]/95 backdrop-blur-md px-4 pb-2 transition-colors border-b border-slate-200/50 dark:border-slate-800/50" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
        <div className="max-w-md mx-auto space-y-1.5">
          {/* App Branding (Clean, language switcher moved to Settings) */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                S
              </div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                SpendWise
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-1" style={{ paddingBottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' }}>
        {currentScreen === 'home' && (
          <DashboardScreen
            currentMonthYear={currentMY}
            startingMoney={startingMoney}
            isBudgetSet={isBudgetSet}
            totalSpent={totalSpent}
            remainingMoney={remainingMoney}
            progress={progress}
            topExpenses={topExpenses}
            categoryBreakdown={categoryBreakdown}
            currencyCode={currencyCode}
            language={language}
            onPreviousMonth={() => setCurrentMY((prev) => previousMonth(prev))}
            onNextMonth={() => setCurrentMY((prev) => nextMonth(prev))}
            onSetBudgetClick={() => setShowBudgetModal(true)}
            onExpenseClick={(expense) => setEditingExpense(expense)}
            onAddExpenseClick={() => {
              setEditingExpense(null);
              setShowAddModal(true);
            }}
          />
        )}

        {currentScreen === 'history' && (
          <HistoryScreen
            currentMonthYear={currentMY}
            expenses={monthlyExpenses}
            currencyCode={currencyCode}
            language={language}
            onPreviousMonth={() => setCurrentMY((prev) => previousMonth(prev))}
            onNextMonth={() => setCurrentMY((prev) => nextMonth(prev))}
            onExpenseClick={(expense) => setEditingExpense(expense)}
            onDeleteExpense={handleDeleteExpense}
            onAddExpenseClick={() => {
              setEditingExpense(null);
              setShowAddModal(true);
            }}
          />
        )}

        {currentScreen === 'insights' && (
          <AiInsightsScreen
            currentMonthYear={currentMY}
            analysisResult={aiResult}
            isLoading={isAiLoading}
            error={aiError}
            notice={aiNotice}
            language={language}
            onPreviousMonth={() => setCurrentMY((prev) => previousMonth(prev))}
            onNextMonth={() => setCurrentMY((prev) => nextMonth(prev))}
            onAnalyzeClick={handleAnalyzeSpending}
            onAddExpenseClick={() => {
              setEditingExpense(null);
              setShowAddModal(true);
            }}
          />
        )}

        {currentScreen === 'statistics' && (
          <StatisticsScreen
            expenses={expenses}
            budgets={budgets}
            currentMonthYear={currentMY}
            currencyCode={currencyCode}
            language={language}
            onNavigateToExpense={(expense) => {
              setEditingExpense(expense);
              setShowAddModal(true);
            }}
          />
        )}

        {currentScreen === 'settings' && (
          <SettingsScreen
            currentCurrencyCode={currencyCode}
            currentThemeMode={themeMode}
            currentLanguage={language}
            totalExpensesCount={expenses.length}
            totalBudgetsCount={budgets.length}
            isAppLockEnabled={appLockEnabled}
            lockTimeoutSeconds={lockTimeoutSeconds}
            onAppLockToggle={handleAppLockToggle}
            onLockTimeoutChange={handleLockTimeoutChange}
            onCurrencyChange={handleCurrencyChange}
            onThemeChange={handleThemeChange}
            onLanguageChange={handleLanguageChange}
            onClearAllData={handleClearAllData}
            onBackupRestored={handleBackupRestored}
          />
        )}
      </main>

      {/* Floating Action Button (Cleanly positioned on secondary screens; Home uses stationary bottom button) */}
      {currentScreen !== 'settings' && currentScreen !== 'home' && (
        <button
          onClick={() => {
            setEditingExpense(null);
            setShowAddModal(true);
          }}
          className="fixed right-4 rtl:right-auto rtl:left-4 z-30 min-w-[52px] min-h-[52px] w-13 h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          aria-label={language === 'ar' ? 'إضافة مصروف' : language === 'fr' ? 'Ajouter une dépense' : 'Add Expense'}
        >
          <Plus className="w-6 h-6 stroke-[2.75]" />
        </button>
      )}

      {/* Bottom Navigation */}
      <Navigation currentScreen={currentScreen} language={language} onSelectScreen={setCurrentScreen} />

      {/* Add / Edit Expense Modal Dialog */}
      {(showAddModal || editingExpense !== null) && (
        <AddEditExpenseModal
          isOpen={true}
          initialExpense={editingExpense}
          defaultDate={getDefaultTimestampForMonth(currentMY)}
          currencyCode={currencyCode}
          language={language}
          onSave={(amount, description, category, date, note) => {
            if (editingExpense) {
              handleUpdateExpense(editingExpense.id, amount, description, category, date, note);
            } else {
              handleAddExpense(amount, description, category, date, note);
            }
            setShowAddModal(false);
            setEditingExpense(null);
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Set Starting Budget Modal */}
      {showBudgetModal && (
        <SetBudgetModal
          isOpen={true}
          monthName={getDisplayName(currentMY)}
          currentStartingAmount={startingMoney}
          currencyCode={currencyCode}
          language={language}
          onSave={handleSetStartingMoney}
          onClose={() => setShowBudgetModal(false)}
        />
      )}
    </div>
  );
};
