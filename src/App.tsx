import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Expense, MonthlyBudget, Screen, ThemeMode, CategorySpend, AiAnalysisResult } from './types';
import {
  currentMonthYear,
  getDisplayName,
  getEndOfMonthTimestamp,
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
  // Initialize storage
  useEffect(() => {
    StorageManager.init();
  }, []);

  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [currentMY, setCurrentMY] = useState(currentMonthYear());

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>(() => StorageManager.getExpenses());
  const [budgets, setBudgets] = useState<MonthlyBudget[]>(() => StorageManager.getBudgets());
  const [currencyCode, setCurrencyCodeState] = useState<string>(() => StorageManager.getCurrencyCode());
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => StorageManager.getThemeMode());

  // App Lock states
  const [appLockEnabled, setAppLockEnabledState] = useState<boolean>(() => StorageManager.isAppLockEnabled());
  const [lockTimeoutSeconds, setLockTimeoutSecondsState] = useState<number>(() => StorageManager.getLockTimeoutSeconds());
  const [isLocked, setIsLocked] = useState<boolean>(() => StorageManager.isAppLockEnabled());

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
  }, [currentMY]);

  // Handle Theme class on document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'DARK') {
      root.classList.add('dark');
    } else if (themeMode === 'LIGHT') {
      root.classList.remove('dark');
    } else {
      // SYSTEM
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [themeMode]);

  // Lock timeout on visibilitychange (when tab loses focus and returns)
  useEffect(() => {
    if (!appLockEnabled) return;
    let lastBlurTime = 0;

    const handleVisibility = () => {
      if (document.hidden) {
        lastBlurTime = Date.now();
      } else {
        if (lastBlurTime > 0) {
          const elapsedSec = (Date.now() - lastBlurTime) / 1000;
          if (elapsedSec >= lockTimeoutSeconds) {
            setIsLocked(true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [appLockEnabled, lockTimeoutSeconds]);

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

  const handleCurrencyChange = (code: string) => {
    StorageManager.setCurrencyCode(code);
    setCurrencyCodeState(code);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    StorageManager.setThemeMode(mode);
    setThemeModeState(mode);
  };

  const handleAppLockToggle = (enabled: boolean) => {
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
      const prompt = analyzer.buildGeminiPrompt(summary, currencyCode);

      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          monthKey: getMonthKey(currentMY),
        }),
      });

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
      setAiNotice(
        `Using local statistical analysis (${err.message || 'Gemini service offline'}).`
      );
    } finally {
      setIsAiLoading(false);
    }
  }, [expenses, monthlyExpenses, currentMY, currencyCode]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* App Lock Screen Overlay */}
      {isLocked && (
        <LockScreen
          storedPin={StorageManager.getLockPin()}
          onUnlock={() => setIsLocked(false)}
        />
      )}

      {/* Android Top Status Bar (Matching screenshot: 6:24, wifi, battery) */}
      <header className="sticky top-0 z-40 bg-[#0B0F19] pt-2 px-6 pb-1">
        <div className="max-w-md mx-auto flex items-center justify-between text-xs text-slate-300 font-semibold tracking-tight">
          <span>6:24</span>
          <div className="flex items-center space-x-2">
            {/* WiFi */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0 0 12 4z"/>
            </svg>
            {/* Signal */}
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M2 22h20V2L2 22z"/>
            </svg>
            {/* Battery */}
            <svg className="w-4 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M16 4h-2V2h-4v2H8C6.9 4 6 4.9 6 6v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-1 pb-24">
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
            totalExpensesCount={expenses.length}
            isAppLockEnabled={appLockEnabled}
            lockTimeoutSeconds={lockTimeoutSeconds}
            onAppLockToggle={handleAppLockToggle}
            onLockTimeoutChange={handleLockTimeoutChange}
            onCurrencyChange={handleCurrencyChange}
            onThemeChange={handleThemeChange}
            onClearAllData={handleClearAllData}
            onBackupRestored={handleBackupRestored}
          />
        )}
      </main>

      {/* Floating Action Button (rounded green squircle with black plus like screenshot) */}
      {currentScreen !== 'settings' && (
        <button
          onClick={() => {
            setEditingExpense(null);
            setShowAddModal(true);
          }}
          className="fixed bottom-24 right-5 z-30 w-12 h-12 rounded-2xl bg-[#34D399] hover:bg-[#10B981] text-slate-950 shadow-lg shadow-emerald-500/25 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Add Expense"
        >
          <Plus className="w-6 h-6 stroke-[2.75]" />
        </button>
      )}

      {/* Bottom Navigation */}
      <Navigation currentScreen={currentScreen} onSelectScreen={setCurrentScreen} />

      {/* Add / Edit Expense Modal Dialog */}
      {(showAddModal || editingExpense !== null) && (
        <AddEditExpenseModal
          isOpen={true}
          initialExpense={editingExpense}
          defaultDate={Date.now()}
          currencyCode={currencyCode}
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
          onSave={handleSetStartingMoney}
          onClose={() => setShowBudgetModal(false)}
        />
      )}
    </div>
  );
};
