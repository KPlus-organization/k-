import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors/HttpError';
import { verifyAccessToken } from '../lib/tokens';
import { hasActiveConsent } from '../services/users';

/**
 * Requires `Authorization: Bearer <access token>` and sets `req.userId`.
 * Access tokens are stateless, so the account is checked on every request: after the
 * consent is withdrawn, tokens issued earlier stop working at once.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get('Authorization');
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    throw new HttpError(401, 'AUTH_REQUIRED', 'Authorization header with a Bearer token is required');
  }

  const userId = await verifyAccessToken(match[1]!);
  const active = await hasActiveConsent(userId);
  if (active === undefined) throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid');
  if (!active) throw new HttpError(401, 'CONSENT_WITHDRAWN', 'Consent to personal data processing was withdrawn');
  req.userId = userId;
  next();
}

/** The authenticated user id; only valid on routes behind requireAuth. */
export function authUserId(req: Request): string {
  if (!req.userId) throw new Error('authUserId() used on a route without requireAuth');
  return req.userId;
}
