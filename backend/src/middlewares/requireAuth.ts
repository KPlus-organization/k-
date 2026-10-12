import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors/HttpError';
import { verifyAccessToken } from '../lib/tokens';

/** Requires `Authorization: Bearer <access token>` and sets `req.userId`. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get('Authorization');
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    throw new HttpError(401, 'AUTH_REQUIRED', 'Authorization header with a Bearer token is required');
  }

  req.userId = await verifyAccessToken(match[1]!);
  next();
}

/** The authenticated user id; only valid on routes behind requireAuth. */
export function authUserId(req: Request): string {
  if (!req.userId) throw new Error('authUserId() used on a route without requireAuth');
  return req.userId;
}
