import {
  NextFunction,
  Request,
  Response,
} from 'express';
import {
  AiReliabilityError,
  createAiFailure,
} from '../geminiReliability';
import { boundedLog } from '../observability/safeLogging';

export function sendAiFailure(res: Response, error: unknown) {
  if (res.destroyed || res.writableEnded) return res;
  const failure =
    error instanceof AiReliabilityError
      ? error
      : createAiFailure('AI_REQUEST_FAILED');

  return res.status(failure.httpStatus).json({
    error: failure.code,
    message: failure.message,
  });
}

export function apiErrorHandler(
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'REQUEST_TOO_LARGE',
      message: 'Request body is too large.',
    });
  }

  if (
    error instanceof SyntaxError &&
    (error as SyntaxError & { status?: number }).status === 400
  ) {
    return res.status(400).json({
      error: 'INVALID_JSON',
      message: 'Malformed JSON request.',
    });
  }

  // Never print the error object here: parser/provider errors can carry
  // request fragments. Route and stable code are enough for diagnostics.
  boundedLog('API', {
    route: req.originalUrl,
    code: 'UNHANDLED_API_ERROR',
  });
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Request failed.',
  });
}
