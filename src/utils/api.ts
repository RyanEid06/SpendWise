import { AuthenticatedApiClient } from '../security/AuthenticatedApiClient';
import { AI_PROCESSING_TIMEOUT_MS } from '../security/aiOperationBudget';
import type { AiRequestInit } from '../app/hooks/aiOperation';
import { diagnostics } from '../services/diagnostics/diagnostics';
import {
  SpendWiseApiError,
  apiErrorFromResponse,
  normalizeApiException,
} from './apiErrors';

const rawBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';
const baseUrl = rawBaseUrl.replace(/\/$/, '');

const authenticatedApiClient = new AuthenticatedApiClient(baseUrl);

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : '/' + path;
  return baseUrl + normalized;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function apiFetch(
  path: string,
  init: AiRequestInit = {},
  timeoutMs?: number
): Promise<Response> {
  if (!path.startsWith('/api/gemini/')) return authenticatedApiClient.fetch(path, init, timeoutMs ?? 15000);
  const requestId = crypto.randomUUID();
  const headers = new Headers(init.headers); headers.set('X-Request-ID', requestId);
  const start = performance.now();
  let outcome = 'failure'; let code: string | undefined;
  let backendVersion = 'unknown';
  let stage = 'readiness';
  const feature = path.split('/').at(-1);
  try {
    const response = await authenticatedApiClient.fetch(path, { ...init, headers, onPhase: event => {
      if (['readiness', 'register', 'challenge', 'verify', 'ai_dispatch'].includes(event.phase)) stage = event.phase;
      const version = (event as { backendVersion?: unknown }).backendVersion;
      if (typeof version === 'string' && /^(?:[a-f0-9]{12}|local|unknown)$/.test(version)) backendVersion = version;
      init.onPhase?.(event);
    } }, timeoutMs ?? AI_PROCESSING_TIMEOUT_MS);
    const version = response.headers.get('X-Backend-Version');
    if (version && /^(?:[a-f0-9]{12}|local|unknown)$/.test(version)) backendVersion = version;
    outcome = response.ok ? 'success' : 'failure';
    if (!response.ok) code = (await apiErrorFromResponse(response.clone())).kind;
    return response;
  } catch (error) {
    code = normalizeApiException(error).kind; outcome = code === 'cancelled' ? 'aborted' : 'failure'; throw error;
  } finally {
    const elapsedMs = Math.round(performance.now() - start);
    diagnostics.record({ operation: 'api.request', requestId, backendVersion, feature, stage, outcome: outcome === 'aborted' ? 'failure' : outcome, code, durationMs: elapsedMs });
    console.info('[AI operation]', JSON.stringify({ requestId, backendVersion, feature, phase: 'operation', stage, outcome, code, elapsedMs }));
  }
}

export async function apiFetchJson<T>(
  path: string,
  init: AiRequestInit = {},
  timeoutMs?: number
): Promise<T> {
  const startedAt = performance.now();
  try {
    const response = await apiFetch(path, init, timeoutMs);
    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    init.signal?.throwIfAborted();
    init.onPhase?.({ phase: 'checking', outcome: 'start' });
    try {
      const result = (await response.json()) as T;
      init.signal?.throwIfAborted();
      return result;
    } catch {
      init.signal?.throwIfAborted();
      throw new SpendWiseApiError('invalid_response', {
        status: response.status,
        code: 'AI_INVALID_RESPONSE',
      });
    }
  } catch (error) {
    const normalized = normalizeApiException(error);
    if (normalized.kind === 'invalid_response') diagnostics.record({ operation: 'api.request', outcome: 'failure', code: normalized.kind,
      stage: 'ai_dispatch', httpClass: normalized.status == null ? undefined : `${Math.floor(normalized.status / 100)}xx` });
    throw normalized;
  }
}
