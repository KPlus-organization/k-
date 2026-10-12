import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { closePool, pool } from '../config/db';
import { PROJECT_ROOT } from '../config/paths';

const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'db/migrations');
// Arbitrary constant: serializes concurrent migration runs (e.g. parallel CI jobs).
const LOCK_ID = 7_310_250_001;

/**
 * Applies pending `db/migrations/*.sql` files in name order.
 * Each file runs in its own transaction and is recorded in schema_migrations.
 */
export async function migrate(log: (message: string) => void = console.log): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${file} failed`, { cause: err });
      }
      applied.push(file);
      log(`[migrate] applied ${file}`);
    }
    if (applied.length === 0) log('[migrate] database is up to date');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    client.release();
  }
  return applied;
}

if (require.main === module) {
  migrate()
    .catch((err: unknown) => {
      console.error('[migrate] failed:', err);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
