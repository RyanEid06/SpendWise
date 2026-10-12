import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import { SettingsScreen } from '../../../src/screens/SettingsScreen';
import { useExpenseLedger } from '../../../src/app/hooks/useExpenseLedger';
import { useThemeLanguage } from '../../../src/app/hooks/useThemeLanguage';
import { useAiAnalysis } from '../../../src/app/hooks/useAiAnalysis';
import { StorageManager } from '../../../src/utils/storage';
import { LocalDataStore, LocalDataStoreImpl } from '../../../src/utils/localDataStore';
import type { FinancialState } from '../../../src/utils/financialState';
import { mediaService } from '../../../src/services/MediaService';
import type { Language } from '../../../src/types';

declare global {
  interface Window {
    __WP37_RECOVERY_FILE__?: { name: string; mimeType: string; base64: string };
    __WP37_REOPEN_RECOVERY__?: () => Promise<{ count: number; currency: string; theme: string; language: string }>;
  }
}
const params = new URLSearchParams(location.search);
const format = Number(params.get('format') || 1);
const initialLanguage = (params.get('lang') || 'en') as Language;
const monthYear = { year: 2026, month: 9 };
const source: FinancialState = {
  expenses: [1, 2].map(id => ({ id, amount: 37, description: 'WP37 persisted expense ' + id, category: 'Food', date: 1_780_000_000_000 + id, createdAt: 1_780_000_000_000 + id, note: null })),
  budgets: [{ monthKey: '2026-09', startingAmount: 370, updatedAt: 1_780_000_000_000 }], attachments: [], currencyCode: 'EUR',
};

function RecoveryHarness() {
  const ledger = useExpenseLedger();
  const preferences = useThemeLanguage();
  const ai = useAiAnalysis({ expenses: ledger.expenses, monthlyExpenses: ledger.expenses, currentMonthYear: monthYear, currencyCode: ledger.currencyCode, language: preferences.language });
  const [reconciliations, setReconciliations] = useState(0);
  return <main id="main-content" tabIndex={-1} className="max-w-md mx-auto p-4">
    <span data-testid="rendered-ledger">{ledger.expenses.length}/{ledger.budgets.length}/{ledger.currencyCode}/{preferences.themeMode}/{preferences.language}</span>
    <span data-testid="reconciliations">{reconciliations}</span>
    <span data-testid="cached-overview">{ai.result?.spendingOverview || 'No cached insights'}</span>
    <SettingsScreen
      currentCurrencyCode={ledger.currencyCode} currentThemeMode={preferences.themeMode} currentLanguage={preferences.language}
      totalExpensesCount={ledger.expenses.length} totalBudgetsCount={ledger.budgets.length}
      isAppLockEnabled={false} lockTimeoutSeconds={60} securityMode={params.has('authLimit') ? 'native' : 'web'} hasWebPin={false} migrationIssue={null}
      onAppLockToggle={async () => params.has('authLimit') ? { ok: false, code: 'unavailable', detailCode: 'CREDENTIAL_IMMEDIATE_LOCK_UNSUPPORTED' } : { ok: true, code: 'success' }}
      onLockTimeoutChange={async () => ({ ok: true, code: 'success' })} onSetWebPin={async () => ({ ok: true, code: 'success' })}
      onRequireFreshAuthentication={async () => ({ ok: true, code: 'success' })}
      onCurrencyChange={() => {}} onThemeChange={preferences.setThemeMode} onLanguageChange={preferences.setLanguage}
      onClearAllData={() => {}} onReviewSetup={() => {}}
      onBackupRestored={() => {
        // These are the real hooks refreshed by AppShell's callback.
        ledger.refreshFromStorage();
        if (params.has('refreshFailure')) throw new Error('WP37_PREFERENCE_READBACK_FAILURE');
        preferences.refreshFromStorage();
        ai.reloadCached();
        setReconciliations(value => value + 1);
      }}
    />
  </main>;
}

void (async () => {
  await StorageManager.init();
  await LocalDataStore.replaceState(source);
  StorageManager.setThemeMode('DARK');
  StorageManager.setLanguage('ar');
  const data = format === 1 ? new Blob([JSON.stringify(StorageManager.createBackupJson())], { type: 'application/json' })
    : format === 2 ? await StorageManager.createBackupV2(false)
      : await StorageManager.createBackupV3(false, 'wp37 synthetic recovery password');
  let binary = '';
  for (const byte of new Uint8Array(await data.arrayBuffer())) binary += String.fromCharCode(byte);
  window.__WP37_RECOVERY_FILE__ = { name: `wp37-recovery.${format === 1 ? 'json' : format === 2 ? 'zip' : 'swb3'}`, mimeType: data.type, base64: btoa(binary) };
  await LocalDataStore.replaceState({ expenses: [{ ...source.expenses[0], id: 9, amount: 99 }], budgets: [], attachments: [], currencyCode: 'USD' });
  StorageManager.setThemeMode('LIGHT');
  StorageManager.setLanguage(initialLanguage);
  StorageManager.cacheAnalysis({ timestamp: 1_780_000_000_000, analyzedMonthKey: '2026-09', isAiGenerated: false, spendingOverview: 'Old ledger cached claim', historyContext: '', biggestChanges: [], unusualExpenses: [], recurringSpending: [], areasToReview: [] });

  // Real financial persistence commits; its compensation silently fails.
  const replaceState = LocalDataStore.replaceState.bind(LocalDataStore);
  LocalDataStore.replaceState = async state => { if (state.currencyCode !== 'USD') await replaceState(state); };
  // Theme reaches DARK. Language persistence fails, and old LIGHT cannot be
  // written during compensation. No BackupService results are mocked.
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    if (key === 'spendwise_language' && value === 'ar') throw new Error('WP37_PREFERENCE_WRITE_FAILURE');
    if (key === 'spendwise_theme' && value === 'LIGHT') throw new Error('WP37_PREFERENCE_ROLLBACK_FAILURE');
    return setItem.call(this, key, value);
  };
  if (params.has('refreshFailure')) mediaService.getStorageSummary = async () => { throw new Error('WP37_MEDIA_READBACK_FAILURE'); };
  window.__WP37_REOPEN_RECOVERY__ = async () => {
    const reopened = new LocalDataStoreImpl();
    await reopened.init(localStorage);
    return { count: reopened.getExpenses().length, currency: reopened.getCurrencyCode(), theme: StorageManager.getThemeMode(), language: StorageManager.getLanguage() };
  };
  createRoot(document.getElementById('root')!).render(<RecoveryHarness />);
})();
