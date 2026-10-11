export type AiStage = 'idle' | 'starting' | 'preparing' | 'connecting' | 'authenticating' | 'sending' | 'checking' | 'ready' | 'local' | 'cancelled' | 'error';
export interface AiProgress { stage: AiStage; active: boolean }
/** Structural adapter for WP35.1 RecoveryPhase; never infers provider activity. */
export interface AiPhaseEvent { phase: string; outcome: string }
export interface AiRequestInit extends RequestInit { onPhase?: (event: AiPhaseEvent) => void }
export function stageFromRecoveryPhase(event: AiPhaseEvent): AiStage | null {
  if (event.outcome !== 'start') return null;
  if (event.phase === 'readiness') return 'connecting';
  if (['register', 'challenge', 'verify', 'authentication'].includes(event.phase)) return 'authenticating';
  if (event.phase === 'ai_dispatch') return 'sending';
  if (event.phase === 'checking') return 'checking';
  return null;
}

/** Owns only UI lifetime, not authentication, retry policy or runtime deadlines. */
export class AiOperationController {
  private generation = 0;
  private controller: AbortController | null = null;
  private snapshot: AiProgress = { stage: 'idle', active: false };
  private listeners = new Set<() => void>();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(stage: AiStage, active: boolean) {
    this.snapshot = { stage, active };
    this.listeners.forEach(listener => listener());
  }
  begin(initial: AiStage = 'starting') {
    if (this.snapshot.active) return null;
    const id = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const isCurrent = () => id === this.generation && !controller.signal.aborted;
    this.update(initial, true);
    const stage = (value: AiStage) => { if (isCurrent() && this.snapshot.active) this.update(value, true); };
    return {
      signal: controller.signal, isCurrent, stage,
      onPhase: (event: AiPhaseEvent) => { const value = stageFromRecoveryPhase(event); if (value) stage(value); },
      finish: (value: 'ready' | 'local' | 'error') => {
        if (isCurrent()) { this.controller = null; this.update(value, false); }
      },
    };
  }
  cancel = () => this.invalidate('cancelled');
  reset = () => this.invalidate('idle');
  private invalidate(stage: AiStage) {
    ++this.generation; // Invalidate before abort listeners or late promise callbacks run.
    const controller = this.controller;
    this.controller = null;
    controller?.abort();
    this.update(stage, false);
  }
}
