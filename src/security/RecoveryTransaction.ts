export function abortError(): DOMException { return new DOMException('Operation aborted.', 'AbortError'); }

/** Also bounds uncancellable work such as native signing, and ignores late results. */
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => { cleanup(); reject(abortError()); };
    work.then(value => { cleanup(); signal.aborted ? reject(abortError()) : resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(abortError()); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

export class SharedTransaction<T> {
  private active: { controller: AbortController; promise: Promise<T>; waiters: number } | null = null;
  run(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, caller?: AbortSignal | null): Promise<T> {
    if (caller?.aborted) return Promise.reject(abortError());
    if (!this.active || this.active.controller.signal.aborted) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const flight = { controller, promise: null as unknown as Promise<T>, waiters: 0 };
      this.active = flight;
      flight.promise = abortable(Promise.resolve().then(() => {
        controller.signal.throwIfAborted(); return work(controller.signal);
      }), controller.signal).finally(() => { clearTimeout(timer); if (this.active === flight) this.active = null; });
    }
    const flight = this.active;
    flight.waiters++;
    return (caller ? abortable(flight.promise, caller) : flight.promise).finally(() => {
      if (--flight.waiters === 0) flight.controller.abort();
    });
  }
}
