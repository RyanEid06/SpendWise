import { AuthenticatedApiClient } from '../security/AuthenticatedApiClient';
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
  timeoutMs = 15000
): Promise<Response> {
  return authenticatedApiClient.fetch(path, init, timeoutMs);
}

export async function apiFetchJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000
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
