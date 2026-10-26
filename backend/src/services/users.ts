import type { PoolClient } from 'pg';

import { pool, withTransaction } from '../config/db';
import { HttpError } from '../errors/HttpError';

export interface User {
  id: string;
  name: string;
  login: string;
  email: string;
  registeredAt: string;
}

export interface UserRow {
  id: string;
  name: string;
  login: string;
  email: string;
  created_at: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string;
  consentWithdrawn: boolean;
}

export const USER_COLUMNS = 'id, name, login, email, created_at';

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    email: row.email,
    registeredAt: row.created_at.toISOString(),
  };
}

/** Lookup key for case-insensitive uniqueness of logins and emails. */
export function normalizeKey(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

// Maps a unique violation on login_key/email_key to 409; rethrows anything else.
function rethrowConflict(err: unknown): never {
  if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505' && 'constraint' in err) {
    const constraint = String(err.constraint);
    if (constraint.includes('login_key')) {
      throw new HttpError(409, 'LOGIN_TAKEN', 'This login is already taken');
    }
    if (constraint.includes('email_key')) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'This email is already registered');
    }
  }
  throw err;
}

export async function createUser(
  client: PoolClient,
  data: { login: string; email: string; name: string; passwordHash: string },
): Promise<User> {
  try {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (login, login_key, email, email_key, name, password_hash, consent_given_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING ${USER_COLUMNS}`,
      [data.login, normalizeKey(data.login), data.email, normalizeKey(data.email), data.name, data.passwordHash],
    );
    return toUser(rows[0]!);
  } catch (err) {
    rethrowConflict(err);
  }
}

/** Finds a user by email (if the identifier contains "@") or by login. */
export async function findUserByIdentifier(identifier: string): Promise<UserWithPassword | undefined> {
  const column = identifier.includes('@') ? 'email_key' : 'login_key';
  const { rows } = await pool.query<UserRow & { password_hash: string; consent_withdrawn: boolean }>(
    `SELECT ${USER_COLUMNS}, password_hash, consent_withdrawn_at IS NOT NULL AS consent_withdrawn
     FROM users WHERE ${column} = $1`,
    [normalizeKey(identifier)],
  );
  const row = rows[0];
  return row && { ...toUser(row), passwordHash: row.password_hash, consentWithdrawn: row.consent_withdrawn };
}

export async function getUserById(id: string): Promise<User> {
  const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) {
    // The token is valid but its user was deleted.
    throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid');
  }
  return toUser(row);
}

/** Days after a consent withdrawal until the account and its data are deleted. */
export const WITHDRAWN_ACCOUNT_RETENTION_DAYS = 30;

/**
 * Withdraws the consent to personal data processing: every session is revoked and signing
 * in requires accepting the consent again. Unless that happens, the account is deleted
 * after WITHDRAWN_ACCOUNT_RETENTION_DAYS (see deleteWithdrawnAccounts).
 */
export async function withdrawConsent(id: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('UPDATE users SET consent_withdrawn_at = now(), updated_at = now() WHERE id = $1', [id]);
    await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
  });
}

/**
 * Deletes accounts whose consent was withdrawn at least `retention` ago, with their data
 * (favorites, history, documents, sessions are removed by ON DELETE CASCADE).
 * Returns the number of deleted accounts.
 */
export async function deleteWithdrawnAccounts(retention: string): Promise<number> {
  const { rowCount } = await pool.query(
    'DELETE FROM users WHERE consent_withdrawn_at <= now() - $1::interval',
    [retention],
  );
  return rowCount ?? 0;
}

/** Records a renewed consent of a user who had withdrawn it. */
export async function renewConsent(client: PoolClient, id: string): Promise<void> {
  await client.query(
    `UPDATE users SET consent_given_at = now(), consent_withdrawn_at = NULL, updated_at = now()
     WHERE id = $1`,
    [id],
  );
}

/** Whether the user may use the account: it exists and the consent is not withdrawn. */
export async function hasActiveConsent(id: string): Promise<boolean | undefined> {
  const { rows } = await pool.query<{ active: boolean }>(
    'SELECT consent_withdrawn_at IS NULL AS active FROM users WHERE id = $1',
    [id],
  );
  return rows[0]?.active;
}

export async function updateUser(
  id: string,
  changes: { name?: string; login?: string; email?: string },
): Promise<User> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (changes.name !== undefined) set('name', changes.name);
  if (changes.login !== undefined) {
    set('login', changes.login);
    set('login_key', normalizeKey(changes.login));
  }
  if (changes.email !== undefined) {
    set('email', changes.email);
    set('email_key', normalizeKey(changes.email));
  }
  values.push(id);

  try {
    const { rows } = await pool.query<UserRow>(
      `UPDATE users SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING ${USER_COLUMNS}`,
      values,
    );
    const row = rows[0];
    if (!row) throw new HttpError(401, 'INVALID_TOKEN', 'Access token is invalid');
    return toUser(row);
  } catch (err) {
    rethrowConflict(err);
  }
}
