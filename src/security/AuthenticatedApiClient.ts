import { InstallationIdentitySigner, installationIdentitySigner } from './InstallationIdentityService';
import { abortable, delay, SharedTransaction } from './RecoveryTransaction';

export interface RecoveryPhase {
  requestId: string;
  phase: 'readiness' | 'register' | 'challenge' | 'verify' | 'ai_dispatch';
  outcome: 'start' | 'success' | 'failure';
  elapsedMs: number;
  attempt: number;
  code?: 'HTTP_4XX' | 'HTTP_5XX' | 'NETWORK' | 'CANCELLED_OR_DEADLINE' | 'REJECTED';
}
interface RecoveryOptions {
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
  random?: () => number;
  onPhase?: (event: RecoveryPhase) => void;
}
const INSTALLATION_ID_STORAGE_KEY = 'spendwise_backend_installation_id_v1';
const AUTH_PATHS = { register: '/api/auth/register', challenge: '/api/auth/challenge', verify: '/api/auth/verify' } as const;
function safeLocalStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
class AuthHttpError extends Error {
  constructor(readonly status: number, readonly code: string) { super('Authentication request rejected.'); }
}
class DeviceOfflineError extends TypeError {
  constructor() { super('Device is offline.'); }
}

export class AuthenticatedApiClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private memoryInstallationId: string | null = null;
  private readonly readiness = new SharedTransaction<void>();
  private readonly session = new SharedTransaction<string>();
  private readonly transport: (url: string, init: RequestInit) => Promise<Response>;
  private readonly now: () => number;
  private readonly random: () => number;
  private logWindow = 0;
  private logCount = 0;

  constructor(private readonly baseUrl: string, private readonly signer: InstallationIdentitySigner = installationIdentitySigner,
    private readonly storage: Storage | null = safeLocalStorage(), private readonly options: RecoveryOptions = {}) {
    this.transport = options.fetch ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? (() => performance.now());
    this.random = options.random ?? Math.random;
  }

  private async phase<T>(requestId: string, phase: RecoveryPhase['phase'], attempt: number, work: () => Promise<T>): Promise<T> {
    const start = this.now();
    const emit = (outcome: RecoveryPhase['outcome'], error?: unknown) => {
      const code: RecoveryPhase['code'] = error instanceof AuthHttpError ? (error.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX')
        : error instanceof TypeError ? 'NETWORK' : error instanceof Error && error.name === 'AbortError' ? 'CANCELLED_OR_DEADLINE' : 'REJECTED';
      const event: RecoveryPhase = { requestId, phase, outcome, elapsedMs: Math.max(0, Math.round(this.now() - start)), attempt, ...(error ? { code } : {}) };
      try {
        if (this.options.onPhase) this.options.onPhase(event);
        else {
          if (this.now() - this.logWindow >= 60_000) { this.logWindow = this.now(); this.logCount = 0; }
          // Capacitor renders object arguments as [object Object] in logcat.
          if (this.logCount++ < 40) console.info('[AI connection]', JSON.stringify(event));
        }
      } catch { /* Diagnostics cannot change authentication. */ }
    };
    emit('start');
    try { const result = await work(); emit('success'); return result; }
    catch (error) { emit('failure', error); throw error; }
  }

  private async rawFetch(path: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal | null): Promise<Response> {
    const target = this.baseUrl + (path.startsWith('/') ? path : '/' + path);
    if (import.meta.env?.PROD && /^http:\/\//i.test(target)) throw new Error('Production SpendWise API requires HTTPS.');
    signal?.throwIfAborted();
    // A confirmed offline device cannot wake Render. Keep cold-start retries for
    // unknown connectivity; allow the next explicit operation to try again online.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new DeviceOfflineError();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      // Headers alone are not completion: retain the deadline through body receipt.
      return await abortable((async () => {
        const response = await this.transport(target, { ...init, signal: controller.signal });
        const body = await response.arrayBuffer();
        return new Response(response.status === 204 ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
      })(), controller.signal);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  private retryable(error: unknown): boolean {
    if (error instanceof DeviceOfflineError) return false;
    return error instanceof TypeError || error instanceof Error && error.name === 'AbortError' || error instanceof AuthHttpError && error.status >= 500;
  }
  private backoff(attempt: number, signal: AbortSignal) {
    return delay(Math.min(4_000, 250 * 2 ** (attempt - 1)) * (1 + this.random() * 0.5), signal);
  }
  private ensureReady(requestId: string, caller?: AbortSignal | null): Promise<void> {
    return this.readiness.run(async signal => {
      for (let attempt = 1; attempt <= 24; attempt++) {
        try {
          await this.phase(requestId, 'readiness', attempt, async () => {
            const response = await this.rawFetch('/api/health', { method: 'GET', headers: { 'X-Request-ID': requestId } }, 65_000, signal);
            if (!response.ok) throw new AuthHttpError(response.status, 'READINESS_FAILED');
            // Render can return a waking HTML page with status 200.
            let health: any; try { health = await response.json(); } catch { throw new TypeError('Backend is not ready.'); }
            if (health?.ok !== true) throw new TypeError('Backend is not ready.');
          });
          return;
        } catch (error) {
          if (signal.aborted || !this.retryable(error) || attempt === 24) throw error;
          await this.backoff(attempt, signal);
        }
      }
    }, 90_000, caller);
  }
  private readInstallationId(): string | null {
    if (this.memoryInstallationId) return this.memoryInstallationId;
    if (this.signer.persistent === false) return null;
    try { this.memoryInstallationId = this.storage?.getItem(INSTALLATION_ID_STORAGE_KEY) || null; } catch {}
    return this.memoryInstallationId;
  }
  private saveInstallationId(id: string) {
    this.memoryInstallationId = id;
    if (this.signer.persistent !== false) {
      try { this.storage?.setItem(INSTALLATION_ID_STORAGE_KEY, id); } catch {}
    }
  }
  private async authRequest<T>(phase: 'register' | 'challenge' | 'verify', body: unknown, requestId: string, signal: AbortSignal, attempt = 1): Promise<T> {
    return this.phase(requestId, phase, attempt, async () => {
          const response = await this.rawFetch(AUTH_PATHS[phase], {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId }, body: JSON.stringify(body),
          }, 15_000, signal);
          if (!response.ok) {
            let code = ''; try { code = (await response.json()).error; } catch {}
            throw new AuthHttpError(response.status, code);
          }
          return response.json() as Promise<T>;
    });
  }
  private async register(requestId: string, signal: AbortSignal): Promise<string> {
    const identity = await abortable(this.signer.getPublicIdentity(), signal);
    signal.throwIfAborted();
    let result: { installationId: string } | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { result = await this.authRequest<{ installationId: string }>('register', identity, requestId, signal, attempt); break; }
      catch (error) {
        if (signal.aborted || !this.retryable(error) || attempt === 3) throw error;
        await this.backoff(attempt, signal);
      }
    }
    if (!result) throw new Error('Registration exhausted.');
    if (typeof result.installationId !== 'string' || !result.installationId || result.installationId.length > 80) throw new Error('Invalid authentication response.');
    signal.throwIfAborted(); this.saveInstallationId(result.installationId);
    return result.installationId;
  }
  private getAccessToken(requestId: string, caller?: AbortSignal | null): Promise<string> {
    if (this.accessToken && Date.now() + 5_000 < this.accessTokenExpiresAt) return Promise.resolve(this.accessToken);
    return this.session.run(async signal => {
      let installationId = this.readInstallationId() || await this.register(requestId, signal);
      let recovered = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const challenge = await this.authRequest<{ challengeId: string; payload: string }>('challenge', { installationId }, requestId, signal, attempt);
          if (typeof challenge.payload !== 'string' || challenge.payload.length > 2048 || typeof challenge.challengeId !== 'string') throw new Error('Invalid authentication response.');
          const signature = await abortable(this.signer.sign(challenge.payload), signal);
          signal.throwIfAborted();
          const session = await this.authRequest<{ accessToken: string; expiresAt: number }>('verify', { installationId, challengeId: challenge.challengeId, signature }, requestId, signal, attempt);
          if (typeof session.accessToken !== 'string' || session.accessToken.length < 32 || session.accessToken.length > 512 || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) throw new Error('Invalid authentication response.');
          signal.throwIfAborted(); this.accessToken = session.accessToken; this.accessTokenExpiresAt = session.expiresAt;
          return session.accessToken;
        } catch (error) {
          if (!recovered && error instanceof AuthHttpError && error.status === 404 && error.code === 'UNKNOWN_INSTALLATION') {
            recovered = true; installationId = await this.register(requestId, signal); continue;
          }
          if (signal.aborted || !this.retryable(error) || attempt === 3) throw error;
          await this.backoff(attempt, signal);
        }
      }
      throw new Error('Authentication recovery exhausted.');
    }, 30_000, caller);
  }
  invalidateSession() { this.accessToken = null; this.accessTokenExpiresAt = 0; }
  async fetch(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
    const requestId = crypto.randomUUID();
    let sentToken: string | null = null;
    init.signal?.throwIfAborted();
    if (path.startsWith('/api/gemini/')) await this.ensureReady(requestId, init.signal);
    const send = async (attempt: number) => {
      const token = await this.getAccessToken(requestId, init.signal);
      sentToken = token;
      init.signal?.throwIfAborted();
      const headers = new Headers(init.headers);
      if (init.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      headers.set('Authorization', 'Bearer ' + token); headers.set('X-Request-ID', requestId);
      return this.phase(requestId, 'ai_dispatch', attempt, () => this.rawFetch(path, { ...init, headers }, timeoutMs, init.signal));
    };
    let response = await send(1);
    if (response.status === 401) {
      let code = ''; try { code = (await response.clone().json()).error; } catch {}
      if (['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED', 'API_UNAUTHORIZED'].includes(code)) {
        if (this.accessToken === sentToken) this.invalidateSession();
        response = await send(2);
      }
    }
    return response;
  }
}
