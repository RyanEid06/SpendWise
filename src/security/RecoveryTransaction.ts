export function abortError(signal?: AbortSignal | null): unknown { return signal?.reason ?? new DOMException('Operation aborted.', 'AbortError'); }

/** Also bounds uncancellable work such as native signing, and ignores late results. */
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => { cleanup(); reject(abortError(signal)); };
    work.then(value => { cleanup(); signal.aborted ? reject(abortError(signal)) : resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(abortError(signal)); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

export class SharedTransaction<T, Event extends { outcome: string } = never> {
  private active: { controller: AbortController; promise: Promise<T>; waiters: number;
    observers: Set<(event: Event) => void>; current: Event | null } | null = null;
  run(work: (signal: AbortSignal, emit: (event: Event) => void) => Promise<T>, timeoutMs: number,
    caller?: AbortSignal | null, observe?: (event: Event) => void): Promise<T> {
    if (caller?.aborted) return Promise.reject(abortError(caller));
    if (!this.active || this.active.controller.signal.aborted) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new DOMException('Recovery deadline expired.', 'TimeoutError')), timeoutMs);
      const flight = { controller, promise: null as unknown as Promise<T>, waiters: 0,
        observers: new Set<(event: Event) => void>(), current: null as Event | null };
      this.active = flight;
      flight.promise = abortable(Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return work(controller.signal, event => {
          flight.current = event.outcome === 'start' ? event : null;
          for (const observer of flight.observers) { try { observer(event); } catch {} }
        });
      }), controller.signal).finally(() => { clearTimeout(timer); if (this.active === flight) this.active = null; });
    }
    const flight = this.active;
    flight.waiters++;
    // A separate subscription per caller also handles callers sharing one callback.
    const observer = observe ? (event: Event) => observe(event) : undefined;
    if (observer) {
      flight.observers.add(observer);
      if (flight.current) { try { observer(flight.current); } catch {} }
    }
    const unsubscribe = () => { if (observer) flight.observers.delete(observer); };
    caller?.addEventListener('abort', unsubscribe, { once: true });
    return (caller ? abortable(flight.promise, caller) : flight.promise).finally(() => {
      unsubscribe(); caller?.removeEventListener('abort', unsubscribe);
      if (--flight.waiters === 0) flight.controller.abort();
    });
  }
}
