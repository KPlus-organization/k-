import { pool } from '../config/db';

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

export async function addHistoryEntry(
  userId: string,
  entry: { type: HistoryType; target: string; title: string },
): Promise<HistoryEntry> {
  const { rows } = await pool.query<HistoryRow>(
    `INSERT INTO history_entries (user_id, type, target, title) VALUES ($1, $2, $3, $4)
     RETURNING id, type, target, title, visited_at`,
    [userId, entry.type, entry.target, entry.title],
  );
  return toEntry(rows[0]!);
}
