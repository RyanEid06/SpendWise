import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { LockScreen } from './screens/LockScreen';
import { SecureStartupScreen } from './screens/SecureStartupScreen';
import {
  secureSessionService,
  type SecureSessionActionResult,
} from './security/SecureSessionService';
import type { Language, ThemeMode } from './types';
import { StorageManager } from './utils/storage';
import { TechnicalDiagnostics } from './features/settings/TechnicalDiagnostics';
import { measureDiagnostic } from './services/diagnostics/diagnostics';
import { androidSecurityAdapter } from './platform/android/AndroidSecurityAdapter';
import { StartupHomeFrameTiming } from './app/startup/StartupHomeFrameTiming';
import './index.css';

function bootstrapLanguage(): Language {
  try {
    const value = localStorage.getItem('spendwise_language');
    return value === 'fr' || value === 'ar' ? value : 'en';
  } catch {
    return 'en';
  }
}

function bootstrapTheme(): ThemeMode {
  try {
    const value = localStorage.getItem('spendwise_theme');
    return value === 'LIGHT' || value === 'DARK' ? value : 'SYSTEM';
  } catch {
    return 'SYSTEM';
  }
}

function applyBootstrapAppearance(): void {
  const language = bootstrapLanguage();
  const theme = bootstrapTheme();
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const dark = theme === 'DARK' || (theme === 'SYSTEM' && systemDark);
  const html = document.documentElement;
  html.classList.toggle('dark', dark);
  html.setAttribute('lang', language);
  html.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
}

applyBootstrapAppearance();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

function renderApp(homeFrameTiming?: StartupHomeFrameTiming): void {
  root.render(
    <React.StrictMode>
      <App startupHomeFrameTiming={homeFrameTiming} />
    </React.StrictMode>
  );
}

function renderSecureStartup(): void {
  root.render(<SecureStartupScreen language={bootstrapLanguage()} />);
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

async function openProtectedStorage(homeFrameTiming?: StartupHomeFrameTiming): Promise<void> {
  await measureDiagnostic('startup.secure_init', () =>
    measureDiagnostic('storage.init', () => StorageManager.init())
  );
  renderApp(homeFrameTiming);
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

  const authSucceededAtElapsedRealtimeMs = result.authSucceededAtElapsedRealtimeMs;
  // Native authentication and Home sampling use the same Android monotonic
  // clock. Older bridges can omit timing without blocking a successful unlock.
  const homeFrameTiming = authSucceededAtElapsedRealtimeMs === undefined
    ? undefined
    : new StartupHomeFrameTiming(() =>
        androidSecurityAdapter.elapsedSinceAuthentication(authSucceededAtElapsedRealtimeMs)
      );
  try {
    await openProtectedStorage(homeFrameTiming);
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

function renderBootstrapLock(autoUnlock = false): void {
  const snapshot = secureSessionService.getSnapshot();
  root.render(
    <LockScreen
      unlockMode={snapshot.unlockMode}
      migrationIssue={snapshot.migrationIssue}
      language={bootstrapLanguage()}
      onUnlock={unlockAndOpen}
      autoUnlock={autoUnlock}
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
      // Paint the secure SpendWise surface first, then let LockScreen start one
      // system authentication attempt. Cancellation leaves the surface intact
      // with an explicit Unlock action; it never auto-retries in a loop.
      renderBootstrapLock(security.unlockMode !== 'legacy-native-migration');
      return;
    }

    if (security.appLockEnabled && security.state === 'locked') {
      renderBootstrapLock(false);
      return;
    }

    await openProtectedStorage();
  } catch {
    renderStorageFailure();
  }
}

// Render privacy-safe branded UI synchronously so WebView/native startup never
// waits on Keystore, biometric or SQLCipher work with an empty black surface.
renderSecureStartup();
void bootstrap();
