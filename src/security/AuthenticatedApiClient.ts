import {
  InstallationIdentitySigner,
  installationIdentitySigner,
} from './InstallationIdentityService';
import { withOperationDeadline } from './aiOperationBudget';

interface RegistrationResponse {
  installationId: string;
}

interface ChallengeResponse {
  challengeId: string;
  expiresAt: number;
  payload: string;
}

interface SessionResponse {
  accessToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

const INSTALLATION_ID_STORAGE_KEY =
  'spendwise_backend_installation_id_v1';

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export class AuthenticatedApiClient {
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private inFlightSession: Promise<string> | null = null;
  private memoryInstallationId: string | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly signer: InstallationIdentitySigner =
      installationIdentitySigner,
    private readonly storage: Storage | null = safeLocalStorage()
  ) {}

  private url(path: string): string {
    const normalized = path.startsWith('/') ? path : '/' + path;
    return this.baseUrl + normalized;
  }

  private async rawFetch(
    path: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const target = this.url(path);
    if (
      import.meta.env?.PROD &&
      /^http:\/\//i.test(target)
    ) {
      throw new Error('Production SpendWise API requires HTTPS.');
    }

    return withOperationDeadline(async signal => {
      const response = await fetch(target, { ...init, signal });
      // Fetch resolves on headers. Keep both deadline and cancellation active
      // until the body arrives; a late body must not become a successful result.
      const body = await response.arrayBuffer();
      return new Response(response.status === 204 ? null : body, {
        status: response.status, statusText: response.statusText, headers: response.headers,
      });
    }, timeoutMs, init.signal);
  }

  private readInstallationId(): string | null {
    if (this.memoryInstallationId) return this.memoryInstallationId;
    const stored = this.storage?.getItem(INSTALLATION_ID_STORAGE_KEY) || null;
    this.memoryInstallationId = stored;
    return stored;
  }

  private saveInstallationId(id: string) {
    this.memoryInstallationId = id;
    this.storage?.setItem(INSTALLATION_ID_STORAGE_KEY, id);
  }

  private clearInstallationId() {
    this.memoryInstallationId = null;
    this.storage?.removeItem(INSTALLATION_ID_STORAGE_KEY);
  }

  private async parseJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = new Error('AUTH_HTTP_' + response.status) as Error & {
        status?: number;
      };
      error.status = response.status;
      throw error;
    }
    return (await response.json()) as T;
  }

  private async registerInstallation(): Promise<string> {
    const identity = await this.signer.getPublicIdentity();
    const response = await this.rawFetch(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(identity),
      },
      15_000
    );
    const registration =
      await this.parseJson<RegistrationResponse>(response);
    this.saveInstallationId(registration.installationId);
    return registration.installationId;
  }

  private async authenticateInstallation(
    allowReregister: boolean
  ): Promise<string> {
    let installationId =
      this.readInstallationId() || (await this.registerInstallation());

    try {
      const challengeResponse = await this.rawFetch(
        '/api/auth/challenge',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installationId }),
        },
        15_000
      );
      const challenge =
        await this.parseJson<ChallengeResponse>(challengeResponse);
      const signature = await this.signer.sign(challenge.payload);

      const proofResponse = await this.rawFetch(
        '/api/auth/verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installationId,
            challengeId: challenge.challengeId,
            signature,
          }),
        },
        15_000
      );
      const session = await this.parseJson<SessionResponse>(proofResponse);
      this.accessToken = session.accessToken;
      this.accessTokenExpiresAt = session.expiresAt;
      return session.accessToken;
    } catch (error) {
      const status =
        typeof error === 'object' && error != null && 'status' in error
          ? Number((error as { status?: number }).status)
          : 0;
      if (allowReregister && (status === 404 || status === 401)) {
        this.clearInstallationId();
        this.accessToken = null;
        this.accessTokenExpiresAt = 0;
        installationId = await this.registerInstallation();
        return this.authenticateInstallation(false);
      }
      throw error;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      Date.now() + 5_000 < this.accessTokenExpiresAt
    ) {
      return this.accessToken;
    }

    if (!this.inFlightSession) {
      this.inFlightSession = this.authenticateInstallation(true).finally(() => {
        this.inFlightSession = null;
      });
    }
    return this.inFlightSession;
  }

  invalidateSession() {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
  }

  async fetch(
    path: string,
    init: RequestInit = {},
    timeoutMs = 15_000
  ): Promise<Response> {
    let processingRemainingMs = timeoutMs;
    const send = async () => {
      const token = await this.getAccessToken();
      init.signal?.throwIfAborted();
      const headers = new Headers(init.headers);
      if (init.body != null && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      headers.set('Authorization', 'Bearer ' + token);
      const started = performance.now();
      let outcome = 'failure'; let code: string | undefined;
      try {
        const response = await this.rawFetch(path, { ...init, headers }, Math.max(1, processingRemainingMs));
        outcome = response.ok ? 'success' : 'failure'; return response;
      } catch (error) {
        code = error instanceof Error && error.name === 'TimeoutError' ? 'AI_TIMEOUT' : init.signal?.aborted ? 'AI_CANCELLED' : error instanceof TypeError ? 'AI_NETWORK_ERROR' : 'AI_REQUEST_FAILED';
        throw error;
      } finally {
        const elapsedMs = performance.now() - started; processingRemainingMs -= elapsedMs;
        const requestId = headers.get('X-Request-ID');
        if (requestId && /^[a-f0-9-]{36}$/i.test(requestId)) console.info('[AI processing]', JSON.stringify({ requestId, phase: 'ai_dispatch', outcome, code, elapsedMs: Math.round(elapsedMs) }));
      }
    };

    let response = await send();
    if (response.status === 401) {
      let code = ''; try { code = (await response.clone().json()).error; } catch {}
      if (['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED', 'API_UNAUTHORIZED'].includes(code) && processingRemainingMs > 0) {
        this.invalidateSession();
        response = await send();
      }
    }
    return response;
  }
}
