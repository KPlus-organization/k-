import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env';
import { HttpError } from '../errors/HttpError';

interface PublicError {
  status: number;
  code: string;
  message: string;
}

const INTERNAL_ERROR: PublicError = {
  status: 500,
  code: 'INTERNAL_ERROR',
  message: 'Internal server error',
};

// Errors from express.json() (body-parser) carry `type` and `status`.
function fromBodyParserError(err: unknown): PublicError | undefined {
  if (typeof err !== 'object' || err === null || !('type' in err)) return undefined;

  switch (err.type) {
    case 'entity.parse.failed':
      return { status: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
    case 'entity.too.large':
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
    default: {
      const status = 'status' in err && typeof err.status === 'number' ? err.status : 0;
      return status >= 400 && status < 500
        ? { status: 400, code: 'BAD_REQUEST', message: 'Bad request' }
        : undefined;
    }
  }
}

function toPublicError(err: unknown): PublicError {
  if (err instanceof HttpError) {
    return { status: err.status, code: err.code, message: err.message };
  }
  return fromBodyParserError(err) ?? INTERNAL_ERROR;
}

function logError(req: Request, status: number, err: unknown): void {
  const prefix = `[error] ${req.method} ${req.originalUrl} -> ${status}`;
  const logged = err instanceof HttpError && err.cause !== undefined ? err.cause : err;

  if (env.isProduction) {
    // Keep production logs to one line; full details only in development.
    const code = logged instanceof Error && 'code' in logged ? ` [${String(logged.code)}]` : '';
    const summary = logged instanceof Error ? `${logged.name}${code}: ${logged.message}` : String(logged);
    console.error(prefix, summary);
  } else {
    console.error(prefix, logged);
  }
}

// Express recognises error handlers by their four parameters, so `next` must stay.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, code, message } = toPublicError(err);

  if (status >= 500) {
    logError(req, status, err);
  }

  res.status(status).json({ error: { code, message } });
}
