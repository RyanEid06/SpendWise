import { diagnostics } from '../../services/diagnostics/diagnostics';
import type { DiagnosticStore } from '../../services/diagnostics/DiagnosticStore';

export interface AnimationFrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

const browserFrames: AnimationFrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

export class StartupHomeFrameTiming {
  private finished = false;
  private cancelPending?: () => void;
  constructor(
    private readonly readElapsed: () => number | Promise<number>,
    private readonly frames: AnimationFrameScheduler = browserFrames,
    private readonly store: Pick<DiagnosticStore, 'record'> = diagnostics
  ) {}

  onCommittedHomeFrame(homeVisible: boolean): () => void {
    this.cancelPending?.();
    if (!homeVisible || this.finished) return () => {};

    let cancelled = false;
    let firstFrame: number | undefined;
    let paintedFrame: number | undefined;
    const cancel = () => {
      cancelled = true;
      if (firstFrame !== undefined) this.frames.cancel(firstFrame);
      if (paintedFrame !== undefined) this.frames.cancel(paintedFrame);
      if (this.cancelPending === cancel) this.cancelPending = undefined;
    };
    this.cancelPending = cancel;
    firstFrame = this.frames.request(() => {
      firstFrame = undefined;
      if (cancelled) return;
      // The layout effect runs after Home commits. The next RAF precedes its
      // paint, so wait one more RAF before sampling the native elapsed clock.
      paintedFrame = this.frames.request(() => {
        paintedFrame = undefined;
        if (cancelled) return;
        void (async () => {
          try {
            const durationMs = await this.readElapsed();
            if (cancelled || this.finished) return;
            if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600_000) {
              throw new Error('Invalid startup duration');
            }
            this.finished = true;
            this.store.record({ operation: 'startup.home_frame', outcome: 'success', durationMs });
          } catch {
            if (cancelled || this.finished) return;
            this.finished = true;
            this.store.record({
              operation: 'startup.home_frame', outcome: 'failure', code: 'STARTUP_HOME_FRAME_FAILED',
            });
          }
        })();
      });
    });
    return cancel;
  }
}
