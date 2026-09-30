import { useCallback, useRef, useState } from 'react';
import { preferencesRepository } from '../../data/PreferencesRepository';
import { legacyAppLockService } from '../../features/security/LegacyAppLockService';
import { useAppLifecycle } from '../lifecycle/useAppLifecycle';

export function shouldLockAfterTimeout(
  backgroundedAt: number,
  resumedAt: number,
  timeoutSeconds: number
): boolean {
  if (backgroundedAt <= 0) return false;
  return (resumedAt - backgroundedAt) / 1000 >= timeoutSeconds;
}

interface UseAppLockLifecycleOptions {
  onBackground: () => void;
  onLock: () => void;
}

export function useAppLockLifecycle({
  onBackground,
  onLock,
}: UseAppLockLifecycleOptions) {
  const [appLockEnabled, setAppLockEnabledState] = useState<boolean>(() =>
    preferencesRepository.isAppLockEnabled()
  );
  const [lockTimeoutSeconds, setLockTimeoutSecondsState] = useState<number>(() =>
    preferencesRepository.getLockTimeoutSeconds()
  );
  const [isLocked, setIsLocked] = useState<boolean>(() =>
    preferencesRepository.isAppLockEnabled() && legacyAppLockService.hasPin()
  );
  const backgroundedAtRef = useRef(0);

  const handleBackground = useCallback(() => {
    onBackground();
    backgroundedAtRef.current = Date.now();
  }, [onBackground]);

  const handleForeground = useCallback(() => {
    const backgroundedAt = backgroundedAtRef.current;
    if (shouldLockAfterTimeout(backgroundedAt, Date.now(), lockTimeoutSeconds)) {
      onLock();
      setIsLocked(true);
    }
    backgroundedAtRef.current = 0;
  }, [lockTimeoutSeconds, onLock]);

  useAppLifecycle({
    enabled: appLockEnabled && legacyAppLockService.hasPin(),
    onBackground: handleBackground,
    onForeground: handleForeground,
  });

  const setAppLockEnabled = useCallback((enabled: boolean) => {
    if (enabled && !legacyAppLockService.hasPin()) return;

    preferencesRepository.setAppLockEnabled(enabled);
    setAppLockEnabledState(enabled);
    if (!enabled) {
      backgroundedAtRef.current = 0;
      setIsLocked(false);
    }
  }, []);

  const setLockTimeoutSeconds = useCallback((seconds: number) => {
    preferencesRepository.setLockTimeoutSeconds(seconds);
    setLockTimeoutSecondsState(seconds);
  }, []);

  const unlock = useCallback(() => {
    backgroundedAtRef.current = 0;
    setIsLocked(false);
  }, []);

  const refreshAfterSetup = useCallback(() => {
    setAppLockEnabledState(preferencesRepository.isAppLockEnabled());
    setLockTimeoutSecondsState(preferencesRepository.getLockTimeoutSeconds());
    setIsLocked(false);
  }, []);

  return {
    appLockEnabled,
    lockTimeoutSeconds,
    isLocked,
    storedPin: legacyAppLockService.readPin(),
    setAppLockEnabled,
    setLockTimeoutSeconds,
    unlock,
    refreshAfterSetup,
  };
}
