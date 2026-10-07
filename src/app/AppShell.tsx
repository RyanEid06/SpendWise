import React, { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Language } from '../types';
import {
  currentMonthYear,
  getDefaultTimestampForMonth,
  getDisplayName,
  nextMonth,
  previousMonth,
} from '../utils/date';
import { SetupState } from '../utils/setupState';
import { Navigation } from '../components/Navigation';
import { RetainedScreen } from '../components/RetainedScreen';
import { useTabScroll } from './navigation/useTabScroll';
import { ViewportPortal } from '../components/ViewportPortal';
import { AppTopBar } from '../components/AppTopBar';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { AddEditExpenseModal } from '../components/AddEditExpenseModal';
import { ExpenseDetailModal } from '../components/ExpenseDetailModal';
import { SetBudgetModal } from '../components/SetBudgetModal';
import { DashboardScreen } from '../screens/DashboardScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { AiInsightsScreen } from '../screens/AiInsightsScreen';
import { StatisticsScreen } from '../screens/StatisticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LockScreen } from '../screens/LockScreen';
import { SetupWizardScreen } from '../screens/SetupWizardScreen';
import { useAppNavigation } from './navigation/useAppNavigation';
import { useAndroidBack } from './navigation/useAndroidBack';
import { useAppOverlays } from './hooks/useAppOverlays';
import { useThemeLanguage } from './hooks/useThemeLanguage';
import { useExpenseLedger } from './hooks/useExpenseLedger';
import { useExpenseDeleteUndo } from './hooks/useExpenseDeleteUndo';
import { useAiAnalysis } from './hooks/useAiAnalysis';
import { useAppLockLifecycle } from './hooks/useAppLockLifecycle';
import { selectMonthlyLedger } from './selectors/monthlyLedger';
import type { StartupHomeFrameTiming } from './startup/StartupHomeFrameTiming';
import { useStartupHomeFrameTiming } from './startup/useStartupHomeFrameTiming';
import { useExpenseDraftRecovery } from './hooks/useExpenseDraftRecovery';
import { SecureStartupScreen } from '../screens/SecureStartupScreen';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface AppShellProps {
  startupHomeFrameTiming?: StartupHomeFrameTiming;
}

export const AppShell: React.FC<AppShellProps> = ({ startupHomeFrameTiming }) => {
  const navigation = useAppNavigation();
  useTabScroll(navigation.currentScreen);
  const overlays = useAppOverlays();
  const preferences = useThemeLanguage();
  const ledger = useExpenseLedger();
  const [currentMY, setCurrentMY] = useState(currentMonthYear());
  const [setupMode, setSetupMode] = useState<'first-run' | 'replay' | null>(() =>
    SetupState.shouldShowFirstRun() ? 'first-run' : null
  );

  const monthly = useMemo(
    () => selectMonthlyLedger(ledger.expenses, ledger.budgets, currentMY),
    [currentMY, ledger.budgets, ledger.expenses]
  );

  const ai = useAiAnalysis({
    expenses: ledger.expenses,
    monthlyExpenses: monthly.monthlyExpenses,
    currentMonthYear: currentMY,
    currencyCode: ledger.currencyCode,
    language: preferences.language,
  });

  const deleteUndo = useExpenseDeleteUndo({
    expenses: ledger.expenses,
    setExpenses: ledger.setExpenses,
    onAnalysisInvalidated: ai.clearResult,
    onExpenseStaged: overlays.closeViewingIfDeleted,
  });

  const appLock = useAppLockLifecycle({
    onBackground: deleteUndo.undoPending,
    onLock: overlays.closeForLock,
  });

  const recovery = useExpenseDraftRecovery({
    enabled: !appLock.isLocked && setupMode === null,
    expenses: ledger.expenses, currencyCode: ledger.currencyCode,
    openAdd: overlays.openAddExpense, openEdit: overlays.openEditExpense,
  });
  const [recoveryActionError, setRecoveryActionError] = useState(false);

  useStartupHomeFrameTiming(
    startupHomeFrameTiming,
    setupMode === null && !appLock.isLocked && navigation.currentScreen === 'home'
  );

  const goHome = useCallback(() => {
    navigation.selectPrimaryScreen('home');
  }, [navigation.selectPrimaryScreen]);

  useAndroidBack({
    currentScreen: navigation.currentScreen,
    expenseEditorOpen: overlays.expenseEditorOpen,
    budgetModalOpen: overlays.showBudgetModal,
    closeExpenseEditor: overlays.closeExpenseEditor,
    closeBudgetModal: overlays.closeBudgetModal,
    closeSettings: navigation.closeSettings,
    goHome,
  });

  const handleCurrencyChange = useCallback(async (
    code: string,
    targetUnitsPerSourceUnit?: number
  ) => {
    deleteUndo.undoPending();
    await ledger.changeCurrency(code, targetUnitsPerSourceUnit);
    ai.clearResult();
  }, [ai.clearResult, deleteUndo.undoPending, ledger.changeCurrency]);

  const handleLanguageChange = useCallback((language: Language) => {
    preferences.setLanguage(language);
    ai.clearResult();
  }, [ai.clearResult, preferences.setLanguage]);

  const handleClearAllData = useCallback(async () => {
    deleteUndo.disposePending();
    deleteUndo.dismissCommitError();
    await ledger.clearAllData();
    ai.reset();
    overlays.closeExpenseDetail();
  }, [
    ai.reset,
    deleteUndo.dismissCommitError,
    deleteUndo.disposePending,
    ledger.clearAllData,
    overlays.closeExpenseDetail,
  ]);

  const handleBackupRestored = useCallback(() => {
    deleteUndo.disposePending();
    deleteUndo.dismissCommitError();
    overlays.closeExpenseDetail();
    ledger.refreshFromStorage();
    preferences.refreshFromStorage();
    ai.reloadCached();
  }, [
    ai.reloadCached,
    deleteUndo.dismissCommitError,
    deleteUndo.disposePending,
    ledger.refreshFromStorage,
    overlays.closeExpenseDetail,
    preferences.refreshFromStorage,
  ]);

  if (setupMode) {
    return (
      <SetupWizardScreen
        mode={setupMode}
        language={preferences.language}
        currencyCode={ledger.currencyCode}
        themeMode={preferences.themeMode}
        totalExpensesCount={ledger.expenses.length}
        totalBudgetsCount={ledger.budgets.length}
        appLockEnabled={appLock.appLockEnabled}
        onLanguageChange={handleLanguageChange}
        onCurrencyChange={handleCurrencyChange}
        onThemeChange={preferences.setThemeMode}
        onAppLockConfigured={appLock.configureFromSetup}
        onComplete={() => setSetupMode(null)}
        onCancel={setupMode === 'replay' ? () => setSetupMode(null) : undefined}
      />
    );
  }

  if (appLock.isLocked) {
    return (
      <LockScreen
        unlockMode={appLock.unlockMode}
        migrationIssue={appLock.migrationIssue}
        language={preferences.language}
        onUnlock={appLock.unlock}
        autoUnlock={appLock.securityMode === 'native'}
      />
    );
  }

  if (!recovery.ready) return <SecureStartupScreen language={preferences.language} />;

  if (recovery.issue) {
    const fr = preferences.language === 'fr', ar = preferences.language === 'ar';
    return <ConfirmationModal isOpen title={ar ? 'مصروف غير مكتمل' : fr ? 'Dépense inachevée' : 'Unfinished expense'}
      message={recoveryActionError
        ? (ar ? 'تعذر حذف العمل. حاول مجدداً.' : fr ? 'Suppression impossible. Réessayez.' : 'Could not discard unfinished work. Retry.')
        : recovery.issue === 'missing-expense'
          ? (ar ? 'المصروف الأصلي لم يعد موجوداً. متابعة كمصروف جديد أو تجاهل العمل؟' : fr ? 'La dépense d’origine n’existe plus. Continuer comme nouvelle dépense ou supprimer ?' : 'The original expense no longer exists. Continue as a new expense or discard unfinished work?')
          : (ar ? 'تعذر استعادة العمل بأمان. حاول مجدداً أو تجاهل العمل.' : fr ? 'Récupération sûre impossible. Réessayez ou supprimez le travail.' : 'Unfinished work could not be recovered safely. Retry or discard it.')}
      confirmText={recovery.issue === 'missing-expense' ? (ar ? 'متابعة' : fr ? 'Continuer' : 'Continue') : (ar ? 'إعادة المحاولة' : fr ? 'Réessayer' : 'Retry')}
      cancelText={ar ? 'تجاهل' : fr ? 'Supprimer' : 'Discard'}
      onConfirm={recovery.issue === 'missing-expense' ? recovery.continueAsNew : recovery.retry}
      onCancel={() => { void recovery.discard().catch(() => setRecoveryActionError(true)); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#05080C] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors duration-200">
      <a href="#main-content" className="sw-skip-link">
        {preferences.language === 'ar'
          ? 'الانتقال إلى المحتوى'
          : preferences.language === 'fr'
            ? 'Aller au contenu'
            : 'Skip to content'}
      </a>

      <AppTopBar
        currentScreen={navigation.currentScreen}
        language={preferences.language}
        onOpenSettings={navigation.openSettings}
        onCloseSettings={navigation.closeSettings}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 max-w-md sm:max-w-lg w-full mx-auto px-4 pt-1"
        style={{
          paddingBottom:
            navigation.currentScreen === 'settings'
              ? 'calc(2rem + env(safe-area-inset-bottom, 0px))'
              : 'calc(9rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <RetainedScreen active={navigation.currentScreen === 'home'}>
          <DashboardScreen
            currentMonthYear={currentMY}
            startingMoney={monthly.startingMoney}
            isBudgetSet={monthly.isBudgetSet}
            totalSpent={monthly.totalSpent}
            remainingMoney={monthly.remainingMoney}
            progress={monthly.progress}
            topExpenses={monthly.topExpenses}
            categoryBreakdown={monthly.categoryBreakdown}
            currencyCode={ledger.currencyCode}
            language={preferences.language}
            onPreviousMonth={() => setCurrentMY((previous) => previousMonth(previous))}
            onNextMonth={() => setCurrentMY((previous) => nextMonth(previous))}
            onSetBudgetClick={overlays.openBudgetModal}
            onExpenseClick={overlays.openEditExpense}
          />
        </RetainedScreen>

        <RetainedScreen active={navigation.currentScreen === 'history'}>
          <HistoryScreen
            currentMonthYear={currentMY}
            expenses={monthly.monthlyExpenses}
            currencyCode={ledger.currencyCode}
            language={preferences.language}
            onPreviousMonth={() => setCurrentMY((previous) => previousMonth(previous))}
            onNextMonth={() => setCurrentMY((previous) => nextMonth(previous))}
            onExpenseClick={overlays.openExpenseDetail}
            onDeleteExpense={(expense) => { deleteUndo.stageDelete(expense); }}
            onAddExpenseClick={overlays.openAddExpense}
          />
        </RetainedScreen>

        <RetainedScreen active={navigation.currentScreen === 'insights'}>
          <AiInsightsScreen
            currentMonthYear={currentMY}
            analysisResult={ai.result}
            isLoading={ai.isLoading}
            error={ai.error}
            notice={ai.notice}
            language={preferences.language}
            onPreviousMonth={() => setCurrentMY((previous) => previousMonth(previous))}
            onNextMonth={() => setCurrentMY((previous) => nextMonth(previous))}
            onAnalyzeClick={ai.analyze}
          />
        </RetainedScreen>

        <RetainedScreen active={navigation.currentScreen === 'statistics'}>
          <StatisticsScreen
            expenses={ledger.expenses}
            budgets={ledger.budgets}
            currentMonthYear={currentMY}
            currencyCode={ledger.currencyCode}
            language={preferences.language}
            onNavigateToExpense={overlays.openExpenseDetail}
          />
        </RetainedScreen>

        {navigation.currentScreen === 'settings' && (
          <SettingsScreen
            currentCurrencyCode={ledger.currencyCode}
            currentThemeMode={preferences.themeMode}
            currentLanguage={preferences.language}
            totalExpensesCount={ledger.expenses.length}
            totalBudgetsCount={ledger.budgets.length}
            isAppLockEnabled={appLock.appLockEnabled}
            lockTimeoutSeconds={appLock.lockTimeoutSeconds}
            securityMode={appLock.securityMode}
            hasWebPin={appLock.hasWebPin}
            migrationIssue={appLock.migrationIssue}
            onAppLockToggle={appLock.setAppLockEnabled}
            onLockTimeoutChange={appLock.setLockTimeoutSeconds}
            onSetWebPin={appLock.setWebPin}
            onRequireFreshAuthentication={appLock.requireFreshAuthentication}
            onCurrencyChange={handleCurrencyChange}
            onThemeChange={preferences.setThemeMode}
            onLanguageChange={handleLanguageChange}
            onClearAllData={handleClearAllData}
            onBackupRestored={handleBackupRestored}
            onReviewSetup={() => setSetupMode('replay')}
          />
        )}
      </main>

      {/* Viewport controls belong outside the scrolling app container. Android
          WebView can omit its fixed descendants from native accessibility after
          Settings remounts them, even though their pixels remain visible. */}
      <ViewportPortal>
        {(navigation.currentScreen === 'home' || navigation.currentScreen === 'history') && (
          <button
            onClick={overlays.openAddExpense}
            className="fixed right-4 rtl:right-auto rtl:left-4 z-30 min-w-[52px] min-h-[52px] w-13 h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
            aria-label={
              preferences.language === 'ar'
                ? 'إضافة مصروف'
                : preferences.language === 'fr'
                  ? 'Ajouter une dépense'
                  : 'Add Expense'
            }
          >
            <Plus className="w-6 h-6 stroke-[2.75]" />
          </button>
        )}

        {navigation.currentScreen !== 'settings' && (
          <Navigation
            currentScreen={navigation.currentScreen}
            language={preferences.language}
            onSelectScreen={navigation.selectPrimaryScreen}
          />
        )}
      </ViewportPortal>

      <UndoSnackbar
        count={deleteUndo.pendingCount}
        language={preferences.language}
        onUndo={deleteUndo.undoPending}
        hasBottomNavigation={navigation.currentScreen !== 'settings'}
        hasFloatingAction={navigation.currentScreen === 'home' || navigation.currentScreen === 'history'}
        commitError={deleteUndo.commitError}
        onDismissError={deleteUndo.dismissCommitError}
      />

      {(overlays.showAddModal || overlays.editingExpense !== null) && (
        <AddEditExpenseModal
          recoveryDraft={recovery.draft}
          isOpen={true}
          initialExpense={overlays.editingExpense}
          defaultDate={getDefaultTimestampForMonth(currentMY)}
          currencyCode={ledger.currencyCode}
          language={preferences.language}
          onSave={async (amount, description, category, date, note, attachmentChanges) => {
            const input = { amount, description, category, date, note, attachmentChanges };
            if (overlays.editingExpense) {
              await ledger.updateExpense(
                overlays.editingExpense.id,
                input,
                deleteUndo.getPendingExpenseIds()
              );
            } else {
              await ledger.addExpense(input, deleteUndo.getPendingExpenseIds());
            }
            overlays.closeExpenseEditor();
            recovery.closed();
          }}
          onClose={() => { overlays.closeExpenseEditor(); recovery.closed(); }}
        />
      )}

      {overlays.viewingExpense && (
        <ExpenseDetailModal
          expense={overlays.viewingExpense}
          currencyCode={ledger.currencyCode}
          language={preferences.language}
          onClose={overlays.closeExpenseDetail}
        />
      )}

      {overlays.showBudgetModal && (
        <SetBudgetModal
          isOpen={true}
          monthName={getDisplayName(currentMY)}
          currentStartingAmount={monthly.startingMoney}
          currencyCode={ledger.currencyCode}
          language={preferences.language}
          onSave={(amount) => ledger.setStartingMoney(currentMY, amount)}
          onClose={overlays.closeBudgetModal}
        />
      )}
    </div>
  );
};
