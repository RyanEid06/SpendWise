import { useCallback, useEffect, useState } from 'react';
import type { AuthenticationMethod } from '../../security/authenticationCopy';
import {
  SecureSessionActionResult,
  SensitiveAuthenticationReason,
  secureSessionService,
  shouldLockAfterTimeout,
} from '../../security/SecureSessionService';
import { securityLifecycle, startSecurityLifecycle } from '../../security/SecurityLifecycleCoordinator';

export { shouldLockAfterTimeout };

interface UseAppLockLifecycleOptions {
  onBackground: () => void;
  onLock: () => void;
}

export function useAppLockLifecycle({
  onBackground,
  onLock,
}: UseAppLockLifecycleOptions) {
  const [snapshot, setSnapshot] = useState(() => secureSessionService.getSnapshot());

  const refresh = useCallback(() => {
    setSnapshot(secureSessionService.getSnapshot());
  }, []);

  useEffect(() => {
    let active = true;
    void secureSessionService.initialize().then((next) => {
      if (active) setSnapshot(next);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = securityLifecycle.subscribe({
      onBackground,
      onChange: locked => {
        if (locked) onLock();
        refresh();
      },
    });
    void startSecurityLifecycle().catch(() => {
      secureSessionService.lock();
      onLock();
      refresh();
    });
    return unsubscribe;
  }, [onBackground, onLock, refresh]);

  const unlock = useCallback(
    async (credential?: string, method?: AuthenticationMethod): Promise<SecureSessionActionResult> => {
      const result = await secureSessionService.unlock(credential, method);
      refresh();
      return result;
    },
    [refresh]
  );

  const setAppLockEnabled = useCallback(
    async (enabled: boolean): Promise<SecureSessionActionResult> => {
      const result = await secureSessionService.setAppLockEnabled(enabled);
      refresh();
      return result;
    },
    [refresh]
  );

  const setLockTimeoutSeconds = useCallback(
    async (seconds: number): Promise<SecureSessionActionResult> => {
      const result = await secureSessionService.setLockTimeoutSeconds(seconds);
      refresh();
      return result;
    },
    [refresh]
  );

  const configureFromSetup = useCallback(
    async (pin?: string): Promise<SecureSessionActionResult> => {
      const result = await secureSessionService.configureFromSetup(pin);
      refresh();
      return result;
    },
    [refresh]
  );

  const setWebPin = useCallback(
    async (pin: string): Promise<SecureSessionActionResult> => {
      const result = await secureSessionService.setWebPin(pin);
      refresh();
      return result;
    },
    [refresh]
  );

  const requireFreshAuthentication = useCallback(
    async (
      reason: SensitiveAuthenticationReason,
      credential?: string
    ): Promise<SecureSessionActionResult> => {
      const result = await secureSessionService.requireFreshAuthentication(
        reason,
        credential
      );
      refresh();
      return result;
    },
    [refresh]
  );

  return {
    appLockEnabled: snapshot.appLockEnabled,
    lockTimeoutSeconds: snapshot.lockTimeoutSeconds,
    isLocked: snapshot.state === 'locked',
    securityMode: snapshot.securityMode,
    unlockMode: snapshot.unlockMode,
    hasWebPin: snapshot.hasWebPin,
    migrationIssue: snapshot.migrationIssue,
    setAppLockEnabled,
    setLockTimeoutSeconds,
    setWebPin,
    unlock,
    configureFromSetup,
    requireFreshAuthentication,
  };
}
