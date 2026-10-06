import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../../../src/index.css';
import type { Expense, Language, ThemeMode } from '../../../src/types';
import { SettingsOverview, type InlineSettingsSection } from '../../../src/features/settings/SettingsOverview';
import { overviewCopy } from '../../../src/features/settings/settingsCopy';
import { HistoryScreen } from '../../../src/screens/HistoryScreen';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { BackupPassphraseModal } from '../../../src/components/BackupPassphraseModal';
import { BackupV2ImportModal } from '../../../src/components/BackupV2ImportModal';
import { UndoSnackbar } from '../../../src/components/UndoSnackbar';
import { ExpenseDetailModal } from '../../../src/components/ExpenseDetailModal';
import { LockScreen } from '../../../src/screens/LockScreen';
import { StorageManager } from '../../../src/utils/storage';
import { TechnicalDiagnostics } from '../../../src/features/settings/TechnicalDiagnostics';

declare global {
  interface Window {
    __WP32_EVENTS__?: string[];
  }
}

window.__WP32_EVENTS__ = [];
const record = (value: string) => window.__WP32_EVENTS__?.push(value);
const params = new URLSearchParams(window.location.search);
const testCase = params.get('case') || 'settings';
const requestedLanguage = params.get('lang');
const initialLanguage: Language =
  requestedLanguage === 'fr' || requestedLanguage === 'ar' ? requestedLanguage : 'en';

const now = new Date(2026, 9, 1, 12, 0, 0).getTime();
const fixtures: Expense[] = [
  { id: 1, amount: 12.5, description: 'WP32 Coffee', category: 'Food & Dining', date: now, note: 'Rendered details fixture', createdAt: now },
  { id: 2, amount: 42, description: 'WP32 Transit', category: 'Transportation', date: now - 60_000, note: null, createdAt: now - 60_000 },
];

function applyLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}

const SettingsHarness = () => {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [theme, setTheme] = useState<ThemeMode>('LIGHT');
  const [currency, setCurrency] = useState('USD');
  const [expanded, setExpanded] = useState<InlineSettingsSection>(null);
  useEffect(() => {
    applyLanguage(language);
    document.documentElement.classList.toggle('dark', theme === 'DARK');
  }, [language, theme]);
  return (
    <SettingsOverview
      currentCurrencyCode={currency}
      currentThemeMode={theme}
      currentLanguage={language}
      totalExpensesCount={2}
      isAppLockEnabled={false}
      storageValue="0 photos"
      copy={overviewCopy[language]}
      expandedSection={expanded}
      onExpandedSectionChange={setExpanded}
      onThemeChange={setTheme}
      onLanguageChange={setLanguage}
      onCurrencyRequest={setCurrency}
      onOpenAppLock={() => record('app-lock')}
      onOpenStorageMedia={() => record('storage')}
      onOpenBackupRestore={() => record('backup')}
      onReviewSetup={() => record('setup')}
      onOpenTerms={() => record('terms')}
      onOpenPrivacy={() => record('privacy')}
      onClearData={() => record('clear')}
    />
  );
};

const HistoryHarness = () => {
  const [expenses, setExpenses] = useState(fixtures);
  const [detail, setDetail] = useState<Expense | null>(null);
  applyLanguage(initialLanguage);
  return (
    <>
      <HistoryScreen
        currentMonthYear={{ year: 2026, month: 10 }}
        expenses={expenses}
        currencyCode="USD"
        language={initialLanguage}
        onPreviousMonth={() => record('previous-month')}
        onNextMonth={() => record('next-month')}
        onExpenseClick={setDetail}
        onDeleteExpense={(expense) => {
          record('delete:' + expense.id);
          setExpenses((current) => current.filter((item) => item.id !== expense.id));
        }}
        onAddExpenseClick={() => record('add')}
      />
      {detail && (
        <ExpenseDetailModal
          expense={detail}
          currencyCode="USD"
          language={initialLanguage}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
};

const LockHarness = () => {
  applyLanguage(initialLanguage);
  const [attempt, setAttempt] = useState(0);
  const mode = testCase === 'lock-native' ? 'native' : 'web';
  return (
    <LockScreen
      unlockMode={mode}
      migrationIssue={null}
      language={initialLanguage}
      onUnlock={async (credential) => {
        setAttempt((value) => value + 1);
        record('unlock:' + mode + ':' + String(credential ?? 'native'));
        if (mode === 'native' && attempt === 0) {
          return { ok: false, code: 'cancelled' };
        }
        if (mode === 'web' && credential !== '2468') {
          return { ok: false, code: 'invalid_credential' };
        }
        return { ok: true, code: 'success' };
      }}
    />
  );
};

const DialogHarness = () => {
  applyLanguage(initialLanguage);
  if (testCase === 'confirm') {
    return (
      <ConfirmationModal
        isOpen={true}
        title="Erase fixture?"
        message="This is a destructive WP32 test."
        confirmText="Erase"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={() => record('confirm')}
        onCancel={() => record('cancel')}
      />
    );
  }
  if (testCase === 'backup-create') {
    return (
      <BackupPassphraseModal
        mode="create"
        language={initialLanguage}
        onSubmit={(value) => record('passphrase:' + value)}
        onClose={() => record('close')}
      />
    );
  }
  if (testCase === 'backup-restore-error') {
    return (
      <BackupPassphraseModal
        mode="restore"
        language={initialLanguage}
        externalError="Wrong passphrase fixture"
        onSubmit={(value) => record('restore:' + value)}
        onClose={() => record('close')}
      />
    );
  }
  if (testCase === 'backup-preview') {
    return (
      <BackupV2ImportModal
        version={3}
        language={initialLanguage}
        preview={{
          schemaVersion: 3,
          appVersion: '1.4.0',
          exportedAt: now,
          exportedAtFormatted: '2026-10-01 12:00:00',
          currencyCode: 'USD',
          totalExpenses: 2,
          totalBudgets: 1,
          totalAttachments: 2,
          mediaIncluded: true,
          mediaBytes: 2048,
        }}
        onConfirm={(replace) => record(replace ? 'replace' : 'merge')}
        onClose={() => record('close')}
      />
    );
  }
  if (testCase === 'undo') {
    return (
      <UndoSnackbar
        count={2}
        language={initialLanguage}
        onUndo={() => record('undo')}
        hasBottomNavigation={true}
        hasFloatingAction={true}
      />
    );
  }
  return null;
};

async function render() {
  applyLanguage(initialLanguage);
  await StorageManager.init();
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      {testCase === 'settings' ? <SettingsHarness /> :
       testCase === 'diagnostics' ? <TechnicalDiagnostics language={initialLanguage} /> :
       testCase === 'history' ? <HistoryHarness /> :
       testCase.startsWith('lock-') ? <LockHarness /> :
       <DialogHarness />}
    </React.StrictMode>
  );
}

void render();
