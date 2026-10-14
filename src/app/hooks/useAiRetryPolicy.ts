import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeApiException } from '../../utils/apiErrors';

/** A context-local quota latch shared by visible actions and their handlers. */
export function useAiRetryPolicy() {
  const [quotaBlock, setQuotaBlock] = useState<{ retryAt: number | null } | null>(null);
  const blockRef = useRef(quotaBlock);
  const resetRetry = useCallback(() => {
    blockRef.current = null;
    setQuotaBlock(null);
  }, []);
  const canRetry = useCallback(() => {
    const block = blockRef.current;
    return block === null || block.retryAt !== null && Date.now() >= block.retryAt;
  }, []);
  const recordFailure = useCallback((error: unknown) => {
    const normalized = normalizeApiException(error);
    if (normalized.kind !== 'quota_exhausted') { resetRetry(); return; }
    const seconds = normalized.retryAfterSeconds;
    const block = { retryAt: seconds !== null && Number.isFinite(seconds) && seconds >= 0
      ? Date.now() + seconds * 1000 : null };
    blockRef.current = block;
    setQuotaBlock(block);
  }, [resetRetry]);
  useEffect(() => {
    if (quotaBlock?.retryAt == null) return;
    // Honor provider guidance. With no guidance, existing context-reset actions
    // release the latch; do not invent a provider daily-reset timezone.
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      if (blockRef.current !== quotaBlock) return;
      const remaining = quotaBlock.retryAt! - Date.now();
      if (remaining <= 0) resetRetry();
      else timer = setTimeout(expire, Math.min(remaining, 2_147_483_647));
    };
    expire();
    return () => clearTimeout(timer);
  }, [quotaBlock, resetRetry]);
  return { retryAllowed: quotaBlock === null, canRetry, recordFailure, resetRetry };
}
