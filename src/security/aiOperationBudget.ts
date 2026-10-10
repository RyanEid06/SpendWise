export const AI_PROCESSING_TIMEOUT_MS = 115_000;
// WP35.1: readiness <=90s, auth <=30s, one refresh <=30s; dispatches
// together <=115s. Five seconds margin for local scheduling/validation.
export const AI_END_TO_END_TIMEOUT_MS = 270_000;

export async function withOperationDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, parent?: AbortSignal | null
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(parent?.reason ?? new DOMException('Cancelled', 'AbortError'));
  if (parent?.aborted) cancel(); else parent?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Operation deadline expired', 'TimeoutError')), timeoutMs);
  let abort: (() => void) | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      abort = () => reject(controller.signal.reason);
      if (controller.signal.aborted) { abort(); return; }
      controller.signal.addEventListener('abort', abort, { once: true });
      Promise.resolve().then(() => { controller.signal.throwIfAborted(); return work(controller.signal); }).then(value => {
        controller.signal.throwIfAborted(); resolve(value);
      }, reject).catch(reject);
    });
  } finally {
    clearTimeout(timer); parent?.removeEventListener('abort', cancel);
    if (abort) controller.signal.removeEventListener('abort', abort);
  }
}
