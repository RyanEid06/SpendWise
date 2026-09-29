import { SpendWiseApiError, apiErrorFromResponse, normalizeApiException } from './apiErrors';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';
const baseUrl = rawBaseUrl.replace(/\/$/, '');
const apiAccessToken =
  (import.meta.env.VITE_API_ACCESS_TOKEN as string | undefined)?.trim() || '';

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalized}`;
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
  const headers = new Headers(init.headers);

  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (apiAccessToken) {
    headers.set('X-SpendWise-Token', apiAccessToken);
  }

  return fetchWithTimeout(
    apiUrl(path),
    {
      ...init,
      headers,
    },
    timeoutMs
  );
}


export async function apiFetchJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  try {
    const response = await apiFetch(path, init, timeoutMs);
    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new SpendWiseApiError('invalid_response', {
        status: response.status,
        code: 'AI_INVALID_RESPONSE',
      });
    }
  } catch (error) {
    throw normalizeApiException(error);
  }
}
