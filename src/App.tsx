import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { apiFetchJson } from './utils/api';
import { getAiErrorMessage } from './utils/apiErrors';
import { t } from './utils/translations';
import { Plus } from 'lucide-react';
import { Expense, MonthlyBudget, Screen, PrimaryScreen, ThemeMode, CategorySpend, AiAnalysisResult, Language } from './types';
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
import { SetupWizardScreen } from './screens/SetupWizardScreen';
import { SetupState } from './utils/setupState';
import { AddEditExpenseModal } from './components/AddEditExpenseModal';
import { SetBudgetModal } from './components/SetBudgetModal';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';
import { AppTopBar } from './components/AppTopBar';
import { AttachmentEditPayload } from './utils/attachmentStorage';
import { UndoSnackbar } from './components/UndoSnackbar';
import { ExpenseDeleteUndoController, restorePendingExpenses } from './utils/undoDeleteBatch';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [settingsReturnScreen, setSettingsReturnScreen] = useState<PrimaryScreen>('home');
  const [currentMY, setCurrentMY] = useState(currentMonthYear());
  const [setupMode, setSetupMode] = useState<'first-run' | 'replay' | null>(() =>
    SetupState.shouldShowFirstRun() ? 'first-run' : null
  );

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
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [deleteUndoCount, setDeleteUndoCount] = useState(0);
  const [deleteCommitError, setDeleteCommitError] = useState(false);

  const deleteUndoRef = useRef<ExpenseDeleteUndoController | null>(null);
  if (!deleteUndoRef.current) {
    deleteUndoRef.current = new ExpenseDeleteUndoController({
      onBatchChange: (snapshot) => setDeleteUndoCount(snapshot?.count ?? 0),
      onCommit: async (entries) => {
        await StorageManager.deleteExpenses(entries.map((entry) => entry.expense.id));
      },
      onCommitError: (entries, error) => {
        console.error('Failed to commit staged expense deletion.', error);
        setExpenses((current) => restorePendingExpenses(current, entries));
        setDeleteCommitError(true);
      },
    });
  }

  const readVisibleExpenses = useCallback(() => {
    const pendingIds = new Set(deleteUndoRef.current?.getPendingExpenseIds() ?? []);
    return StorageManager.getExpenses().filter((expense) => !pendingIds.has(expense.id));
  }, []);

  const undoPendingExpenseDeletes = useCallback(() => {
    const entries = deleteUndoRef.current?.undo() ?? [];
    if (entries.length === 0) return;
    setExpenses((current) => restorePendingExpenses(current, entries));
    StorageManager.clearAnalysisCache();
    setAiResult(null);
    setDeleteCommitError(false);
  }, []);

  useEffect(() => () => {
    deleteUndoRef.current?.dispose();
  }, []);

  const selectPrimaryScreen = useCallback((screen: PrimaryScreen) => {
    setSettingsReturnScreen(screen);
    setCurrentScreen(screen);
  }, []);

  const openSettings = useCallback(() => {
    if (currentScreen !== 'settings') {
      setSettingsReturnScreen(currentScreen as PrimaryScreen);
      setCurrentScreen('settings');
    }
  }, [currentScreen]);

  const closeSettings = useCallback(() => {
    setCurrentScreen(settingsReturnScreen);
  }, [settingsReturnScreen]);

  // AI Insights states
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(() =>
    StorageManager.getCachedAnalysis(getMonthKey(currentMonthYear()))
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const aiRequestIdRef = useRef(0);
  const aiInFlightRef = useRef(false);

  // Load cached AI analysis whenever currentMY changes
  useEffect(() => {
    aiRequestIdRef.current += 1;
    aiInFlightRef.current = false;
    setIsAiLoading(false);
    const key = getMonthKey(currentMY);
    const cached = StorageManager.getCachedAnalysis(key);
    setAiResult(cached);
    setAiError(null);
    setAiNotice(null);
  }, [currentMY, expenses, currencyCode, language]);

  useEffect(() => {
    return () => {
      aiRequestIdRef.current += 1;
      aiInFlightRef.current = false;
    };
  }, []);

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
        window.dispatchEvent(new Event('spendwise-native-back'));
        setShowAddModal(false);
        setEditingExpense(null);
        setViewingExpense(null);
        setShowBudgetModal(false);
        setIsLocked(true);
      }
      backgroundedAt = 0;
    };

    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          undoPendingExpenseDeletes();
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
        undoPendingExpenseDeletes();
        backgroundedAt = Date.now();
      } else {
        applyResumeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [appLockEnabled, lockTimeoutSeconds, undoPendingExpenseDeletes]);

  // Android Back: close app-level dialogs first, then return to Home, then exit.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let disposed = false;
    let removeBackListener: (() => Promise<void>) | null = null;

    void CapacitorApp.addListener('backButton', () => {
      if (document.querySelector('[data-attachment-viewer="true"]')) {
        window.dispatchEvent(new Event('spendwise-close-attachment-preview'));
        return;
      }

      if (document.querySelector('[data-native-back-layer="true"]')) {
        window.dispatchEvent(new Event('spendwise-native-back'));
        return;
      }

      if (showAddModal || editingExpense !== null) {
        setShowAddModal(false);
        setEditingExpense(null);
        return;
      }

      if (showBudgetModal) {
        setShowBudgetModal(false);
        return;
      }

      if (currentScreen === 'settings') {
        setCurrentScreen(settingsReturnScreen);
        return;
      }

      if (currentScreen !== 'home') {
        setCurrentScreen('home');
        setSettingsReturnScreen('home');
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
  }, [currentScreen, showAddModal, editingExpense, showBudgetModal, settingsReturnScreen]);

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
  const handleAddExpense = async (
    amount: number,
    description: string,
    category: string,
    date: number,
    note: string | null,
    attachmentChanges: AttachmentEditPayload
  ) => {
    await StorageManager.addExpense(
      {
        amount,
        description,
        category,
        date,
        note,
      },
      attachmentChanges
    );
    setExpenses(readVisibleExpenses());
  };

  const handleUpdateExpense = async (
    id: number,
    amount: number,
    description: string,
    category: string,
    date: number,
    note: string | null,
    attachmentChanges: AttachmentEditPayload
  ) => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) return;

    await StorageManager.updateExpense(
      {
        ...existing,
        amount,
        description,
        category,
        date,
        note,
      },
      attachmentChanges
    );
    setExpenses(readVisibleExpenses());
  };

  const handleDeleteExpense = (expense: Expense) => {
    const currentIndex = expenses.findIndex((item) => item.id === expense.id);
    if (currentIndex < 0) return;
    if (!deleteUndoRef.current?.stage(expense, currentIndex)) return;

    StorageManager.clearAnalysisCache();
    setAiResult(null);
    setDeleteCommitError(false);
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    if (viewingExpense?.id === expense.id) setViewingExpense(null);
  };

  const handleSetStartingMoney = async (amount: number) => {
    const key = getMonthKey(currentMY);
    await StorageManager.setBudget(key, amount);
    setBudgets(StorageManager.getBudgets());
  };

  const handleCurrencyChange = async (code: string, targetUnitsPerSourceUnit?: number) => {
    undoPendingExpenseDeletes();
    const storedExpenses = StorageManager.getExpenses();
    const storedBudgets = StorageManager.getBudgets();
    const hasFinancialData = storedExpenses.length > 0 || storedBudgets.length > 0;

    if (code === StorageManager.getCurrencyCode()) return;

    if (hasFinancialData) {
      if (targetUnitsPerSourceUnit === undefined) {
        throw new Error('A conversion rate is required for an existing financial ledger.');
      }
      await StorageManager.convertCurrency(code, targetUnitsPerSourceUnit);
    } else {
      await StorageManager.setCurrencyCode(code);
      StorageManager.clearAnalysisCache();
    }

    setExpenses(readVisibleExpenses());
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

  const handleClearAllData = async () => {
    deleteUndoRef.current?.dispose();
    setDeleteCommitError(false);
    await StorageManager.clearAllData();
    setExpenses([]);
    setBudgets([]);
    setAiResult(null);
    setViewingExpense(null);
  };

  const handleBackupRestored = () => {
    deleteUndoRef.current?.dispose();
    setDeleteCommitError(false);
    setViewingExpense(null);
    setExpenses(readVisibleExpenses());
    setBudgets(StorageManager.getBudgets());
    setCurrencyCodeState(StorageManager.getCurrencyCode());
    setThemeModeState(StorageManager.getThemeMode());
    setLanguageState(StorageManager.getLanguage());
    const cached = StorageManager.getCachedAnalysis(getMonthKey(currentMY));
    setAiResult(cached);
  };

  // Run AI Analysis
  const handleAnalyzeSpending = useCallback(async () => {
    if (aiInFlightRef.current) return;

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

    aiInFlightRef.current = true;
    const requestId = ++aiRequestIdRef.current;
    setIsAiLoading(true);
    setAiError(null);
    setAiNotice(null);

    const analyzer = new SpendingAnalyzer();
    const summary = analyzer.computeHistoricalSummary(expenses, currentMY);
    const localFallback = analyzer.generateStatisticalAnalysis(summary, currencyCode);

    try {
      const data = await apiFetchJson<AiAnalysisResult>(
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

      if (requestId !== aiRequestIdRef.current) return;
      StorageManager.cacheAnalysis(data);
      setAiResult(data);
    } catch (error) {
      if (requestId !== aiRequestIdRef.current) return;
      console.warn('AI spending analysis unavailable; using local statistical fallback.');
      StorageManager.cacheAnalysis(localFallback);
      setAiResult(localFallback);
      setAiNotice(`${getAiErrorMessage(language, error)} ${t(language, 'aiFallbackNotice')}`);
    } finally {
      if (requestId === aiRequestIdRef.current) {
        aiInFlightRef.current = false;
        setIsAiLoading(false);
      }
    }
  }, [expenses, monthlyExpenses, currentMY, currencyCode, language]);

  if (setupMode) {
    return (
      <SetupWizardScreen
        mode={setupMode}
        language={language}
        currencyCode={currencyCode}
        themeMode={themeMode}
        totalExpensesCount={expenses.length}
        totalBudgetsCount={budgets.length}
        onLanguageChange={handleLanguageChange}
        onCurrencyChange={handleCurrencyChange}
        onThemeChange={handleThemeChange}
        onAppLockConfigured={() => {
          setAppLockEnabledState(StorageManager.isAppLockEnabled());
          setIsLocked(false);
        }}
        onComplete={() => setSetupMode(null)}
        onCancel={setupMode === 'replay' ? () => setSetupMode(null) : undefined}
      />
    );
  }

  if (isLocked) {
    return <LockScreen storedPin={StorageManager.getLockPin()} language={language} onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#05080C] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors duration-200">
      <a
        href="#main-content"
        className="sw-skip-link"
      >
        {language === 'ar' ? 'الانتقال إلى المحتوى' : language === 'fr' ? 'Aller au contenu' : 'Skip to content'}
      </a>

      <AppTopBar
        currentScreen={currentScreen}
        language={language}
        onOpenSettings={openSettings}
        onCloseSettings={closeSettings}
      />

      {/* Main Container */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-md sm:max-w-lg w-full mx-auto px-4 pt-1"
        style={{
          paddingBottom:
            currentScreen === 'settings'
              ? 'calc(2rem + env(safe-area-inset-bottom, 0px))'
              : 'calc(9rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
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
            onExpenseClick={(expense) => setViewingExpense(expense)}
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
          />
        )}

        {currentScreen === 'statistics' && (
          <StatisticsScreen
            expenses={expenses}
            budgets={budgets}
            currentMonthYear={currentMY}
            currencyCode={currencyCode}
            language={language}
            onNavigateToExpense={(expense) => setViewingExpense(expense)}
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
            onReviewSetup={() => setSetupMode('replay')}
          />
        )}
      </main>

      {/* Persistent Add Expense action is intentionally limited to Home and History. */}
      {(currentScreen === 'home' || currentScreen === 'history') && (
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

      {/* Settings is intentionally secondary; the four primary destinations own bottom navigation. */}
      {currentScreen !== 'settings' && (
        <Navigation
          currentScreen={currentScreen}
          language={language}
          onSelectScreen={selectPrimaryScreen}
        />
      )}

      <UndoSnackbar
        count={deleteUndoCount}
        language={language}
        onUndo={undoPendingExpenseDeletes}
        hasBottomNavigation={currentScreen !== 'settings'}
        hasFloatingAction={currentScreen === 'home' || currentScreen === 'history'}
        commitError={deleteCommitError}
        onDismissError={() => setDeleteCommitError(false)}
      />

      {/* Add / Edit Expense Modal Dialog */}
      {(showAddModal || editingExpense !== null) && (
        <AddEditExpenseModal
          isOpen={true}
          initialExpense={editingExpense}
          defaultDate={getDefaultTimestampForMonth(currentMY)}
          currencyCode={currencyCode}
          language={language}
          onSave={async (amount, description, category, date, note, attachmentChanges) => {
            if (editingExpense) {
              await handleUpdateExpense(
                editingExpense.id,
                amount,
                description,
                category,
                date,
                note,
                attachmentChanges
              );
            } else {
              await handleAddExpense(
                amount,
                description,
                category,
                date,
                note,
                attachmentChanges
              );
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

      {viewingExpense && (
        <ExpenseDetailModal
          expense={viewingExpense}
          currencyCode={currencyCode}
          language={language}
          onClose={() => setViewingExpense(null)}
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
