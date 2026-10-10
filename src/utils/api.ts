import { AuthenticatedApiClient } from '../security/AuthenticatedApiClient';
import { AI_END_TO_END_TIMEOUT_MS, AI_PROCESSING_TIMEOUT_MS, withOperationDeadline } from '../security/aiOperationBudget';
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
  init: RequestInit = {},
  timeoutMs?: number
): Promise<Response> {
  if (!path.startsWith('/api/gemini/')) return authenticatedApiClient.fetch(path, init, timeoutMs ?? 15000);
  const requestId = crypto.randomUUID();
  const headers = new Headers(init.headers); headers.set('X-Request-ID', requestId);
  const start = performance.now();
  let outcome = 'failure'; let code: string | undefined;
  try {
    const response = await withOperationDeadline(signal => authenticatedApiClient.fetch(path, { ...init, headers, signal }, timeoutMs ?? AI_PROCESSING_TIMEOUT_MS), AI_END_TO_END_TIMEOUT_MS, init.signal);
    outcome = response.ok ? 'success' : 'failure';
    return response;
  } catch (error) {
    code = normalizeApiException(error).kind; outcome = code === 'cancelled' ? 'aborted' : 'failure'; throw error;
  } finally {
    console.info('[AI operation]', JSON.stringify({ requestId, phase: 'operation', outcome, code, elapsedMs: Math.round(performance.now() - start) }));
  }
}

export async function apiFetchJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs?: number
): Promise<T> {
  const startedAt = performance.now();
  try {
    const response = await apiFetch(path, init, timeoutMs);
    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    try {
      const result = (await response.json()) as T;
      diagnostics.record({ operation: 'api.request', outcome: 'success', durationMs: performance.now() - startedAt });
      return result;
    } catch {
      throw new SpendWiseApiError('invalid_response', {
        status: response.status,
        code: 'AI_INVALID_RESPONSE',
      });
    }
  } catch (error) {
    const normalized = normalizeApiException(error);
    diagnostics.record({ operation: 'api.request', outcome: 'failure', code: normalized.kind, httpClass: normalized.status == null ? undefined : `${Math.floor(normalized.status / 100)}xx`, durationMs: performance.now() - startedAt });
    throw normalized;
  }
}
