import { Response } from 'express';
import {
  AiReliabilityError,
  createAiFailure,
} from '../geminiReliability';

export function sendAiFailure(res: Response, error: unknown) {
  const failure =
    error instanceof AiReliabilityError
      ? error
      : createAiFailure('AI_REQUEST_FAILED');

  return res.status(failure.httpStatus).json({
    error: failure.code,
    message: failure.message,
  });
}
