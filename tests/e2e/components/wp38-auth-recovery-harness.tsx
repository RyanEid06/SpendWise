import React from 'react';
import { createRoot } from 'react-dom/client';
import { LockScreen } from '../../../src/screens/LockScreen';
import { androidSecurityAdapter } from '../../../src/platform/android/AndroidSecurityAdapter';
import { securityStateStore } from '../../../src/security/SecurityStateStore';
import { secureSessionService } from '../../../src/security/SecureSessionService';

localStorage.setItem('spendwise_app_lock_enabled', 'true');
localStorage.setItem('spendwise_lock_timeout_seconds', '0');
securityStateStore.setNativeMigration('complete');
securityStateStore.setActiveKey({ version: 1, keyVersion: 1, authenticationRequired: true });
securityStateStore.setWrappedSecret('database', { format: 'spendwise-wrap-v1', keyVersion: 1, alias: 'fixture', purpose: 'database', nonceBase64: 'AA==', ciphertextBase64: 'AA==' });
const requests: ((value: any) => void)[] = [];
let acknowledge!: () => void;
const control = {
  reads: 0, cancellations: 0, unlocked: 0,
  calls: () => requests.length,
  acknowledge: () => acknowledge(),
  succeed: (index: number) => requests[index]({ status: 'success' }),
  snapshot: () => secureSessionService.getSnapshot(),
};
(window as any).__WP38_AUTH_RECOVERY__ = control;
// Mock only OS/Keystore transport. Session ownership, key generations,
// secret priming, lifecycle timeout and the React card are the real code.
androidSecurityAdapter.isAvailable = () => true;
androidSecurityAdapter.setPrivacyShield = async () => true;
androidSecurityAdapter.getCapabilities = async () => ({ platform: 'android', canAuthenticate: true, biometricStrongAvailable: true, deviceCredentialAvailable: true, combinedAuthenticatorsSupported: true, apiLevel: 35 });
androidSecurityAdapter.getKeyStatus = async () => ({ status: 'present', alias: 'fixture', keyVersion: 1, authenticationRequired: true });
androidSecurityAdapter.verifyKey = () => new Promise(resolve => { requests.push(resolve); });
androidSecurityAdapter.cancelAuthentication = () => {
  control.cancellations++;
  return new Promise(resolve => { acknowledge = () => resolve({ cancelled: true }); });
};
androidSecurityAdapter.unwrapSecret = async () => { control.reads++; return { status: 'success', secretBase64: 'AQIDBA==' }; };
await secureSessionService.initialize();
createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <LockScreen unlockMode="native" migrationIssue={null} language="en" onUnlock={async (_credential, method) => {
    const result = await secureSessionService.unlock(undefined, method);
    if (result.ok) control.unlocked++;
    return result;
  }} />
</React.StrictMode>);
