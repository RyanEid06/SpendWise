import express, {
  NextFunction,
  Request,
  Response,
} from 'express';
import { serverConfig } from '../config';

export const boundedAuthJsonBody = express.json({
  limit: serverConfig.maxAuthJsonBodyBytes,
  strict: true,
});

export const boundedAiJsonBody = express.json({
  limit: serverConfig.maxImageJsonBodyBytes,
  strict: true,
});

// Compatibility export for older tests/imports.
export const boundedJsonBody = boundedAiJsonBody;

export function parsedBodyByteLength(body: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? null), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function enforceParsedBodyLimit(maxBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (parsedBodyByteLength(req.body) > maxBytes) {
      return res.status(413).json({
        error: 'REQUEST_TOO_LARGE',
        message: 'Request body is too large.',
      });
    }
    return next();
  };
}
