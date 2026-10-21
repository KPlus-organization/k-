import { pool, withTransaction } from '../config/db';

export const HISTORY_TYPES = ['material', 'search', 'tool'] as const;
export type HistoryType = (typeof HISTORY_TYPES)[number];

export interface HistoryEntry {
  id: string;
  type: HistoryType;
  target: string;
  title: string;
  visitedAt: string;
}

interface HistoryRow {
  id: string;
  type: HistoryType;
  target: string;
  title: string;
  visited_at: Date;
}

function toEntry(row: HistoryRow): HistoryEntry {
  return { id: row.id, type: row.type, target: row.target, title: row.title, visitedAt: row.visited_at.toISOString() };
}

/** Most recent entries first. */
export async function listHistory(userId: string, limit: number): Promise<HistoryEntry[]> {
  const { rows } = await pool.query<HistoryRow>(
    `SELECT id, type, target, title, visited_at FROM history_entries
     WHERE user_id = $1 ORDER BY visited_at DESC, id LIMIT $2`,
    [userId, limit],
  );
  return rows.map(toEntry);
}

/**
 * The same search, tool or material within 30 minutes is one visit, as material openings are:
 * a reload, Back to the results or a second tab returns the existing entry (`created: false`).
 */
export async function addHistoryEntry(
  userId: string,
  entry: { type: HistoryType; target: string; title: string },
): Promise<{ entry: HistoryEntry; created: boolean }> {
  return withTransaction(async (client) => {
    // Serializes one user's concurrent requests (two tabs), so only one of them inserts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('history:' || $1))", [userId]);
    const recent = await client.query<HistoryRow>(
      `SELECT id, type, target, title, visited_at FROM history_entries
       WHERE user_id = $1 AND type = $2 AND target = $3 AND visited_at > now() - interval '30 minutes'
       ORDER BY visited_at DESC LIMIT 1`,
      [userId, entry.type, entry.target],
    );
    if (recent.rows[0]) return { entry: toEntry(recent.rows[0]), created: false };
    const { rows } = await client.query<HistoryRow>(
      `INSERT INTO history_entries (user_id, type, target, title) VALUES ($1, $2, $3, $4)
       RETURNING id, type, target, title, visited_at`,
      [userId, entry.type, entry.target, entry.title],
    );
    return { entry: toEntry(rows[0]!), created: true };
  });
}
