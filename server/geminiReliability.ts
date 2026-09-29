export type AiFailureCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_TEMPORARILY_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE'
  | 'AI_REQUEST_FAILED';

export interface NormalizedAiFailure {
  code: AiFailureCode;
  httpStatus: number;
  message: string;
  retryable: boolean;
}

const FAILURE_DEFAULTS: Record<AiFailureCode, Omit<NormalizedAiFailure, 'code'>> = {
  AI_NOT_CONFIGURED: {
    httpStatus: 503,
    message: 'AI service is not configured.',
    retryable: false,
  },
  AI_TIMEOUT: {
    httpStatus: 504,
    message: 'AI analysis timed out. Please try again.',
    retryable: false,
  },
  AI_RATE_LIMITED: {
    httpStatus: 429,
    message: 'AI service is rate limited. Please try again shortly.',
    retryable: false,
  },
  AI_TEMPORARILY_UNAVAILABLE: {
    httpStatus: 503,
    message: 'AI service is temporarily unavailable. Please try again.',
    retryable: true,
  },
  AI_INVALID_RESPONSE: {
    httpStatus: 502,
    message: 'AI service returned an invalid response. Please try again.',
    retryable: false,
  },
  AI_REQUEST_FAILED: {
    httpStatus: 502,
    message: 'AI request failed. Please try again.',
    retryable: false,
  },
};

export class AiReliabilityError extends Error {
  readonly code: AiFailureCode;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(failure: NormalizedAiFailure) {
    super(failure.message);
    this.name = 'AiReliabilityError';
    this.code = failure.code;
    this.httpStatus = failure.httpStatus;
    this.retryable = failure.retryable;
  }
}

export function createAiFailure(code: AiFailureCode): AiReliabilityError {
  return new AiReliabilityError({ code, ...FAILURE_DEFAULTS[code] });
}

function asErrorRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStatus(error: unknown): number | null {
  const record = asErrorRecord(error);
  if (!record) return null;

  const nested = asErrorRecord(record.error);
  const candidates = [record.status, record.statusCode, record.code, nested?.status, nested?.code];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate)) return candidate;
    if (typeof candidate === 'string' && /^\d{3}$/.test(candidate)) {
      return Number(candidate);
    }
  }

  return null;
}

function readErrorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.slice(0, 2000);
  }

  const record = asErrorRecord(error);
  if (!record) return '';

  const nested = asErrorRecord(record.error);
  return [
    record.name,
    record.message,
    record.status,
    record.code,
    nested?.message,
    nested?.status,
    nested?.code,
  ]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .slice(0, 2000);
}

export function normalizeGeminiFailure(error: unknown): NormalizedAiFailure {
  if (error instanceof AiReliabilityError) {
    return {
      code: error.code,
      httpStatus: error.httpStatus,
      message: error.message,
      retryable: error.retryable,
    };
  }

  const status = readStatus(error);
  const text = readErrorText(error);

  if (
    /abort|timeout|timed out|deadline exceeded|ETIMEDOUT/i.test(text)
  ) {
    return { code: 'AI_TIMEOUT', ...FAILURE_DEFAULTS.AI_TIMEOUT };
  }

  if (
    status === 429 ||
    /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(text)
  ) {
    return { code: 'AI_RATE_LIMITED', ...FAILURE_DEFAULTS.AI_RATE_LIMITED };
  }

  if (
    (status != null && status >= 500 && status <= 599) ||
    status === 408 ||
    /UNAVAILABLE|overloaded|temporar(?:y|ily) unavailable|fetch failed|network error|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(
      text
    )
  ) {
    return {
      code: 'AI_TEMPORARILY_UNAVAILABLE',
      ...FAILURE_DEFAULTS.AI_TEMPORARILY_UNAVAILABLE,
    };
  }

  return { code: 'AI_REQUEST_FAILED', ...FAILURE_DEFAULTS.AI_REQUEST_FAILED };
}

export interface GeminiJsonExecutionOptions<T> {
  endpoint: string;
  requestId: string;
  timeoutMs: number;
  retryDelayMs: number;
  request: (timeoutMs: number, attempt: number) => Promise<{ text?: string | null }>;
  validate: (value: unknown) => T | null;
  logFailure?: (details: {
    endpoint: string;
    requestId: string;
    attempt: number;
    code: AiFailureCode;
    elapsedMs: number;
    willRetry: boolean;
  }) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeGeminiJson<T>(
  options: GeminiJsonExecutionOptions<T>
): Promise<T> {
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await options.request(options.timeoutMs, attempt);
      const text = typeof response.text === 'string' ? response.text.trim() : '';

      if (!text) {
        throw createAiFailure('AI_INVALID_RESPONSE');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw createAiFailure('AI_INVALID_RESPONSE');
      }

      const validated = options.validate(parsed);
      if (validated == null) {
        throw createAiFailure('AI_INVALID_RESPONSE');
      }

      return validated;
    } catch (error) {
      const failure = normalizeGeminiFailure(error);
      const willRetry = attempt === 1 && failure.retryable;

      options.logFailure?.({
        endpoint: options.endpoint,
        requestId: options.requestId,
        attempt,
        code: failure.code,
        elapsedMs: Date.now() - startedAt,
        willRetry,
      });

      if (!willRetry) {
        throw new AiReliabilityError(failure);
      }

      await delay(Math.max(0, Math.min(options.retryDelayMs, 1000)));
    }
  }

  throw createAiFailure('AI_REQUEST_FAILED');
}

export interface GeminiJsonModelFallbackOptions<T>
  extends Omit<GeminiJsonExecutionOptions<T>, 'request'> {
  models: string[];
  request: (
    model: string,
    timeoutMs: number,
    attempt: number
  ) => Promise<{ text?: string | null }>;
  logModelFallback?: (details: {
    endpoint: string;
    requestId: string;
    fromModel: string;
    toModel: string;
    code: AiFailureCode;
  }) => void;
}

export async function executeGeminiJsonWithModelFallback<T>(
  options: GeminiJsonModelFallbackOptions<T>
): Promise<T> {
  const models = [...new Set(options.models.map((model) => model.trim()).filter(Boolean))];
  if (models.length === 0) throw createAiFailure('AI_NOT_CONFIGURED');

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      return await executeGeminiJson({
        endpoint: options.endpoint,
        requestId: options.requestId,
        timeoutMs: options.timeoutMs,
        retryDelayMs: options.retryDelayMs,
        validate: options.validate,
        logFailure: options.logFailure,
        request: (timeoutMs, attempt) => options.request(model, timeoutMs, attempt),
      });
    } catch (error) {
      const nextModel = models[index + 1];
      if (
        !(error instanceof AiReliabilityError) ||
        (error.code !== 'AI_TEMPORARILY_UNAVAILABLE' &&
          error.code !== 'AI_RATE_LIMITED') ||
        !nextModel
      ) {
        throw error;
      }

      options.logModelFallback?.({
        endpoint: options.endpoint,
        requestId: options.requestId,
        fromModel: model,
        toModel: nextModel,
        code: error.code,
      });
    }
  }

  throw createAiFailure('AI_REQUEST_FAILED');
}

export function cleanupRateBuckets<T extends { resetAt: number }>(
  buckets: Map<string, T>,
  now: number,
  maxEntries: number
): number {
  let removed = 0;

  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
      removed += 1;
    }
  }

  if (buckets.size <= maxEntries) return removed;

  const overflow = buckets.size - maxEntries;
  const oldest = [...buckets.entries()]
    .sort((left, right) => left[1].resetAt - right[1].resetAt)
    .slice(0, overflow);

  for (const [key] of oldest) {
    if (buckets.delete(key)) removed += 1;
  }

  return removed;
}
