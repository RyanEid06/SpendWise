import React from 'react';
import { createRoot } from 'react-dom/client';
import { LockScreen } from '../../../src/screens/LockScreen';
import { securityLifecycle } from '../../../src/security/SecurityLifecycleCoordinator';
import { secureSessionService } from '../../../src/security/SecureSessionService';

localStorage.setItem('spendwise_app_lock_enabled', 'true');
localStorage.setItem('spendwise_lock_timeout_seconds', '0');
const root = createRoot(document.getElementById('root')!);
const control = {
  ready: false,
  calls: 0,
  foreground: () => securityLifecycle.foreground(),
  cancel: () => secureSessionService.lock(),
  unmount: () => root.unmount(),
};
(window as any).__WP37_AUTH__ = control;
function AuthHarness() {
  React.useEffect(() => { control.ready = true; }, []);
  return <LockScreen unlockMode="native" migrationIssue={null} language="en" autoUnlock
    onUnlock={async () => { control.calls++; return { ok: false, code: 'cancelled' }; }} />;
}
securityLifecycle.background();
// Match the real sequence: the background queue locks, then AppShell mounts
// the secure presentation while Android's Activity remains stopped.
void Promise.resolve().then(() => Promise.resolve()).then(() => {
  root.render(<React.StrictMode><AuthHarness /></React.StrictMode>);
});
