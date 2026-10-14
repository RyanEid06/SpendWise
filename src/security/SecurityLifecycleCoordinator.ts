import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { secureSessionService, type SecureSessionService, type SecureSessionSnapshot, type SecureSessionActionResult } from './SecureSessionService';

interface LifecycleObserver {
  onBackground(): void;
  onChange(locked: boolean): void;
}

export function canEnterProtectedApplication(revision: number, snapshot: SecureSessionSnapshot): boolean {
  return snapshot.sessionRevision === revision && (!snapshot.appLockEnabled || snapshot.state === 'unlocked');
}

/** One event queue spans bootstrap, storage opening and the mounted app. */
export class SecurityLifecycleCoordinator {
  private queue: Promise<void> = Promise.resolve();
  private active = true;
  private readonly foregroundWaiters = new Set<() => void>();
  private readonly observers = new Set<LifecycleObserver>();

  constructor(private readonly session: SecureSessionService, private readonly native: boolean) {}

  subscribe(observer: LifecycleObserver): () => void {
    this.observers.add(observer);
    return () => { this.observers.delete(observer); };
  }

  private notify(locked: boolean): void {
    for (const observer of this.observers) observer.onChange(locked);
  }

  background(now = Date.now()): void {
    this.active = false;
    for (const observer of this.observers) observer.onBackground();
    this.queue = this.queue.then(async () => {
      if (this.native) await this.session.onNativeBackground(now);
      else this.session.onBackground(now);
      this.notify(this.session.getSnapshot().state === 'locked');
    }).catch(() => {
      // Unknown lifecycle classification must fail closed.
      this.session.lock();
      this.notify(true);
    });
  }

  foreground(now = Date.now()): void {
    this.active = true;
    this.queue = this.queue.then(() => {
      const locked = this.session.onForeground(now);
      this.notify(locked);
    }).catch(() => {
      this.session.lock();
      this.notify(true);
    }).then(() => {
      for (const resolve of this.foregroundWaiters) resolve();
      this.foregroundWaiters.clear();
    });
  }

  async waitUntilForeground(): Promise<void> {
    // A new background event can arrive while a previous queue flush resolves.
    for (;;) {
      await this.queue;
      if (this.active) return;
      await new Promise<void>(resolve => { this.foregroundWaiters.add(resolve); });
    }
  }

  async authenticateWhenForeground(
    operation: () => Promise<SecureSessionActionResult>,
    presentationCurrent: () => boolean = () => true
  ): Promise<SecureSessionActionResult> {
    const revision = this.session.getSnapshot().sessionRevision;
    await this.waitUntilForeground();
    if (!presentationCurrent() || this.session.getSnapshot().sessionRevision !== revision) {
      return { ok: false, code: 'cancelled', detailCode: 'AUTHENTICATION_STALE' };
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<SecureSessionActionResult>(resolve => {
          timer = setTimeout(() => {
            void this.session.cancelPendingAuthentication().then(acknowledged => {
              this.notify(true);
              resolve({ ok: false, code: acknowledged ? 'cancelled' : 'error', detailCode: acknowledged ? 'AUTHENTICATION_TIMEOUT' : 'AUTHENTICATION_CANCEL_TIMEOUT' });
            });
          }, 65_000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export const securityLifecycle = new SecurityLifecycleCoordinator(secureSessionService, Capacitor.isNativePlatform());
let startPromise: Promise<void> | undefined;

export function startSecurityLifecycle(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    if (Capacitor.isNativePlatform()) {
      let eventRevision = 0;
      // The shared listener stays registered for the WebView lifetime, avoiding
      // a subscription gap when React commits AppShell or replays effects.
      await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        eventRevision++;
        const now = Date.now();
        if (isActive) securityLifecycle.foreground(now);
        else securityLifecycle.background(now);
      });
      const revision = eventRevision;
      const state = await CapacitorApp.getState();
      if (revision === eventRevision && !state.isActive) securityLifecycle.background(Date.now());
    } else if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const now = Date.now();
        if (document.hidden) securityLifecycle.background(now);
        else securityLifecycle.foreground(now);
      });
      if (document.hidden) securityLifecycle.background(Date.now());
    }
  })();
  return startPromise;
}
