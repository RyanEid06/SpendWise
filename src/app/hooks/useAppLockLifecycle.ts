import { useCallback, useRef, useState } from 'react';
import { StorageManager } from '../../utils/storage';
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
    StorageManager.isAppLockEnabled()
  );
  const [lockTimeoutSeconds, setLockTimeoutSecondsState] = useState<number>(() =>
    StorageManager.getLockTimeoutSeconds()
  );
  const [isLocked, setIsLocked] = useState<boolean>(() =>
    StorageManager.isAppLockEnabled() && StorageManager.hasLockPin()
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
    enabled: appLockEnabled && StorageManager.hasLockPin(),
    onBackground: handleBackground,
    onForeground: handleForeground,
  });

  const setAppLockEnabled = useCallback((enabled: boolean) => {
    if (enabled && !StorageManager.hasLockPin()) return;

    StorageManager.setAppLockEnabled(enabled);
    setAppLockEnabledState(enabled);
    if (!enabled) {
      backgroundedAtRef.current = 0;
      setIsLocked(false);
    }
  }, []);

  const setLockTimeoutSeconds = useCallback((seconds: number) => {
    StorageManager.setLockTimeoutSeconds(seconds);
    setLockTimeoutSecondsState(seconds);
  }, []);

  const unlock = useCallback(() => {
    backgroundedAtRef.current = 0;
    setIsLocked(false);
  }, []);

  const refreshAfterSetup = useCallback(() => {
    setAppLockEnabledState(StorageManager.isAppLockEnabled());
    setLockTimeoutSecondsState(StorageManager.getLockTimeoutSeconds());
    setIsLocked(false);
  }, []);

  return {
    appLockEnabled,
    lockTimeoutSeconds,
    isLocked,
    storedPin: StorageManager.getLockPin(),
    setAppLockEnabled,
    setLockTimeoutSeconds,
    unlock,
    refreshAfterSetup,
  };
}
