export interface LockThrottleState {
  failedAttempts: number;
  blockedUntil: number;
}

export interface LockThrottleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'spendwise_lock_throttle_v1';
export const MAX_LOCK_DELAY_MS = 30_000;

export function lockDelayForFailures(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  if (failedAttempts < 7) return 5_000;
  if (failedAttempts < 9) return 15_000;
  return MAX_LOCK_DELAY_MS;
}

export function nextLockThrottleState(
  current: LockThrottleState,
  now: number
): LockThrottleState {
  const failedAttempts = Math.max(0, Math.floor(current.failedAttempts)) + 1;
  const delay = lockDelayForFailures(failedAttempts);
  return {
    failedAttempts,
    blockedUntil: delay > 0 ? now + delay : 0,
  };
}

export function remainingLockDelayMs(state: LockThrottleState, now: number): number {
  return Math.max(0, state.blockedUntil - now);
}

function safeState(raw: string | null): LockThrottleState {
  if (!raw) return { failedAttempts: 0, blockedUntil: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<LockThrottleState>;
    const failedAttempts =
      Number.isInteger(parsed.failedAttempts) && Number(parsed.failedAttempts) >= 0
        ? Number(parsed.failedAttempts)
        : 0;
    const blockedUntil =
      typeof parsed.blockedUntil === 'number' && Number.isFinite(parsed.blockedUntil)
        ? Math.max(0, parsed.blockedUntil)
        : 0;
    return { failedAttempts, blockedUntil };
  } catch {
    return { failedAttempts: 0, blockedUntil: 0 };
  }
}

function browserStorage(): LockThrottleStorage {
  return localStorage;
}

export function readLockThrottleState(
  storage: LockThrottleStorage = browserStorage()
): LockThrottleState {
  return safeState(storage.getItem(STORAGE_KEY));
}

export function recordLockFailure(
  now = Date.now(),
  storage: LockThrottleStorage = browserStorage()
): LockThrottleState {
  const next = nextLockThrottleState(readLockThrottleState(storage), now);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearLockThrottle(
  storage: LockThrottleStorage = browserStorage()
): void {
  storage.removeItem(STORAGE_KEY);
}
