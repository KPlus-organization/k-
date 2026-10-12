import { createHash, randomBytes } from 'node:crypto';

import { errors, jwtVerify, SignJWT } from 'jose';

import { env } from '../config/env';
import { HttpError } from '../errors/HttpError';

const ALGORITHM = 'HS256';
const ISSUER = 'k-backend';
const secretKey = new TextEncoder().encode(env.jwtSecret);

/** A short-lived JWT whose `sub` is the user id. */
export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${env.accessTokenTtlSeconds}s`)
    .sign(secretKey);
}

/** Returns the user id from a valid access token, otherwise throws 401. */
export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: [ALGORITHM], issuer: ISSUER });
    if (typeof payload.sub !== 'string' || payload.sub === '') {
      throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid');
    }
    return payload.sub;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof errors.JWTExpired) {
      throw new HttpError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid');
  }
}

/** An opaque random refresh token. Only its hash is stored in the database. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
