import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { LockScreen } from './screens/LockScreen';
import {
  secureSessionService,
  type SecureSessionActionResult,
} from './security/SecureSessionService';
import type { Language } from './types';
import { StorageManager } from './utils/storage';
import { TechnicalDiagnostics } from './features/settings/TechnicalDiagnostics';
import { measureDiagnostic } from './services/diagnostics/diagnostics';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

function renderApp(): void {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

function renderStorageFailure(): void {
  root.render(
    <div className="min-h-screen bg-slate-100 dark:bg-[#05080C] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#111928] p-6 shadow-sm space-y-3">
        <h1 className="text-lg font-extrabold">SpendWise could not safely open local data</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Your existing financial data was not deleted. Close and reopen the app. If this continues,
          keep the current installation in place so the stored data remains available for recovery.
        </p>
        <TechnicalDiagnostics language={bootstrapLanguage()} />
      </div>
    </div>
  );
}

function bootstrapLanguage(): Language {
  const value = localStorage.getItem('spendwise_language');
  return value === 'fr' || value === 'ar' ? value : 'en';
}

async function openProtectedStorage(): Promise<void> {
  await measureDiagnostic('storage.init', () => StorageManager.init());
  renderApp();
}

async function unlockAndOpen(
  credential?: string
): Promise<SecureSessionActionResult> {
  const result = await secureSessionService.unlock(credential);
  if (!result.ok) return result;

  // A v1.4 legacy PIN remains usable if Android key migration is cancelled.
  // That compatibility fallback cannot be used to open WP29 encrypted storage:
  // the Keystore-rooted key hierarchy must exist first. Keep the old database
  // untouched and let the user retry authentication instead.
  if (result.warning === 'migration_pending') {
    return {
      ok: false,
      code: 'migration_pending',
      detailCode: result.detailCode,
    };
  }

  try {
    await openProtectedStorage();
    return result;
  } catch {
    renderStorageFailure();
    return {
      ok: false,
      code: 'error',
      detailCode: 'LOCAL_DATA_OPEN_FAILED',
    };
  }
}

function renderBootstrapLock(): void {
  const snapshot = secureSessionService.getSnapshot();
  root.render(
    <LockScreen
      unlockMode={snapshot.unlockMode}
      migrationIssue={snapshot.migrationIssue}
      language={bootstrapLanguage()}
      onUnlock={unlockAndOpen}
    />
  );
}

async function bootstrap() {
  try {
    const security = await measureDiagnostic('security.init', () => secureSessionService.initialize());

    if (
      security.securityMode === 'native' &&
      security.appLockEnabled &&
      security.state === 'locked'
    ) {
      // Existing WP28-native users get the system prompt immediately. Legacy
      // PIN users intentionally fall through to the normal lock screen.
      if (security.unlockMode !== 'legacy-native-migration') {
        const unlocked = await unlockAndOpen();
        if (unlocked.ok) return;
      }
      renderBootstrapLock();
      return;
    }

    await openProtectedStorage();
  } catch {
    renderStorageFailure();
  }
}

void bootstrap();
