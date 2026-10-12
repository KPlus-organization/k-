import type { PoolClient } from 'pg';

import { env } from '../config/env';
import { pool, withTransaction } from '../config/db';
import { HttpError } from '../errors/HttpError';
import { hashPassword, simulatePasswordCheck, verifyPassword } from '../lib/password';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../lib/tokens';
import { createUser, findUserByIdentifier, toUser, USER_COLUMNS, type User, type UserRow } from './users';

export interface AuthSession {
  tokenType: 'Bearer';
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: User;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function issueSession(client: PoolClient, user: User): Promise<AuthSession> {
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + env.refreshTokenTtlDays * DAY_MS);

  await client.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    user.id,
    hashRefreshToken(refreshToken),
    refreshTokenExpiresAt,
  ]);

  return {
    tokenType: 'Bearer',
    accessToken: await signAccessToken(user.id),
    expiresIn: env.accessTokenTtlSeconds,
    refreshToken,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    user,
  };
}

export async function register(data: { login: string; email: string; password: string }): Promise<AuthSession> {
  const passwordHash = await hashPassword(data.password);
  return withTransaction(async (client) => {
    // Until a separate name is collected, the login is used as the display name.
    const user = await createUser(client, { login: data.login, email: data.email, name: data.login, passwordHash });
    return issueSession(client, user);
  });
}

export async function login(identifier: string, password: string): Promise<AuthSession> {
  const found = await findUserByIdentifier(identifier);
  if (!found) {
    await simulatePasswordCheck(password);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid login or password');
  }
  if (!(await verifyPassword(password, found.passwordHash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid login or password');
  }

  const { passwordHash: _omit, ...user } = found;
  return withTransaction((client) => issueSession(client, user));
}

const INVALID_REFRESH = () => new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');

/**
 * Exchanges a refresh token for a new session (rotation): the old token is revoked.
 * Reusing an already revoked token revokes all of the user's sessions, since it
 * means the token was probably stolen.
 */
export async function refresh(refreshToken: string): Promise<AuthSession> {
  const outcome = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string; user_id: string; expired: boolean; revoked: boolean }>(
      `SELECT id, user_id, expires_at <= now() AS expired, revoked_at IS NOT NULL AS revoked
       FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [hashRefreshToken(refreshToken)],
    );
    const stored = rows[0];
    if (!stored || stored.expired) return { session: undefined };

    if (stored.revoked) {
      await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
        stored.user_id,
      ]);
      return { session: undefined };
    }

    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [stored.id]);
    const userRows = await client.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [stored.user_id]);
    const userRow = userRows.rows[0];
    if (!userRow) return { session: undefined };
    return { session: await issueSession(client, toUser(userRow)) };
  });

  // Thrown after the transaction so that reuse detection is committed.
  if (!outcome.session) throw INVALID_REFRESH();
  return outcome.session;
}

/** Revokes the refresh token. Unknown or already revoked tokens are ignored. */
export async function logout(refreshToken: string): Promise<void> {
  await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    hashRefreshToken(refreshToken),
  ]);
}
