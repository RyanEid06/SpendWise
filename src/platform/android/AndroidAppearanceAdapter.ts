import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ThemeMode } from '../../types';

interface AppearanceBridge {
  setThemeMode(options: { mode: ThemeMode }): Promise<{ mode: string }>;
}

const NativeAppearance = registerPlugin<AppearanceBridge>('SpendWiseAppearance');
const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export class AndroidAppearanceAdapter {
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly bridge: AppearanceBridge = NativeAppearance,
    private readonly isAvailable: () => boolean = isNativeAndroid
  ) {}

  setThemeMode(mode: ThemeMode): Promise<boolean> {
    if (!this.isAvailable() || !['LIGHT', 'DARK', 'SYSTEM'].includes(mode)) {
      return Promise.resolve(false);
    }
    // Preserve choice order even when a previous native preference write is slow.
    const result = this.pending.then(async () => {
      try {
        const applied = await this.bridge.setThemeMode({ mode });
        return applied.mode === mode;
      } catch {
        // Appearance mirroring must not prevent protected storage or the web UI
        // from opening. The next preference sync retries a failed native write.
        return false;
      }
    });
    this.pending = result.then(() => {});
    return result;
  }
}

export const androidAppearanceAdapter = new AndroidAppearanceAdapter();
