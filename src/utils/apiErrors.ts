import { Language } from '../types';
import { t, TranslationKey } from './translations';

export type AiApiErrorKind =
  | 'network'
  | 'timeout'
  | 'temporary_unavailable'
  | 'rate_limited'
  | 'not_configured'
  | 'invalid_response'
  | 'unauthorized'
  | 'generic';

export class SpendWiseApiError extends Error {
  readonly kind: AiApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    kind: AiApiErrorKind,
    options: {
      status?: number | null;
      code?: string | null;
      retryAfterSeconds?: number | null;
    } = {}
  ) {
    super(kind);
    this.name = 'SpendWiseApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export function classifyApiFailure(
  status: number | null,
  code: string | null
): AiApiErrorKind {
  if (code === 'AI_TIMEOUT') return 'timeout';
  if (code === 'AI_RATE_LIMITED' || status === 429) return 'rate_limited';
  if (code === 'AI_NOT_CONFIGURED') return 'not_configured';
  if (code === 'AI_TEMPORARILY_UNAVAILABLE') return 'temporary_unavailable';
  if (code === 'AI_INVALID_RESPONSE') return 'invalid_response';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status != null && status >= 500) return 'temporary_unavailable';
  return 'generic';
}

export async function apiErrorFromResponse(response: Response): Promise<SpendWiseApiError> {
  let code: string | null = null;

  try {
    const payload = (await response.json()) as unknown;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const candidate = (payload as Record<string, unknown>).error;
      if (typeof candidate === 'string') code = candidate;
    }
  } catch {
    // Non-JSON error responses are intentionally collapsed to a safe client category.
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds =
    retryAfterHeader != null && /^\d+$/.test(retryAfterHeader)
      ? Number(retryAfterHeader)
      : null;

  return new SpendWiseApiError(classifyApiFailure(response.status, code), {
    status: response.status,
    code,
    retryAfterSeconds,
  });
}

export function normalizeApiException(error: unknown): SpendWiseApiError {
  if (error instanceof SpendWiseApiError) return error;

  if (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  ) {
    return new SpendWiseApiError('timeout');
  }

  if (error instanceof TypeError) {
    return new SpendWiseApiError('network');
  }

  return new SpendWiseApiError('generic');
}

const ERROR_TRANSLATION_KEYS: Record<AiApiErrorKind, TranslationKey> = {
  network: 'aiErrorNetwork',
  timeout: 'aiErrorTimeout',
  temporary_unavailable: 'aiErrorUnavailable',
  rate_limited: 'aiErrorRateLimited',
  not_configured: 'aiErrorNotConfigured',
  invalid_response: 'aiErrorInvalidResponse',
  unauthorized: 'aiErrorGeneric',
  generic: 'aiErrorGeneric',
};

export function getAiErrorMessage(language: Language, error: unknown): string {
  return t(language, ERROR_TRANSLATION_KEYS[normalizeApiException(error).kind]);
}
