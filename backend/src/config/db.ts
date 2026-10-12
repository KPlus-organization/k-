import { Pool, type PoolClient } from 'pg';

import { env } from './env';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Fail fast instead of hanging requests when the database is unreachable.
  connectionTimeoutMillis: 5_000,
});

// Without a listener, an error on an idle client (e.g. the server restarted)
// would be emitted as an unhandled 'error' event and crash the process.
pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle PostgreSQL client:', err.message);
});

/** Lightweight connectivity check. Throws if PostgreSQL is unreachable. */
export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}

/** Runs `fn` in a transaction: commits on success, rolls back and rethrows on error. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

let closing: Promise<void> | undefined;

/** Closes all pool connections. Safe to call more than once. */
export function closePool(): Promise<void> {
  closing ??= pool.end();
  return closing;
}
