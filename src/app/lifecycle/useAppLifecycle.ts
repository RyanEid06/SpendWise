import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface AppLifecycleCallbacks {
  onBackground: () => void;
  onForeground: () => void;
}

export interface VisibilityTarget {
  hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export function subscribeBrowserVisibility(
  target: VisibilityTarget,
  callbacks: AppLifecycleCallbacks
): () => void {
  const handleVisibility = () => {
    if (target.hidden) {
      callbacks.onBackground();
    } else {
      callbacks.onForeground();
    }
  };

  target.addEventListener('visibilitychange', handleVisibility);
  return () => target.removeEventListener('visibilitychange', handleVisibility);
}

interface UseAppLifecycleOptions extends AppLifecycleCallbacks {
  enabled: boolean;
}

export function useAppLifecycle({
  enabled,
  onBackground,
  onForeground,
}: UseAppLifecycleOptions): void {
  useEffect(() => {
    if (!enabled) return;

    if (Capacitor.isNativePlatform()) {
      let disposed = false;
      let removeNativeListener: (() => Promise<void>) | null = null;

      void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          onForeground();
        } else {
          onBackground();
        }
      }).then((handle) => {
        if (disposed) {
          void handle.remove();
        } else {
          removeNativeListener = () => handle.remove();
        }
      });

      return () => {
        disposed = true;
        if (removeNativeListener) void removeNativeListener();
      };
    }

    return subscribeBrowserVisibility(document, { onBackground, onForeground });
  }, [enabled, onBackground, onForeground]);
}
